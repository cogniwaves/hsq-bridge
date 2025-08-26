import { Router } from 'express';
import Redis from 'ioredis';
import { TokenRefreshScheduler } from '../services/auth/refreshScheduler';
import { TokenManager, TokenRefreshConfig } from '../services/auth/tokenManager';
import { DatabaseTokenStorage } from '../services/auth/tokenStorage';
import { asyncHandler } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { createSuccessResponse, createErrorResponse } from '../utils/responses';
import { CryptoUtils } from '../utils/crypto';
import { prisma } from '../index';

const router = Router();
let redis: Redis | null = null;

// Initialize token refresh scheduler
let tokenScheduler: TokenRefreshScheduler | null = null;

/**
 * Initialize token management system
 */
async function initializeTokenManagement(): Promise<void> {
  if (tokenScheduler) return;

  try {
    // Initialize Redis connection
    if (!redis) {
      const { getRedisConfig } = await import('../config');
      redis = new Redis(getRedisConfig());
    }

    const { getQuickBooksConfig } = await import('../config');
    const qbConfig = getQuickBooksConfig();
    
    if (!qbConfig.clientId || !qbConfig.clientSecret) {
      logger.warn('QuickBooks credentials not configured, skipping token management initialization');
      return;
    }

    tokenScheduler = new TokenRefreshScheduler(prisma, redis);

    const configs: TokenRefreshConfig[] = [{
      provider: 'quickbooks',
      clientId: qbConfig.clientId,
      clientSecret: qbConfig.clientSecret,
      tokenEndpoint: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
      refreshBeforeExpiry: 30,
      maxRetries: 3,
      retryDelay: 1000,
      enableAutoRefresh: true,
      enableCircuitBreaker: true
    }];

    await tokenScheduler.initialize(configs);
    logger.info('Token management system initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize token management:', error);
  }
}

// Initialize on module load
initializeTokenManagement().catch(logger.error);

/**
 * GET /api/tokens/status
 * Get current token status for all providers
 */
router.get('/status', asyncHandler(async (req, res) => {
  try {
    const tokens = await prisma.oAuthToken.findMany({
      select: {
        id: true,
        provider: true,
        tenantId: true,
        tokenType: true,
        expiresAt: true,
        refreshTokenExpiresAt: true,
        scope: true,
        realmId: true,
        companyId: true,
        lastRefreshedAt: true,
        refreshCount: true,
        failedRefreshCount: true,
        lastRefreshError: true,
        createdAt: true,
        updatedAt: true
      }
    });

    // Calculate token health for each token
    const tokenStatuses = tokens.map(token => {
      const now = Date.now();
      const expiryTime = token.expiresAt.getTime();
      const timeUntilExpiry = expiryTime - now;
      const isExpired = timeUntilExpiry <= 0;
      const isNearExpiry = timeUntilExpiry <= 30 * 60 * 1000; // 30 minutes

      return {
        ...token,
        status: {
          isExpired,
          isNearExpiry,
          timeUntilExpiry: Math.max(0, timeUntilExpiry),
          timeUntilExpiryMinutes: Math.max(0, Math.round(timeUntilExpiry / 60000)),
          health: isExpired ? 'expired' : (isNearExpiry ? 'warning' : 'healthy'),
          needsRefresh: isExpired || isNearExpiry
        }
      };
    });

    res.json(createSuccessResponse({
      tokens: tokenStatuses,
      summary: {
        total: tokens.length,
        healthy: tokenStatuses.filter(t => t.status.health === 'healthy').length,
        warning: tokenStatuses.filter(t => t.status.health === 'warning').length,
        expired: tokenStatuses.filter(t => t.status.health === 'expired').length
      }
    }, 'Token status retrieved successfully'));
  } catch (error) {
    logger.error('Failed to get token status:', error);
    res.status(500).json(createErrorResponse(
      'Failed to retrieve token status',
      error instanceof Error ? error.message : 'Unknown error'
    ));
  }
}));

/**
 * POST /api/tokens/refresh/:provider
 * Manually trigger token refresh for a provider
 */
