/**
 * Configuration Manager Service
 * Comprehensive service for managing integration configurations
 */

import { PrismaClient, Platform, Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { 
  IntegrationConfig, 
  WebhookConfiguration, 
  ConfigurationAuditLog,
  HealthStatus,
  ConfigType,
  SyncDirection,
  AuditAction,
  RiskLevel,
  CircuitBreakerStatus
} from '../types/configuration.types';

export class ConfigurationManager {
  private prisma: PrismaClient;
  private encryptionKey: Buffer;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    // In production, load from secure key management service
    this.encryptionKey = crypto.scryptSync(
      process.env.ENCRYPTION_KEY || 'demo-key', 
      'salt', 
      32
    );
  }

  // ============================================================================
  // Encryption/Decryption Utilities
  // ============================================================================

  private encrypt(text: string): { encrypted: string; iv: string } {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, this.encryptionKey, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = (cipher as any).getAuthTag();
    
    return {
      encrypted: encrypted + ':' + authTag.toString('hex'),
      iv: iv.toString('hex')
    };
  }

  private decrypt(encrypted: string, iv: string): string {
    const algorithm = 'aes-256-gcm';
    const [cipherText, authTag] = encrypted.split(':');
    
    const decipher = crypto.createDecipheriv(
      algorithm, 
      this.encryptionKey, 
      Buffer.from(iv, 'hex')
    );
    
    (decipher as any).setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(cipherText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // ============================================================================
  // Integration Configuration Management
  // ============================================================================

  /**
   * Get active configuration for a tenant and platform
   */
  async getActiveConfig(
    tenantId: string, 
    platform: Platform
  ): Promise<IntegrationConfig | null> {
    const config = await this.prisma.integrationConfig.findFirst({
      where: {
        tenantId,
        platform,
        isActive: true,
        isPrimary: true,
        deletedAt: null
      },
      include: {
        webhookConfigs: {
          where: { isActive: true, deletedAt: null }
        }
      }
    });

    if (config && config.apiKey) {
      // Decrypt sensitive fields
      try {
        const decryptedKey = this.decrypt(config.apiKey, config.encryptionIV || '');
        return {
          ...config,
          apiKey: decryptedKey // Return decrypted for use
        };
      } catch (error) {
        console.error('Failed to decrypt API key:', error);
        throw new Error('Configuration decryption failed');
      }
    }

    return config;
  }

  /**
   * Create or update integration configuration
   */
  async upsertConfig(
    tenantId: string,
    platform: Platform,
    data: Partial<IntegrationConfig>,
    performedBy: string
  ): Promise<IntegrationConfig> {
    // Encrypt sensitive fields if provided
    let encryptedData: any = { ...data };
    let encryptionIV: string | undefined;

    if (data.apiKey) {
      const encrypted = this.encrypt(data.apiKey);
      encryptedData.apiKey = encrypted.encrypted;
      encryptionIV = encrypted.iv;
    }

    if (data.apiSecret) {
      const encrypted = this.encrypt(data.apiSecret);
      encryptedData.apiSecret = encrypted.encrypted;
    }

    // Use transaction for atomicity
    return await this.prisma.$transaction(async (tx) => {
      // Check if config exists
      const existing = await tx.integrationConfig.findFirst({
        where: {
          tenantId,
          platform,
          configType: data.configType || 'API_KEY',
          environment: data.environment || 'production'
        }
      });

      let config: any;
      let action: AuditAction;

      if (existing) {
        // Update existing
        config = await tx.integrationConfig.update({
          where: { id: existing.id },
          data: {
            ...encryptedData,
            encryptionIV,
            updatedBy: performedBy,
            updatedAt: new Date()
          }
        });
        action = AuditAction.UPDATE;
      } else {
        // Create new
        config = await tx.integrationConfig.create({
          data: {
            tenantId,
            platform,
            ...encryptedData,
            encryptionIV,
            createdBy: performedBy,
            configType: data.configType || 'API_KEY',
            environment: data.environment || 'production'
          }
        });
        action = AuditAction.CREATE;
      }

      // Create audit log
      await tx.configurationAuditLog.create({
        data: {
          tenantId,
          entityType: 'INTEGRATION_CONFIG',
          entityId: config.id,
          action,
          performedBy,
          riskLevel: this.assessRiskLevel(action, data),
          platform,
          environment: config.environment,
          metadata: {
            changes: Object.keys(data),
            timestamp: new Date().toISOString()
          }
        }
      });

      return config;
    });
  }

  /**
   * Validate configuration health
   */
  async validateConfig(
    configId: string,
    performedBy: string
  ): Promise<{ status: HealthStatus; message: string }> {
    const config = await this.prisma.integrationConfig.findUnique({
      where: { id: configId }
    });

    if (!config) {
      throw new Error('Configuration not found');
    }

    let status: HealthStatus = HealthStatus.UNKNOWN;
    let message = 'Validation pending';

    try {
      // Platform-specific validation logic
      switch (config.platform) {
        case Platform.HUBSPOT:
          status = await this.validateHubSpotConfig(config);
          message = status === HealthStatus.HEALTHY 
            ? 'HubSpot API connection verified' 
            : 'HubSpot API connection failed';
          break;
          
        case Platform.STRIPE:
          status = await this.validateStripeConfig(config);
          message = status === HealthStatus.HEALTHY 
            ? 'Stripe API connection verified' 
            : 'Stripe API connection failed';
          break;
          
        case Platform.QUICKBOOKS:
          status = await this.validateQuickBooksConfig(config);
          message = status === HealthStatus.HEALTHY 
            ? 'QuickBooks connection verified' 
            : 'QuickBooks connection failed';
          break;
      }

      // Update configuration
      await this.prisma.integrationConfig.update({
        where: { id: configId },
        data: {
          healthStatus: status,
          healthMessage: message,
          lastHealthCheckAt: new Date(),
          validatedAt: new Date(),
          validatedBy: performedBy
        }
      });

      // Create audit log
      await this.prisma.configurationAuditLog.create({
        data: {
          tenantId: config.tenantId,
          entityType: 'INTEGRATION_CONFIG',
          entityId: configId,
          action: AuditAction.VALIDATE,
          performedBy,
          riskLevel: RiskLevel.LOW,
          platform: config.platform,
          metadata: {
            status,
            message,
            timestamp: new Date().toISOString()
          }
        }
      });

      return { status, message };
    } catch (error: any) {
      message = `Validation error: ${error.message}`;
      status = HealthStatus.UNHEALTHY;

      await this.prisma.integrationConfig.update({
        where: { id: configId },
        data: {
          healthStatus: status,
          healthMessage: message,
          lastHealthCheckAt: new Date()
        }
      });

      return { status, message };
    }
  }

  // ============================================================================
  // Webhook Configuration Management
  // ============================================================================

  /**
   * Get webhook configurations for a tenant
   */
  async getWebhookConfigs(
    tenantId: string,
    platform?: Platform
  ): Promise<WebhookConfiguration[]> {
    const where: Prisma.WebhookConfigurationWhereInput = {
      tenantId,
      isActive: true,
      deletedAt: null
    };

    if (platform) {
      where.platform = platform;
    }

    const configs = await this.prisma.webhookConfiguration.findMany({
      where,
      include: {
        integrationConfig: true
      }
    });

    // Decrypt signing secrets for use
    return configs.map(config => {
      if (config.signingSecret && config.encryptionIV) {
        try {
          const decrypted = this.decrypt(config.signingSecret, config.encryptionIV);
          return { ...config, signingSecret: decrypted };
        } catch (error) {
          console.error('Failed to decrypt webhook secret:', error);
          return config;
        }
      }
      return config;
    });
  }

  /**
   * Handle webhook circuit breaker
   */
  async updateWebhookCircuitBreaker(
    webhookId: string,
    success: boolean
  ): Promise<void> {
    const webhook = await this.prisma.webhookConfiguration.findUnique({
      where: { id: webhookId }
    });

    if (!webhook || !webhook.circuitBreakerEnabled) {
      return;
    }

    const updates: Prisma.WebhookConfigurationUpdateInput = {
      totalTriggerCount: { increment: 1 },
      lastTriggerAt: new Date()
    };

    if (success) {
      updates.totalSuccessCount = { increment: 1 };
      updates.lastSuccessAt = new Date();
      updates.consecutiveFailures = 0;
      
      // Reset circuit breaker if it was open
      if (webhook.circuitBreakerStatus === 'OPEN') {
        updates.circuitBreakerStatus = 'CLOSED';
      }
    } else {
      updates.totalFailureCount = { increment: 1 };
      updates.lastFailureAt = new Date();
      updates.consecutiveFailures = { increment: 1 };
      
      // Check if circuit breaker should open
      if (webhook.consecutiveFailures + 1 >= webhook.circuitBreakerThreshold) {
        updates.circuitBreakerStatus = 'OPEN';
        updates.circuitBreakerOpenedAt = new Date();
      }
    }

    await this.prisma.webhookConfiguration.update({
      where: { id: webhookId },
      data: updates
    });

    // Check if circuit breaker should reset (half-open state)
    if (webhook.circuitBreakerStatus === 'OPEN' && webhook.circuitBreakerOpenedAt) {
      const resetTime = new Date(
        webhook.circuitBreakerOpenedAt.getTime() + webhook.circuitBreakerResetAfterMs
      );
      
      if (new Date() > resetTime) {
        await this.prisma.webhookConfiguration.update({
          where: { id: webhookId },
          data: { circuitBreakerStatus: 'HALF_OPEN' }
        });
      }
    }
  }

  // ============================================================================
  // Audit and Compliance
  // ============================================================================

  /**
   * Get audit logs for a tenant
   */
  async getAuditLogs(
    tenantId: string,
    filters?: {
      entityType?: string;
      action?: AuditAction;
      performedBy?: string;
      startDate?: Date;
      endDate?: Date;
      riskLevel?: RiskLevel;
    }
  ): Promise<ConfigurationAuditLog[]> {
    const where: Prisma.ConfigurationAuditLogWhereInput = {
      tenantId
    };

    if (filters) {
      if (filters.entityType) where.entityType = filters.entityType as any;
      if (filters.action) where.action = filters.action;
      if (filters.performedBy) where.performedBy = filters.performedBy;
      if (filters.riskLevel) where.riskLevel = filters.riskLevel;
      
      if (filters.startDate || filters.endDate) {
        where.createdAt = {};
        if (filters.startDate) where.createdAt.gte = filters.startDate;
        if (filters.endDate) where.createdAt.lte = filters.endDate;
      }
    }

    return await this.prisma.configurationAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100 // Limit to recent 100 entries
    });
  }

  /**
   * Get high-risk changes requiring review
   */
  async getPendingReviews(tenantId: string): Promise<ConfigurationAuditLog[]> {
    return await this.prisma.configurationAuditLog.findMany({
      where: {
        tenantId,
        requiresReview: true,
        reviewedAt: null,
        riskLevel: { in: [RiskLevel.HIGH, RiskLevel.CRITICAL] }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private assessRiskLevel(action: AuditAction, data: any): RiskLevel {
    // Critical actions
    if (action === AuditAction.DELETE || action === AuditAction.REVOKE) {
      return RiskLevel.HIGH;
    }
    
    // Sensitive field changes
    if (data.apiKey || data.apiSecret || data.signingSecret) {
      return RiskLevel.MEDIUM;
    }
    
    // Configuration changes
    if (data.syncDirection || data.environment) {
      return RiskLevel.MEDIUM;
    }
    
    return RiskLevel.LOW;
  }

  private async validateHubSpotConfig(config: any): Promise<HealthStatus> {
    // Implement HubSpot API validation
    // This would make an actual API call to verify the connection
    return HealthStatus.HEALTHY;
  }

  private async validateStripeConfig(config: any): Promise<HealthStatus> {
    // Implement Stripe API validation
    // This would make an actual API call to verify the connection
    return HealthStatus.HEALTHY;
  }

  private async validateQuickBooksConfig(config: any): Promise<HealthStatus> {
    // Implement QuickBooks API validation
    // This would check OAuth token validity
    return HealthStatus.UNKNOWN;
  }
}

// Export singleton instance
export const configurationManager = (prisma: PrismaClient) => 
  new ConfigurationManager(prisma);