import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { ITokenStorage, DatabaseTokenStorage, OAuthTokenData, TokenStorageConfig } from './tokenStorage';
import { logger } from '../../utils/logger';
import { CryptoUtils } from '../../utils/crypto';
import { EventEmitter } from 'events';

/**
 * Token refresh configuration
 */
export interface TokenRefreshConfig {
  provider: string;
  tenantId?: string;
  clientId: string;
  clientSecret: string;
  tokenEndpoint: string;
  refreshBeforeExpiry?: number; // minutes before expiry to refresh (default: 30)
  maxRetries?: number;
  retryDelay?: number; // milliseconds
  enableAutoRefresh?: boolean;
  enableCircuitBreaker?: boolean;
}

/**
 * Token manager events
 */
export enum TokenManagerEvents {
  TOKEN_REFRESHED = 'token:refreshed',
  TOKEN_REFRESH_FAILED = 'token:refresh:failed',
  TOKEN_EXPIRED = 'token:expired',
  TOKEN_NEAR_EXPIRY = 'token:near:expiry',
  CIRCUIT_BREAKER_OPEN = 'circuit:breaker:open',
  CIRCUIT_BREAKER_CLOSED = 'circuit:breaker:closed'
}

/**
 * Circuit breaker state
 */
interface CircuitBreakerState {
  isOpen: boolean;
  failures: number;
  lastFailureTime?: Date;
  nextRetryTime?: Date;
}

/**
 * Token Manager for handling OAuth token lifecycle
 */
export class TokenManager extends EventEmitter {
  private storage: ITokenStorage;
  private prisma: PrismaClient;
  private refreshTimers: Map<string, NodeJS.Timeout> = new Map();
  private refreshPromises: Map<string, Promise<OAuthTokenData>> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  
  // Circuit breaker configuration
  private readonly CIRCUIT_BREAKER_THRESHOLD = 3;
  private readonly CIRCUIT_BREAKER_RESET_TIME = 60000; // 1 minute
  private readonly CIRCUIT_BREAKER_HALF_OPEN_TIME = 30000; // 30 seconds

  constructor(prisma: PrismaClient, redis?: Redis) {
    super();
    this.prisma = prisma;
    this.storage = new DatabaseTokenStorage(prisma, redis);
  }

  /**
   * Initialize token manager and set up auto-refresh
   */
  async initialize(configs: TokenRefreshConfig[]): Promise<void> {
    logger.info(`Initializing token manager for ${configs.length} provider(s)`);
    
    for (const config of configs) {
      if (config.enableAutoRefresh !== false) {
        await this.setupAutoRefresh(config);
      }
    }

    // Set up periodic health check
    this.startHealthCheck();
  }

  /**
   * Get valid access token (refresh if needed)
   */
  async getAccessToken(config: TokenRefreshConfig): Promise<string> {
    const storageConfig: TokenStorageConfig = {
      provider: config.provider,
      tenantId: config.tenantId
    };

    try {
      // Check if token exists and is valid
      const tokens = await this.storage.getTokens(storageConfig);
      
      if (!tokens) {
        throw new Error(`No tokens found for ${config.provider}`);
      }

      // Check if token is expired or near expiry
      const isExpired = await this.storage.isTokenExpired(storageConfig);
      
      if (isExpired) {
        logger.info(`Token expired for ${config.provider}, refreshing...`);
        const refreshedTokens = await this.refreshToken(config);
        return refreshedTokens.accessToken;
      }

      return tokens.accessToken;
    } catch (error) {
      logger.error(`Failed to get access token for ${config.provider}:`, error);
      throw error;
    }
  }

  /**
   * Refresh OAuth tokens
   */
  async refreshToken(config: TokenRefreshConfig): Promise<OAuthTokenData> {
    const key = this.getConfigKey(config);
    
    // Check if refresh is already in progress
    const existingPromise = this.refreshPromises.get(key);
    if (existingPromise) {
      logger.debug(`Refresh already in progress for ${config.provider}, waiting...`);
      return existingPromise;
    }

    // Check circuit breaker
    if (config.enableCircuitBreaker && this.isCircuitBreakerOpen(key)) {
      throw new Error(`Circuit breaker open for ${config.provider}`);
    }

    // Create refresh promise
    const refreshPromise = this.performTokenRefresh(config);
    this.refreshPromises.set(key, refreshPromise);

    try {
      const result = await refreshPromise;
      this.refreshPromises.delete(key);
      this.resetCircuitBreaker(key);
      return result;
    } catch (error) {
      this.refreshPromises.delete(key);
      this.recordCircuitBreakerFailure(key);
      throw error;
    }
  }