router.post('/refresh/:provider', asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const { tenantId } = req.body;

  try {
    if (!tokenScheduler) {
      await initializeTokenManagement();
      if (!tokenScheduler) {
        throw new Error('Token management system not initialized');
      }
    }

    logger.info(`Manual token refresh requested for ${provider} (tenant: ${tenantId || 'default'})`);
    
    await tokenScheduler.triggerManualRefresh(provider, tenantId);

    // Get updated token info
    const updatedToken = await prisma.oAuthToken.findUnique({
      where: {
        provider_tenantId: {
          provider,
          tenantId: tenantId || 'default'
        }
      },
      select: {
        expiresAt: true,
        lastRefreshedAt: true,
        refreshCount: true
      }
    });

    res.json(createSuccessResponse({
      provider,
      tenantId: tenantId || 'default',
      refreshed: true,
      expiresAt: updatedToken?.expiresAt,
      lastRefreshedAt: updatedToken?.lastRefreshedAt,
      refreshCount: updatedToken?.refreshCount
    }, 'Token refreshed successfully'));
  } catch (error) {
    logger.error(`Failed to refresh token for ${provider}:`, error);
    res.status(500).json(createErrorResponse(
      'Failed to refresh token',
      error instanceof Error ? error.message : 'Unknown error'
    ));
  }
}));

/**
 * GET /api/tokens/history/:provider
 * Get token refresh history for a provider
 */
router.get('/history/:provider', asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const { tenantId, limit = 50 } = req.query;

  try {
    const history = await prisma.tokenRefreshLog.findMany({
      where: {
        provider,
        ...(tenantId && { tenantId: tenantId as string })
      },
      orderBy: {
        attemptedAt: 'desc'
      },
      take: parseInt(limit as string)
    });

    // Calculate statistics
    const stats = {
      totalAttempts: history.length,
      successful: history.filter(h => h.status === 'success').length,
      failed: history.filter(h => h.status === 'failed').length,
      averageDuration: history
        .filter(h => h.durationMs)
        .reduce((acc, h) => acc + (h.durationMs || 0), 0) / 
        history.filter(h => h.durationMs).length || 0,
      lastSuccess: history.find(h => h.status === 'success')?.attemptedAt,
      lastFailure: history.find(h => h.status === 'failed')?.attemptedAt
    };

    res.json(createSuccessResponse({
      provider,
      tenantId: tenantId || 'all',
      history,
      stats
    }, 'Token refresh history retrieved successfully'));
  } catch (error) {
    logger.error('Failed to get token refresh history:', error);
    res.status(500).json(createErrorResponse(
      'Failed to retrieve token refresh history',
      error instanceof Error ? error.message : 'Unknown error'
    ));
  }
}));

/**
 * GET /api/tokens/queue
 * Get token refresh queue status
 */
router.get('/queue', asyncHandler(async (req, res) => {
  try {
    if (!tokenScheduler) {
      return res.json(createSuccessResponse({
        initialized: false,
        message: 'Token scheduler not initialized'
      }, 'Queue status retrieved'));
    }

    const stats = await tokenScheduler.getStatistics();

    res.json(createSuccessResponse({
      initialized: true,
      queue: stats.queue,
      tokens: stats.tokens,
      configuredProviders: stats.configs
    }, 'Queue status retrieved successfully'));
  } catch (error) {
    logger.error('Failed to get queue status:', error);
    res.status(500).json(createErrorResponse(
      'Failed to retrieve queue status',
      error instanceof Error ? error.message : 'Unknown error'
    ));
  }
}));

/**
 * POST /api/tokens/store
 * Store new tokens (after manual OAuth flow)
 */
router.post('/store', asyncHandler(async (req, res) => {
  const { 
    provider, 
    tenantId, 
    accessToken, 
    refreshToken, 
    expiresIn,
    scope,
    realmId,
    companyId 
  } = req.body;

  try {
    if (!provider || !accessToken) {
      return res.status(400).json(createErrorResponse(
        'Invalid request',
        'Provider and access token are required'
      ));
    }

    const storage = new DatabaseTokenStorage(prisma, redis);
    
    await storage.saveTokens({
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: expiresIn || 3600,
      scope,
      realmId,
      companyId
    }, {
      provider,
      tenantId: tenantId || 'default'
    });

    // Reinitialize scheduler if needed
    if (tokenScheduler && refreshToken) {
      await tokenScheduler.scheduleRefresh(provider, tenantId, {
        delay: ((expiresIn || 3600) - 1800) * 1000 // 30 minutes before expiry
      });
    }

    res.json(createSuccessResponse({
      provider,
      tenantId: tenantId || 'default',
      stored: true,
      hasRefreshToken: !!refreshToken,
      expiresIn
    }, 'Tokens stored successfully'));
  } catch (error) {
    logger.error('Failed to store tokens:', error);
    res.status(500).json(createErrorResponse(
      'Failed to store tokens',
      error instanceof Error ? error.message : 'Unknown error'
    ));
  }
}));

