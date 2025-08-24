import Bull from 'bull';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { TokenManager, TokenRefreshConfig, TokenManagerEvents } from './tokenManager';
import { logger } from '../../utils/logger';
import { getQuickBooksConfig } from '../../config';

/**
 * Refresh job data
 */
interface RefreshJobData {
  provider: string;
  tenantId?: string;
  priority: number;
  retryCount?: number;
}

/**
 * Token Refresh Scheduler using Bull queue
 */
export class TokenRefreshScheduler {
  private queue: Bull.Queue<RefreshJobData>;
  private tokenManager: TokenManager;
  private prisma: PrismaClient;
  private configs: Map<string, TokenRefreshConfig> = new Map();
  private isProcessing: boolean = false;

  constructor(
    prisma: PrismaClient,
    redis: Redis,
    queueName: string = 'token-refresh'
  ) {
    this.prisma = prisma;
    this.tokenManager = new TokenManager(prisma, redis);
    
    // Initialize Bull queue
    this.queue = new Bull<RefreshJobData>(queueName, {
      redis: {
        host: redis.options.host,
        port: redis.options.port,
        password: redis.options.password
      },
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        }
      }
    });

    this.setupEventHandlers();
    this.setupQueueProcessing();
  }

  /**
   * Initialize scheduler with provider configurations
   */
  async initialize(configs: TokenRefreshConfig[]): Promise<void> {
    logger.info(`Initializing token refresh scheduler with ${configs.length} provider(s)`);
    
    // Store configurations
    for (const config of configs) {
      const key = this.getConfigKey(config);
      this.configs.set(key, config);
    }

    // Initialize token manager
    await this.tokenManager.initialize(configs);

    // Schedule initial refresh checks
    await this.scheduleRefreshChecks();

    // Set up recurring checks
    await this.setupRecurringJobs();

    logger.info('Token refresh scheduler initialized successfully');
  }

  /**
   * Schedule a token refresh job
   */
  async scheduleRefresh(
    provider: string,
    tenantId?: string,
    options?: {
      delay?: number;
      priority?: number;
      immediate?: boolean;
    }
  ): Promise<Bull.Job<RefreshJobData>> {
    const jobData: RefreshJobData = {
      provider,
      tenantId,
      priority: options?.priority || 0
    };

    const jobOptions: Bull.JobOptions = {
      priority: options?.priority || 0,
      delay: options?.immediate ? 0 : (options?.delay || 0)
    };

    // Check for existing job
    const existingJob = await this.findExistingJob(provider, tenantId);
    if (existingJob && !options?.immediate) {
      logger.debug(`Refresh job already scheduled for ${provider}`);
      return existingJob;
    }

    const job = await this.queue.add('refresh-token', jobData, jobOptions);
    logger.info(
      `Scheduled token refresh for ${provider} (tenant: ${tenantId || 'default'}) ` +
      `with delay: ${jobOptions.delay}ms`
    );

    return job;
  }

  /**
   * Process token refresh jobs
   */
  private setupQueueProcessing(): void {
    this.queue.process('refresh-token', async (job) => {
      const { provider, tenantId } = job.data;
      const key = `${provider}:${tenantId || 'default'}`;
      
      logger.info(`Processing token refresh job for ${key}`);

      try {
        const config = this.configs.get(key);
        if (!config) {
          throw new Error(`No configuration found for ${key}`);
        }

        // Perform token refresh
        const tokens = await this.tokenManager.refreshToken(config);
        
        logger.info(`Successfully refreshed tokens for ${key}`);
        
        // Schedule next refresh based on new expiry
        if (tokens.expiresIn) {
          const nextRefreshDelay = this.calculateNextRefreshDelay(tokens.expiresIn);
          await this.scheduleRefresh(provider, tenantId, { delay: nextRefreshDelay });
        }

        return { success: true, provider, tenantId };
      } catch (error) {
        logger.error(`Token refresh job failed for ${key}:`, error);
        throw error;
      }
    });
  }

  /**
   * Set up event handlers
   */
  private setupEventHandlers(): void {
    // Token manager events
    this.tokenManager.on(TokenManagerEvents.TOKEN_REFRESHED, async (data) => {
      logger.info('Token refreshed event:', data);
      await this.recordRefreshMetric('success', data.provider, data.tenantId);
    });

    this.tokenManager.on(TokenManagerEvents.TOKEN_REFRESH_FAILED, async (data) => {
      logger.error('Token refresh failed event:', data);
      await this.recordRefreshMetric('failed', data.provider, data.tenantId);
      
      // Schedule retry with higher priority
      await this.scheduleRefresh(data.provider, data.tenantId, {
        delay: 60000, // Retry in 1 minute
        priority: 10
      });
    });

    this.tokenManager.on(TokenManagerEvents.TOKEN_NEAR_EXPIRY, async (data) => {
      logger.warn('Token near expiry event:', data);
      
      // Schedule immediate refresh
      await this.scheduleRefresh(data.provider, data.tenantId, {
        immediate: true,
        priority: 20
      });
    });

    // Queue events
    this.queue.on('completed', (job, result) => {
      logger.info(`Job ${job.id} completed:`, result);
    });

    this.queue.on('failed', (job, err) => {
      logger.error(`Job ${job.id} failed:`, err);
    });

    this.queue.on('stalled', (job) => {
      logger.warn(`Job ${job.id} stalled and will be retried`);
    });
  }

  /**
   * Schedule initial refresh checks for all tokens
   */
  private async scheduleRefreshChecks(): Promise<void> {
    try {
      // Get all stored tokens
      const tokens = await this.prisma.oAuthToken.findMany({
        select: {
          provider: true,
          tenantId: true,
          expiresAt: true,
          refreshToken: true
        }
      });

      for (const token of tokens) {
        if (!token.refreshToken) continue;

        const now = Date.now();
        const expiryTime = token.expiresAt.getTime();
        const timeUntilExpiry = expiryTime - now;

        // Schedule refresh 30 minutes before expiry
        const refreshDelay = Math.max(0, timeUntilExpiry - 30 * 60 * 1000);

        if (refreshDelay > 0) {
          await this.scheduleRefresh(token.provider, token.tenantId || undefined, {
            delay: refreshDelay
          });
        } else {
          // Token needs immediate refresh
          await this.scheduleRefresh(token.provider, token.tenantId || undefined, {
            immediate: true,
            priority: 30
          });
        }
      }

      logger.info(`Scheduled refresh checks for ${tokens.length} token(s)`);
    } catch (error) {
      logger.error('Failed to schedule initial refresh checks:', error);
    }
  }

  /**
   * Set up recurring jobs for monitoring
   */
  private async setupRecurringJobs(): Promise<void> {
    // Health check every 5 minutes
    await this.queue.add(
      'health-check',
      { type: 'health-check' },
      {
        repeat: {
          cron: '*/5 * * * *'
        }
      }
    );

    // Token expiry check every hour
    await this.queue.add(
      'expiry-check',
      { type: 'expiry-check' },
      {
        repeat: {
          cron: '0 * * * *'
        }
      }
    );

    // Process health check jobs
    this.queue.process('health-check', async () => {
      await this.performHealthCheck();
      return { success: true };
    });

    // Process expiry check jobs
    this.queue.process('expiry-check', async () => {
      await this.checkExpiringTokens();
      return { success: true };
    });

    logger.info('Recurring jobs set up successfully');
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const stats = await this.queue.getJobCounts();
      logger.info('Queue health check:', stats);

      // Check for stalled jobs
      if (stats.failed > 10) {
        logger.warn(`High number of failed jobs: ${stats.failed}`);
      }

      // Check token statuses
      const tokens = await this.prisma.oAuthToken.findMany({
        select: {
          provider: true,
          tenantId: true,
          expiresAt: true,
          failedRefreshCount: true,
          lastRefreshError: true
        }
      });

      for (const token of tokens) {
        if (token.failedRefreshCount > 3) {
          logger.error(
            `Token for ${token.provider} has failed ${token.failedRefreshCount} times: ` +
            token.lastRefreshError
          );
        }
      }
    } catch (error) {
      logger.error('Health check failed:', error);
    }
  }

  /**
   * Check for expiring tokens
   */
  private async checkExpiringTokens(): Promise<void> {
    try {
      const thirtyMinutesFromNow = new Date(Date.now() + 30 * 60 * 1000);
      
      const expiringTokens = await this.prisma.oAuthToken.findMany({
        where: {
          expiresAt: {
            lte: thirtyMinutesFromNow
          },
          refreshToken: {
            not: null
          }
        },
        select: {
          provider: true,
          tenantId: true,
          expiresAt: true
        }
      });

      logger.info(`Found ${expiringTokens.length} token(s) expiring soon`);

      for (const token of expiringTokens) {
        await this.scheduleRefresh(token.provider, token.tenantId || undefined, {
          immediate: true,
          priority: 25
        });
      }
    } catch (error) {
      logger.error('Failed to check expiring tokens:', error);
    }
  }

  /**
   * Find existing job for provider
   */
  private async findExistingJob(
    provider: string,
    tenantId?: string
  ): Promise<Bull.Job<RefreshJobData> | null> {
    const jobs = await this.queue.getJobs(['waiting', 'delayed']);
    
    return jobs.find(job => 
      job.data.provider === provider && 
      job.data.tenantId === tenantId
    ) || null;
  }

  /**
   * Calculate next refresh delay based on token expiry
   */
  private calculateNextRefreshDelay(expiresIn: number): number {
    // Refresh 30 minutes before expiry
    const bufferTime = 30 * 60; // 30 minutes in seconds
    const refreshIn = Math.max(60, expiresIn - bufferTime); // At least 1 minute
    return refreshIn * 1000; // Convert to milliseconds
  }

  /**
   * Record refresh metrics
   */
  private async recordRefreshMetric(
    status: 'success' | 'failed',
    provider: string,
    tenantId?: string
  ): Promise<void> {
    try {
      // Update token record
      await this.prisma.oAuthToken.updateMany({
        where: {
          provider,
          tenantId: tenantId || 'default'
        },
        data: status === 'success' 
          ? {
              failedRefreshCount: 0,
              lastRefreshError: null
            }
          : {
              failedRefreshCount: {
                increment: 1
              }
            }
      });
    } catch (error) {
      logger.warn('Failed to record refresh metric:', error);
    }
  }

  /**
   * Get configuration key
   */
  private getConfigKey(config: TokenRefreshConfig): string {
    return `${config.provider}:${config.tenantId || 'default'}`;
  }

  /**
   * Get queue statistics
   */
  async getStatistics(): Promise<{
    queue: Bull.JobCounts;
    tokens: any[];
    configs: number;
  }> {
    const queueStats = await this.queue.getJobCounts();
    
    const tokens = await this.prisma.oAuthToken.findMany({
      select: {
        provider: true,
        tenantId: true,
        expiresAt: true,
        refreshCount: true,
        failedRefreshCount: true,
        lastRefreshedAt: true
      }
    });

    return {
      queue: queueStats,
      tokens,
      configs: this.configs.size
    };
  }

  /**
   * Manually trigger refresh for a provider
   */
  async triggerManualRefresh(provider: string, tenantId?: string): Promise<void> {
    const key = `${provider}:${tenantId || 'default'}`;
    const config = this.configs.get(key);
    
    if (!config) {
      throw new Error(`No configuration found for ${key}`);
    }

    logger.info(`Manually triggering refresh for ${key}`);
    await this.tokenManager.refreshToken(config);
  }

  /**
   * Shutdown scheduler
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down token refresh scheduler...');
    
    this.isProcessing = false;
    await this.queue.close();
    await this.tokenManager.shutdown();
    
    logger.info('Token refresh scheduler shutdown complete');
  }
}