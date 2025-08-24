import { PrismaClient, OAuthToken, Prisma } from '@prisma/client';
import { TokenEncryption, CryptoUtils } from '../../utils/crypto';
import { logger } from '../../utils/logger';
import Redis from 'ioredis';

/**
 * Token storage configuration
 */
export interface TokenStorageConfig {
  provider: string;
  tenantId?: string;
  useCache?: boolean;
  cacheExpiry?: number; // seconds
}

/**
 * OAuth token data structure
 */
export interface OAuthTokenData {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number; // seconds
  refreshTokenExpiresIn?: number; // seconds
  scope?: string;
  realmId?: string; // QuickBooks specific
  companyId?: string;
}

/**
 * Abstract token storage interface
 */
export interface ITokenStorage {
  saveTokens(tokens: OAuthTokenData, config: TokenStorageConfig): Promise<void>;
  getTokens(config: TokenStorageConfig): Promise<OAuthTokenData | null>;
  updateTokens(tokens: Partial<OAuthTokenData>, config: TokenStorageConfig): Promise<void>;
  deleteTokens(config: TokenStorageConfig): Promise<void>;
  isTokenExpired(config: TokenStorageConfig): Promise<boolean>;
  getTokenExpiry(config: TokenStorageConfig): Promise<Date | null>;
}

/**
 * Database-backed token storage with encryption
 */
export class DatabaseTokenStorage implements ITokenStorage {
  private prisma: PrismaClient;
  private redis?: Redis;

  constructor(prisma: PrismaClient, redis?: Redis) {
    this.prisma = prisma;
    this.redis = redis;
  }

  /**
   * Save tokens to database with encryption
   */
  async saveTokens(tokens: OAuthTokenData, config: TokenStorageConfig): Promise<void> {
    try {
      // Validate tokens before encryption
      if (!TokenEncryption.validateToken(tokens.accessToken, 'access')) {
        throw new Error('Invalid access token format');
      }

      if (tokens.refreshToken && !TokenEncryption.validateToken(tokens.refreshToken, 'refresh')) {
        throw new Error('Invalid refresh token format');
      }

      // Encrypt tokens
      const encryptedAccess = await TokenEncryption.encryptForStorage(tokens.accessToken);
      const encryptedRefresh = tokens.refreshToken
        ? await TokenEncryption.encryptForStorage(tokens.refreshToken)
        : null;

      // Calculate expiry times
      const now = new Date();
      const expiresAt = tokens.expiresIn
        ? new Date(now.getTime() + tokens.expiresIn * 1000)
        : new Date(now.getTime() + 3600 * 1000); // Default 1 hour

      const refreshTokenExpiresAt = tokens.refreshTokenExpiresIn
        ? new Date(now.getTime() + tokens.refreshTokenExpiresIn * 1000)
        : new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // Default 90 days

      // Combine encryption data for storage
      const encryptionData = {
        accessToken: encryptedAccess.encryptedToken + ':' + encryptedAccess.encryptionTag,
        refreshToken: encryptedRefresh
          ? encryptedRefresh.encryptedToken + ':' + encryptedRefresh.encryptionTag
          : null,
        encryptionIV: encryptedAccess.encryptionIV
      };

      // Upsert token data
      await this.prisma.oAuthToken.upsert({
        where: {
          provider_tenantId: {
            provider: config.provider,
            tenantId: config.tenantId || 'default'
          }
        },
        update: {
          accessToken: encryptionData.accessToken,
          refreshToken: encryptionData.refreshToken,
          tokenType: tokens.tokenType || 'Bearer',
          expiresAt,
          refreshTokenExpiresAt,
          scope: tokens.scope,
          realmId: tokens.realmId,
          companyId: tokens.companyId,
          encryptionIV: encryptionData.encryptionIV,
          lastRefreshedAt: now,
          refreshCount: { increment: 1 },
          failedRefreshCount: 0,
          lastRefreshError: null
        },
        create: {
          provider: config.provider,
          tenantId: config.tenantId || 'default',
          accessToken: encryptionData.accessToken,
          refreshToken: encryptionData.refreshToken,
          tokenType: tokens.tokenType || 'Bearer',
          expiresAt,
          refreshTokenExpiresAt,
          scope: tokens.scope,
          realmId: tokens.realmId,
          companyId: tokens.companyId,
          encryptionIV: encryptionData.encryptionIV
        }
      });

      // Cache tokens if Redis is available
      if (this.redis && config.useCache !== false) {
        await this.cacheTokens(tokens, config, expiresAt);
      }

      logger.info(`Tokens saved for ${config.provider} (tenant: ${config.tenantId || 'default'})`);
    } catch (error) {
      logger.error('Failed to save tokens:', error);
      throw new Error('Failed to save OAuth tokens');
    }
  }

