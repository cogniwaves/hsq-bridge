#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { DatabaseTokenStorage } from '../services/auth/tokenStorage';
import { logger } from '../utils/logger';
import { initializeConfig } from '../config';

dotenv.config();

/**
 * Script to migrate existing QuickBooks tokens from environment variables
 * to the secure database storage
 */
async function migrateTokens() {
  const prisma = new PrismaClient();
  
  // Initialize config first
  const config = initializeConfig();
  
  const { getRedisConfig, getQuickBooksConfig } = await import('../config');
  const redis = new Redis(getRedisConfig());
  const storage = new DatabaseTokenStorage(prisma, redis);

  try {
    logger.info('Starting token migration...');

    const qbConfig = getQuickBooksConfig();

    // Check if we have tokens in environment
    if (!qbConfig.accessToken || !qbConfig.refreshToken) {
      logger.warn('No tokens found in environment variables');
      return;
    }

    if (!qbConfig.clientId || !qbConfig.clientSecret) {
      logger.error('QuickBooks client credentials not configured');
      return;
    }

    logger.info('Found existing tokens in environment variables');

    // Check if tokens already exist in database
    const existingTokens = await prisma.oAuthToken.findUnique({
      where: {
        provider_tenantId: {
          provider: 'quickbooks',
          tenantId: 'default'
        }
      }
    });

    if (existingTokens) {
      logger.warn('Tokens already exist in database. Skipping migration.');
      logger.info('To force migration, delete existing tokens first.');
      return;
    }

    // Save tokens to secure storage
    await storage.saveTokens({
      accessToken: qbConfig.accessToken,
      refreshToken: qbConfig.refreshToken,
      tokenType: 'Bearer',
      expiresIn: 3600, // Default 1 hour - will be refreshed automatically
      scope: 'com.intuit.quickbooks.accounting',
      realmId: qbConfig.companyId,
      companyId: qbConfig.companyId
    }, {
      provider: 'quickbooks',
      tenantId: 'default'
    });

    logger.info('Successfully migrated tokens to secure storage');

    // Verify migration
    const migratedTokens = await storage.getTokens({
      provider: 'quickbooks',
      tenantId: 'default'
    });

    if (migratedTokens) {
      logger.info('Migration verified successfully');
      logger.info('Tokens are now stored securely with encryption');
      logger.info('Token refresh will be handled automatically');
      
      // Log token expiry info
      const tokenRecord = await prisma.oAuthToken.findUnique({
        where: {
          provider_tenantId: {
            provider: 'quickbooks',
            tenantId: 'default'
          }
        },
        select: {
          expiresAt: true,
          refreshTokenExpiresAt: true
        }
      });

      if (tokenRecord) {
        logger.info(`Access token expires at: ${tokenRecord.expiresAt.toISOString()}`);
        if (tokenRecord.refreshTokenExpiresAt) {
          logger.info(`Refresh token expires at: ${tokenRecord.refreshTokenExpiresAt.toISOString()}`);
        }
      }

      logger.info('\n=== IMPORTANT ===');
      logger.info('You can now remove the following from your .env file:');
      logger.info('- QUICKBOOKS_ACCESS_TOKEN');
      logger.info('- QUICKBOOKS_REFRESH_TOKEN');
      logger.info('These are now stored securely in the database');
      logger.info('================\n');
    } else {
      logger.error('Migration verification failed');
    }

  } catch (error) {
    logger.error('Token migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    redis.disconnect();
  }
}

// Run migration
migrateTokens()
  .then(() => {
    logger.info('Token migration completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Migration script failed:', error);
    process.exit(1);
  });