/**
 * DELETE /api/tokens/:provider
 * Delete tokens for a provider
 */
router.delete('/:provider', asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const { tenantId } = req.body;

  try {
    const storage = new DatabaseTokenStorage(prisma, redis);
    
    await storage.deleteTokens({
      provider,
      tenantId: tenantId || 'default'
    });

    res.json(createSuccessResponse({
      provider,
      tenantId: tenantId || 'default',
      deleted: true
    }, 'Tokens deleted successfully'));
  } catch (error) {
    logger.error('Failed to delete tokens:', error);
    res.status(500).json(createErrorResponse(
      'Failed to delete tokens',
      error instanceof Error ? error.message : 'Unknown error'
    ));
  }
}));

/**
 * GET /api/tokens/health
 * Get overall token management health
 */
router.get('/health', asyncHandler(async (req, res) => {
  try {
    const health = {
      scheduler: {
        initialized: !!tokenScheduler,
        status: tokenScheduler ? 'running' : 'not_initialized'
      },
      storage: {
        database: 'connected',
        redis: redis.status === 'ready' ? 'connected' : 'disconnected'
      },
      tokens: {
        total: 0,
        healthy: 0,
        expiring: 0,
        expired: 0
      }
    };

    // Get token statistics
    const tokens = await prisma.oAuthToken.findMany({
      select: {
        expiresAt: true
      }
    });

    const now = Date.now();
    health.tokens.total = tokens.length;
    health.tokens.healthy = tokens.filter(t => 
      t.expiresAt.getTime() - now > 30 * 60 * 1000
    ).length;
    health.tokens.expiring = tokens.filter(t => {
      const timeLeft = t.expiresAt.getTime() - now;
      return timeLeft > 0 && timeLeft <= 30 * 60 * 1000;
    }).length;
    health.tokens.expired = tokens.filter(t => 
      t.expiresAt.getTime() <= now
    ).length;

    const overallStatus = 
      health.tokens.expired > 0 ? 'critical' :
      health.tokens.expiring > 0 ? 'warning' :
      'healthy';

    res.json(createSuccessResponse({
      status: overallStatus,
      ...health
    }, 'Token management health retrieved successfully'));
  } catch (error) {
    logger.error('Failed to get token management health:', error);
    res.status(500).json(createErrorResponse(
      'Failed to retrieve health status',
      error instanceof Error ? error.message : 'Unknown error'
    ));
  }
}));

/**
 * POST /api/tokens/test-encryption
 * Test token encryption/decryption
 */
router.post('/test-encryption', asyncHandler(async (req, res) => {
  const { testToken } = req.body;

  try {
    const tokenToTest = testToken || 'test-token-' + Date.now();
    
    // Test encryption
    const encrypted = CryptoUtils.encrypt(tokenToTest);
    
    // Test decryption
    const decrypted = CryptoUtils.decrypt(
      encrypted.encrypted,
      encrypted.iv,
      encrypted.tag
    );

    // Test masking
    const masked = CryptoUtils.maskToken(tokenToTest);

    res.json(createSuccessResponse({
      original: tokenToTest,
      encrypted: {
        data: encrypted.encrypted.substring(0, 20) + '...',
        iv: encrypted.iv.substring(0, 10) + '...',
        tag: encrypted.tag.substring(0, 10) + '...'
      },
      decrypted: decrypted === tokenToTest ? 'Success - matches original' : 'Failed',
      masked
    }, 'Encryption test completed successfully'));
  } catch (error) {
    logger.error('Encryption test failed:', error);
    res.status(500).json(createErrorResponse(
      'Encryption test failed',
      error instanceof Error ? error.message : 'Unknown error'
    ));
  }
}));

export { router as tokenManagementRoutes };