  /**
   * Retrieve and decrypt tokens from database
   */
  async getTokens(config: TokenStorageConfig): Promise<OAuthTokenData | null> {
    try {
      // Try cache first if available
      if (this.redis && config.useCache !== false) {
        const cached = await this.getCachedTokens(config);
        if (cached) {
          logger.debug(`Using cached tokens for ${config.provider}`);
          return cached;
        }
      }

      // Get from database
      const tokenRecord = await this.prisma.oAuthToken.findUnique({
        where: {
          provider_tenantId: {
            provider: config.provider,
            tenantId: config.tenantId || 'default'
          }
        }
      });

      if (!tokenRecord) {
        logger.debug(`No tokens found for ${config.provider} (tenant: ${config.tenantId || 'default'})`);
        return null;
      }

      // Decrypt tokens
      const [encryptedAccess, accessTag] = tokenRecord.accessToken.split(':');
      const accessToken = await TokenEncryption.decryptFromStorage(
        encryptedAccess,
        tokenRecord.encryptionIV!,
        accessTag
      );

      let refreshToken: string | undefined;
      if (tokenRecord.refreshToken) {
        const [encryptedRefresh, refreshTag] = tokenRecord.refreshToken.split(':');
        refreshToken = await TokenEncryption.decryptFromStorage(
          encryptedRefresh,
          tokenRecord.encryptionIV!,
          refreshTag
        );
      }

      const tokenData: OAuthTokenData = {
        accessToken,
        refreshToken,
        tokenType: tokenRecord.tokenType,
        scope: tokenRecord.scope || undefined,
        realmId: tokenRecord.realmId || undefined,
        companyId: tokenRecord.companyId || undefined
      };

      // Cache the decrypted tokens
      if (this.redis && config.useCache !== false) {
        await this.cacheTokens(tokenData, config, tokenRecord.expiresAt);
      }

      return tokenData;
    } catch (error) {
      logger.error('Failed to retrieve tokens:', error);
      throw new Error('Failed to retrieve OAuth tokens');
    }
  }

  /**
   * Update existing tokens
   */
  async updateTokens(tokens: Partial<OAuthTokenData>, config: TokenStorageConfig): Promise<void> {
    try {
      const updateData: Prisma.OAuthTokenUpdateInput = {};

      // Handle access token update
      if (tokens.accessToken) {
        const encryptedAccess = await TokenEncryption.encryptForStorage(tokens.accessToken);
        updateData.accessToken = encryptedAccess.encryptedToken + ':' + encryptedAccess.encryptionTag;
        updateData.encryptionIV = encryptedAccess.encryptionIV;
        
        if (tokens.expiresIn) {
          updateData.expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
        }
      }

      // Handle refresh token update
      if (tokens.refreshToken) {
        const encryptedRefresh = await TokenEncryption.encryptForStorage(tokens.refreshToken);
        updateData.refreshToken = encryptedRefresh.encryptedToken + ':' + encryptedRefresh.encryptionTag;
        
        if (tokens.refreshTokenExpiresIn) {
          updateData.refreshTokenExpiresAt = new Date(Date.now() + tokens.refreshTokenExpiresIn * 1000);
        }
      }

      // Update other fields
      if (tokens.scope) updateData.scope = tokens.scope;
      if (tokens.realmId) updateData.realmId = tokens.realmId;
      if (tokens.companyId) updateData.companyId = tokens.companyId;

      await this.prisma.oAuthToken.update({
        where: {
          provider_tenantId: {
            provider: config.provider,
            tenantId: config.tenantId || 'default'
          }
        },
        data: updateData
      });

      // Invalidate cache
      if (this.redis) {
        await this.invalidateCache(config);
      }

      logger.info(`Tokens updated for ${config.provider} (tenant: ${config.tenantId || 'default'})`);
    } catch (error) {
      logger.error('Failed to update tokens:', error);
      throw new Error('Failed to update OAuth tokens');
    }
  }

  /**
   * Delete tokens from storage
   */
  async deleteTokens(config: TokenStorageConfig): Promise<void> {
    try {
      await this.prisma.oAuthToken.delete({
        where: {
          provider_tenantId: {
            provider: config.provider,
            tenantId: config.tenantId || 'default'
          }
        }
      });

      // Clear cache
      if (this.redis) {
        await this.invalidateCache(config);
      }

      logger.info(`Tokens deleted for ${config.provider} (tenant: ${config.tenantId || 'default'})`);
    } catch (error) {
      logger.error('Failed to delete tokens:', error);
      throw new Error('Failed to delete OAuth tokens');
    }
  }