  /**
   * Perform actual token refresh with retries
   */
  private async performTokenRefresh(config: TokenRefreshConfig): Promise<OAuthTokenData> {
    const storageConfig: TokenStorageConfig = {
      provider: config.provider,
      tenantId: config.tenantId
    };

    const maxRetries = config.maxRetries || 3;
    const retryDelay = config.retryDelay || 1000;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Get current tokens
        const currentTokens = await this.storage.getTokens(storageConfig);
        if (!currentTokens?.refreshToken) {
          throw new Error('No refresh token available');
        }

        // Log refresh attempt
        await this.logRefreshAttempt(config, attempt, 'automatic');

        // Make refresh request
        const startTime = Date.now();
        const response = await this.makeRefreshRequest(
          config,
          currentTokens.refreshToken
        );
        const duration = Date.now() - startTime;

        // Parse and validate response
        const newTokens = this.parseTokenResponse(response.data, currentTokens);
        
        // Save new tokens
        await this.storage.saveTokens(newTokens, storageConfig);

        // Log successful refresh
        await this.logRefreshSuccess(config, newTokens, duration);

        // Emit success event
        this.emit(TokenManagerEvents.TOKEN_REFRESHED, {
          provider: config.provider,
          tenantId: config.tenantId,
          expiresIn: newTokens.expiresIn
        });

        // Reset auto-refresh timer
        if (config.enableAutoRefresh !== false) {
          await this.setupAutoRefresh(config);
        }

        logger.info(
          `Successfully refreshed tokens for ${config.provider} ` +
          `(attempt ${attempt}/${maxRetries})`
        );

        return newTokens;
      } catch (error) {
        lastError = error as Error;
        logger.error(
          `Token refresh attempt ${attempt}/${maxRetries} failed for ${config.provider}:`,
          error
        );

        // Log failed attempt
        await this.logRefreshFailure(config, error as Error, attempt);

        if (attempt < maxRetries) {
          // Exponential backoff with jitter
          const delay = retryDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
          logger.info(`Retrying token refresh in ${Math.round(delay)}ms...`);
          await this.sleep(delay);
        }
      }
    }

    // All retries failed
    this.emit(TokenManagerEvents.TOKEN_REFRESH_FAILED, {
      provider: config.provider,
      tenantId: config.tenantId,
      error: lastError?.message
    });

    throw new Error(
      `Failed to refresh tokens after ${maxRetries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Make HTTP request to refresh tokens
   */
  private async makeRefreshRequest(
    config: TokenRefreshConfig,
    refreshToken: string
  ): Promise<any> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    });

    const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

    return axios.post(config.tokenEndpoint, params.toString(), {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      timeout: 30000,
      validateStatus: (status) => status < 500 // Don't throw on 4xx errors
    });
  }

  /**
   * Parse token response from OAuth provider
   */
  private parseTokenResponse(response: any, currentTokens: OAuthTokenData): OAuthTokenData {
    if (response.error) {
      throw new Error(`OAuth error: ${response.error} - ${response.error_description}`);
    }

    if (!response.access_token) {
      throw new Error('No access token in refresh response');
    }

    return {
      accessToken: response.access_token,
      refreshToken: response.refresh_token || currentTokens.refreshToken,
      tokenType: response.token_type || 'Bearer',
      expiresIn: response.expires_in,
      refreshTokenExpiresIn: response.x_refresh_token_expires_in,
      scope: response.scope || currentTokens.scope,
      realmId: response.realmId || currentTokens.realmId,
      companyId: currentTokens.companyId
    };
  }

  /**
   * Set up automatic token refresh
   */
  private async setupAutoRefresh(config: TokenRefreshConfig): Promise<void> {
    const key = this.getConfigKey(config);
    
    // Clear existing timer
    const existingTimer = this.refreshTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    try {
      // Get token expiry
      const storageConfig: TokenStorageConfig = {
        provider: config.provider,
        tenantId: config.tenantId
      };
      
      const expiry = await this.storage.getTokenExpiry(storageConfig);
      if (!expiry) {
        logger.warn(`No token expiry found for ${config.provider}, skipping auto-refresh`);
        return;
      }

      // Calculate refresh time (default 30 minutes before expiry)
      const refreshBeforeMs = (config.refreshBeforeExpiry || 30) * 60 * 1000;
      const refreshAt = new Date(expiry.getTime() - refreshBeforeMs);
      const delay = Math.max(0, refreshAt.getTime() - Date.now());

      if (delay > 0) {
        logger.info(
          `Scheduling token refresh for ${config.provider} at ${refreshAt.toISOString()} ` +
          `(in ${Math.round(delay / 1000 / 60)} minutes)`
        );

        const timer = setTimeout(async () => {
          logger.info(`Auto-refreshing token for ${config.provider}`);
          try {
            await this.refreshToken(config);
          } catch (error) {
            logger.error(`Auto-refresh failed for ${config.provider}:`, error);
          }
        }, delay);

        this.refreshTimers.set(key, timer);

        // Emit near-expiry event if within threshold
        if (delay < 60 * 60 * 1000) { // Less than 1 hour
          this.emit(TokenManagerEvents.TOKEN_NEAR_EXPIRY, {
            provider: config.provider,
            tenantId: config.tenantId,
            expiresIn: Math.round(delay / 1000)
          });
        }
      } else {
        // Token already needs refresh
        logger.warn(`Token for ${config.provider} already needs refresh`);
        setImmediate(async () => {
          try {
            await this.refreshToken(config);
          } catch (error) {
            logger.error(`Immediate refresh failed for ${config.provider}:`, error);
          }
        });
      }
    } catch (error) {
      logger.error(`Failed to setup auto-refresh for ${config.provider}:`, error);
    }
  }

  /**
   * Start periodic health check
   */
  private startHealthCheck(): void {
    setInterval(async () => {
      for (const [key, timer] of this.refreshTimers.entries()) {
        logger.debug(`Health check: Timer ${key} is ${timer ? 'active' : 'inactive'}`);
      }
      
      // Check and reset circuit breakers if needed
      for (const [key, state] of this.circuitBreakers.entries()) {
        if (state.isOpen && state.nextRetryTime && Date.now() >= state.nextRetryTime.getTime()) {
          logger.info(`Resetting circuit breaker for ${key}`);
          this.resetCircuitBreaker(key);
        }
      }
    }, 60000); // Every minute
  }

  /**
   * Circuit breaker management
   */
  private isCircuitBreakerOpen(key: string): boolean {
    const state = this.circuitBreakers.get(key);
    if (!state || !state.isOpen) return false;

    // Check if it's time to try half-open state
    if (state.nextRetryTime && Date.now() >= state.nextRetryTime.getTime()) {
      return false; // Allow one retry
    }

    return true;
  }

  private recordCircuitBreakerFailure(key: string): void {
    const state = this.circuitBreakers.get(key) || {
      isOpen: false,
      failures: 0
    };

    state.failures++;
    state.lastFailureTime = new Date();

    if (state.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      state.isOpen = true;
      state.nextRetryTime = new Date(Date.now() + this.CIRCUIT_BREAKER_HALF_OPEN_TIME);
      
      logger.warn(`Circuit breaker opened for ${key}`);
      this.emit(TokenManagerEvents.CIRCUIT_BREAKER_OPEN, { key });
    }

    this.circuitBreakers.set(key, state);
  }

  private resetCircuitBreaker(key: string): void {
    const state = this.circuitBreakers.get(key);
    if (state && state.isOpen) {
      logger.info(`Circuit breaker closed for ${key}`);
      this.emit(TokenManagerEvents.CIRCUIT_BREAKER_CLOSED, { key });
    }
    
    this.circuitBreakers.delete(key);
  }

  /**
   * Logging methods
   */
  private async logRefreshAttempt(
    config: TokenRefreshConfig,
    attempt: number,
    refreshType: string
  ): Promise<void> {
    try {
      await this.prisma.tokenRefreshLog.create({
        data: {
          tokenId: this.getConfigKey(config),
          provider: config.provider,
          tenantId: config.tenantId,
          refreshType,
          triggerReason: `Attempt ${attempt}`,
          status: 'in_progress',
          attemptedAt: new Date(),
          retryAttempt: attempt - 1
        }
      });
    } catch (error) {
      logger.warn('Failed to log refresh attempt:', error);
    }
  }

  private async logRefreshSuccess(
    config: TokenRefreshConfig,
    tokens: OAuthTokenData,
    duration: number
  ): Promise<void> {
    try {
      const expiresAt = tokens.expiresIn
        ? new Date(Date.now() + tokens.expiresIn * 1000)
        : undefined;

      await this.prisma.tokenRefreshLog.create({
        data: {
          tokenId: this.getConfigKey(config),
          provider: config.provider,
          tenantId: config.tenantId,
          refreshType: 'automatic',
          triggerReason: 'Token near expiry',
          status: 'success',
          attemptedAt: new Date(Date.now() - duration),
          completedAt: new Date(),
          durationMs: duration,
          newExpiresAt: expiresAt
        }
      });
    } catch (error) {
      logger.warn('Failed to log refresh success:', error);
    }
  }

  private async logRefreshFailure(
    config: TokenRefreshConfig,
    error: Error,
    attempt: number
  ): Promise<void> {
    try {
      await this.prisma.tokenRefreshLog.create({
        data: {
          tokenId: this.getConfigKey(config),
          provider: config.provider,
          tenantId: config.tenantId,
          refreshType: 'automatic',
          triggerReason: `Attempt ${attempt} failed`,
          status: 'failed',
          attemptedAt: new Date(),
          errorMessage: error.message,
          retryAttempt: attempt - 1
        }
      });
    } catch (logError) {
      logger.warn('Failed to log refresh failure:', logError);
    }
  }

  /**
   * Utility methods
   */
  private getConfigKey(config: TokenRefreshConfig): string {
    return `${config.provider}:${config.tenantId || 'default'}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down token manager...');
    
    // Clear all refresh timers
    for (const timer of this.refreshTimers.values()) {
      clearTimeout(timer);
    }
    this.refreshTimers.clear();

    // Wait for pending refreshes
    if (this.refreshPromises.size > 0) {
      logger.info(`Waiting for ${this.refreshPromises.size} pending refresh operations...`);
      await Promise.allSettled(this.refreshPromises.values());
    }

    this.removeAllListeners();
    logger.info('Token manager shutdown complete');
  }
}