  /**
   * Check if token is expired
   */
  async isTokenExpired(config: TokenStorageConfig): Promise<boolean> {
    try {
      const tokenRecord = await this.prisma.oAuthToken.findUnique({
        where: {
          provider_tenantId: {
            provider: config.provider,
            tenantId: config.tenantId || 'default'
          }
        },
        select: {
          expiresAt: true
        }
      });

      if (!tokenRecord) {
        return true;
      }

      // Check with 5-minute buffer for safety
      const bufferMs = 5 * 60 * 1000;
      return new Date().getTime() >= (tokenRecord.expiresAt.getTime() - bufferMs);
    } catch (error) {
      logger.error('Failed to check token expiry:', error);
      return true; // Assume expired on error
    }
  }

  /**
   * Get token expiry time
   */
  async getTokenExpiry(config: TokenStorageConfig): Promise<Date | null> {
    try {
      const tokenRecord = await this.prisma.oAuthToken.findUnique({
        where: {
          provider_tenantId: {
            provider: config.provider,
            tenantId: config.tenantId || 'default'
          }
        },
        select: {
          expiresAt: true
        }
      });

      return tokenRecord?.expiresAt || null;
    } catch (error) {
      logger.error('Failed to get token expiry:', error);
      return null;
    }
  }

  /**
   * Cache tokens in Redis
   */
  private async cacheTokens(
    tokens: OAuthTokenData,
    config: TokenStorageConfig,
    expiresAt: Date
  ): Promise<void> {
    if (!this.redis) return;

    try {
      const cacheKey = this.getCacheKey(config);
      const ttl = Math.max(
        config.cacheExpiry || 300, // Default 5 minutes
        Math.floor((expiresAt.getTime() - Date.now()) / 1000)
      );

      // Store encrypted in cache as well for extra security
      const cacheData = {
        ...tokens,
        accessToken: CryptoUtils.maskToken(tokens.accessToken),
        refreshToken: tokens.refreshToken ? CryptoUtils.maskToken(tokens.refreshToken) : undefined,
        cachedAt: new Date().toISOString()
      };

      await this.redis.setex(cacheKey, ttl, JSON.stringify(cacheData));
      logger.debug(`Tokens cached for ${config.provider} with TTL ${ttl}s`);
    } catch (error) {
      logger.warn('Failed to cache tokens:', error);
      // Don't throw - caching is optional
    }
  }

  /**
   * Get tokens from cache
   */
  private async getCachedTokens(config: TokenStorageConfig): Promise<OAuthTokenData | null> {
    if (!this.redis) return null;

    try {
      const cacheKey = this.getCacheKey(config);
      const cached = await this.redis.get(cacheKey);
      
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      
      // For security, we don't cache full tokens - retrieve from DB
      return null; // Force database retrieval for actual tokens
    } catch (error) {
      logger.warn('Failed to get cached tokens:', error);
      return null;
    }
  }

  /**
   * Invalidate token cache
   */
  private async invalidateCache(config: TokenStorageConfig): Promise<void> {
    if (!this.redis) return;

    try {
      const cacheKey = this.getCacheKey(config);
      await this.redis.del(cacheKey);
      logger.debug(`Cache invalidated for ${config.provider}`);
    } catch (error) {
      logger.warn('Failed to invalidate cache:', error);
    }
  }

  /**
   * Generate cache key
   */
  private getCacheKey(config: TokenStorageConfig): string {
    return `oauth:tokens:${config.provider}:${config.tenantId || 'default'}`;
  }
}

/**
 * File-based token storage (for development/testing)
 */
export class FileTokenStorage implements ITokenStorage {
  private filePath: string;

  constructor(filePath: string = './tokens.json') {
    this.filePath = filePath;
  }

  async saveTokens(tokens: OAuthTokenData, config: TokenStorageConfig): Promise<void> {
    // Implementation for file-based storage
    logger.warn('File-based token storage is not recommended for production');
    // ... implementation details
  }

  async getTokens(config: TokenStorageConfig): Promise<OAuthTokenData | null> {
    // Implementation for file-based storage
    return null;
  }

  async updateTokens(tokens: Partial<OAuthTokenData>, config: TokenStorageConfig): Promise<void> {
    // Implementation for file-based storage
  }

  async deleteTokens(config: TokenStorageConfig): Promise<void> {
    // Implementation for file-based storage
  }

  async isTokenExpired(config: TokenStorageConfig): Promise<boolean> {
    return true;
  }

  async getTokenExpiry(config: TokenStorageConfig): Promise<Date | null> {
    return null;
  }
}