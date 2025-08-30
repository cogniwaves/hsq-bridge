/**
 * Configuration Manager Service Tests
 * Comprehensive test suite for the configuration management service
 */

import { PrismaClient } from '@prisma/client';
import { ConfigurationManager } from '../../../src/services/configurationManager';
import { 
  IntegrationConfig, 
  WebhookConfiguration,
  ConfigType,
  SyncDirection,
  AuditAction,
  RiskLevel,
  HealthStatus,
  CircuitBreakerStatus,
  Platform
} from '../../../src/types/configuration.types';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import * as crypto from 'crypto';

// Mock Prisma Client
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(),
  Platform: {
    HUBSPOT: 'HUBSPOT',
    STRIPE: 'STRIPE',
    QUICKBOOKS: 'QUICKBOOKS'
  },
  ConfigType: {
    API_KEY: 'API_KEY',
    OAUTH: 'OAUTH',
    WEBHOOK: 'WEBHOOK',
    CONNECTION: 'CONNECTION'
  }
}));

describe('ConfigurationManager', () => {
  let configManager: ConfigurationManager;
  let mockPrisma: DeepMockProxy<PrismaClient>;
  const testTenantId = 'test-tenant-123';
  const testUserId = 'test-user-456';

  beforeEach(() => {
    // Setup mock Prisma client
    mockPrisma = mockDeep<PrismaClient>();
    configManager = new ConfigurationManager(mockPrisma as any);
    
    // Set environment variable for encryption
    process.env.ENCRYPTION_KEY = 'test-encryption-key-for-testing-only';
  });

  afterEach(() => {
    mockReset(mockPrisma);
    jest.clearAllMocks();
  });

  describe('Encryption/Decryption', () => {
    it('should encrypt and decrypt sensitive data correctly', () => {
      const sensitiveData = 'sk_test_secretkey123';
      
      // Access private methods via any cast
      const encrypted = (configManager as any).encrypt(sensitiveData);
      expect(encrypted.encrypted).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.encrypted).not.toBe(sensitiveData);

      const decrypted = (configManager as any).decrypt(encrypted.encrypted, encrypted.iv);
      expect(decrypted).toBe(sensitiveData);
    });

    it('should generate different IVs for same data', () => {
      const sensitiveData = 'sk_test_secretkey123';
      
      const encrypted1 = (configManager as any).encrypt(sensitiveData);
      const encrypted2 = (configManager as any).encrypt(sensitiveData);
      
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
    });

    it('should throw error with invalid decryption parameters', () => {
      expect(() => {
        (configManager as any).decrypt('invalid-data', 'invalid-iv');
      }).toThrow();
    });
  });

  describe('saveConfiguration', () => {
    it('should save a new configuration with encryption', async () => {
      const config: IntegrationConfig = {
        platform: 'HUBSPOT' as Platform,
        apiKey: 'pat-na1-test-key',
        webhookSecret: 'webhook-secret-123',
        isActive: true,
        tenantId: testTenantId,
        syncDirection: SyncDirection.BIDIRECTIONAL,
        syncFrequency: 300,
        rateLimitPerMinute: 100,
        retryAttempts: 3,
        retryDelayMs: 1000,
        timeoutMs: 30000,
        webhookUrl: 'https://api.example.com/webhooks',
        apiVersion: 'v3',
        environment: 'production'
      };

      const mockSavedConfig = {
        id: 'config-123',
        ...config,
        encryptedApiKey: 'encrypted-value',
        encryptedWebhookSecret: 'encrypted-webhook',
        iv: 'test-iv',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastHealthCheck: null,
        healthStatus: HealthStatus.HEALTHY,
        errorCount: 0,
        successCount: 0,
        lastError: null,
        circuitBreakerStatus: CircuitBreakerStatus.CLOSED,
        circuitBreakerOpenedAt: null,
        rateLimitRemaining: 100,
        rateLimitResetAt: null
      };

      mockPrisma.integrationConfiguration.create.mockResolvedValue(mockSavedConfig as any);
      mockPrisma.configurationAuditLog.create.mockResolvedValue({} as any);

      const result = await configManager.saveConfiguration(config, testUserId);

      expect(mockPrisma.integrationConfiguration.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          platform: 'HUBSPOT',
          tenantId: testTenantId,
          isActive: true,
          syncDirection: SyncDirection.BIDIRECTIONAL
        })
      });

      expect(mockPrisma.configurationAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: AuditAction.CREATE,
          platform: 'HUBSPOT',
          tenantId: testTenantId,
          userId: testUserId,
          riskLevel: RiskLevel.LOW
        })
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('platform', 'HUBSPOT');
    });

    it('should update existing configuration', async () => {
      const existingConfig = {
        id: 'existing-config-123',
        platform: 'STRIPE',
        tenantId: testTenantId
      };

      mockPrisma.integrationConfiguration.findFirst.mockResolvedValue(existingConfig as any);
      mockPrisma.integrationConfiguration.update.mockResolvedValue({
        ...existingConfig,
        isActive: false
      } as any);
      mockPrisma.configurationAuditLog.create.mockResolvedValue({} as any);

      const config: IntegrationConfig = {
        platform: 'STRIPE' as Platform,
        apiKey: 'sk_test_updated',
        isActive: false,
        tenantId: testTenantId
      };

      await configManager.saveConfiguration(config, testUserId);

      expect(mockPrisma.integrationConfiguration.update).toHaveBeenCalledWith({
        where: { id: 'existing-config-123' },
        data: expect.objectContaining({
          isActive: false
        })
      });

      expect(mockPrisma.configurationAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: AuditAction.UPDATE
        })
      });
    });

    it('should detect high-risk changes', async () => {
      const config: IntegrationConfig = {
        platform: 'QUICKBOOKS' as Platform,
        apiKey: 'new-api-key',
        tenantId: testTenantId,
        isActive: true,
        environment: 'production'
      };

      mockPrisma.integrationConfiguration.create.mockResolvedValue({} as any);
      mockPrisma.configurationAuditLog.create.mockResolvedValue({} as any);

      await configManager.saveConfiguration(config, testUserId);

      expect(mockPrisma.configurationAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          riskLevel: RiskLevel.HIGH // Production environment change is high risk
        })
      });
    });
  });

  describe('getConfiguration', () => {
    it('should retrieve and decrypt configuration', async () => {
      const encryptedConfig = {
        id: 'config-123',
        platform: 'HUBSPOT',
        tenantId: testTenantId,
        encryptedApiKey: 'encrypted:authtag',
        iv: crypto.randomBytes(16).toString('hex'),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.integrationConfiguration.findFirst.mockResolvedValue(encryptedConfig as any);

      const result = await configManager.getConfiguration('HUBSPOT' as Platform, testTenantId);

      expect(mockPrisma.integrationConfiguration.findFirst).toHaveBeenCalledWith({
        where: {
          platform: 'HUBSPOT',
          tenantId: testTenantId
        }
      });

      expect(result).toHaveProperty('platform', 'HUBSPOT');
      expect(result).toHaveProperty('tenantId', testTenantId);
    });

    it('should return null for non-existent configuration', async () => {
      mockPrisma.integrationConfiguration.findFirst.mockResolvedValue(null);

      const result = await configManager.getConfiguration('STRIPE' as Platform, testTenantId);

      expect(result).toBeNull();
    });

    it('should handle decryption errors gracefully', async () => {
      const encryptedConfig = {
        id: 'config-123',
        platform: 'HUBSPOT',
        encryptedApiKey: 'invalid-encrypted-data',
        iv: 'invalid-iv',
        isActive: true
      };

      mockPrisma.integrationConfiguration.findFirst.mockResolvedValue(encryptedConfig as any);

      const result = await configManager.getConfiguration('HUBSPOT' as Platform, testTenantId);

      expect(result).toHaveProperty('apiKey', ''); // Should return empty string on decryption failure
    });
  });

  describe('validateConfiguration', () => {
    it('should validate HubSpot configuration', async () => {
      const config: IntegrationConfig = {
        platform: 'HUBSPOT' as Platform,
        apiKey: 'pat-na1-valid-key',
        tenantId: testTenantId
      };

      // Mock HubSpot API validation
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results: [] })
      });

      const result = await configManager.validateConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.platform).toBe('HUBSPOT');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api.hubapi.com'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer pat-na1-valid-key'
          })
        })
      );
    });

    it('should validate Stripe configuration', async () => {
      const config: IntegrationConfig = {
        platform: 'STRIPE' as Platform,
        apiKey: 'sk_test_valid_key',
        tenantId: testTenantId
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ object: 'list' })
      });

      const result = await configManager.validateConfiguration(config);

      expect(result.isValid).toBe(true);
      expect(result.platform).toBe('STRIPE');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api.stripe.com'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer sk_test_valid_key'
          })
        })
      );
    });

    it('should handle validation failures', async () => {
      const config: IntegrationConfig = {
        platform: 'HUBSPOT' as Platform,
        apiKey: 'invalid-key',
        tenantId: testTenantId
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      const result = await configManager.validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('401');
    });

    it('should handle network errors during validation', async () => {
      const config: IntegrationConfig = {
        platform: 'STRIPE' as Platform,
        apiKey: 'sk_test_key',
        tenantId: testTenantId
      };

      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await configManager.validateConfiguration(config);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      const mockConfig = {
        id: 'config-123',
        platform: 'HUBSPOT',
        encryptedApiKey: 'encrypted-key',
        iv: crypto.randomBytes(16).toString('hex'),
        isActive: true,
        healthStatus: HealthStatus.HEALTHY
      };

      mockPrisma.integrationConfiguration.findFirst.mockResolvedValue(mockConfig as any);
      mockPrisma.integrationConfiguration.update.mockResolvedValue({
        ...mockConfig,
        lastHealthCheck: new Date(),
        healthStatus: HealthStatus.HEALTHY
      } as any);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      const result = await configManager.testConnection('HUBSPOT' as Platform, testTenantId);

      expect(result.success).toBe(true);
      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(mockPrisma.integrationConfiguration.update).toHaveBeenCalledWith({
        where: { id: 'config-123' },
        data: expect.objectContaining({
          lastHealthCheck: expect.any(Date),
          healthStatus: HealthStatus.HEALTHY,
          successCount: expect.any(Number)
        })
      });
    });

    it('should handle connection failures', async () => {
      const mockConfig = {
        id: 'config-123',
        platform: 'STRIPE',
        encryptedApiKey: 'encrypted-key',
        iv: crypto.randomBytes(16).toString('hex'),
        errorCount: 2
      };

      mockPrisma.integrationConfiguration.findFirst.mockResolvedValue(mockConfig as any);
      mockPrisma.integrationConfiguration.update.mockResolvedValue({
        ...mockConfig,
        healthStatus: HealthStatus.UNHEALTHY,
        errorCount: 3
      } as any);

      global.fetch = jest.fn().mockRejectedValue(new Error('Connection timeout'));

      const result = await configManager.testConnection('STRIPE' as Platform, testTenantId);

      expect(result.success).toBe(false);
      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.error).toContain('Connection timeout');
    });

    it('should trigger circuit breaker after repeated failures', async () => {
      const mockConfig = {
        id: 'config-123',
        platform: 'QUICKBOOKS',
        errorCount: 4, // One more failure will trigger circuit breaker
        circuitBreakerStatus: CircuitBreakerStatus.CLOSED
      };

      mockPrisma.integrationConfiguration.findFirst.mockResolvedValue(mockConfig as any);
      mockPrisma.integrationConfiguration.update.mockResolvedValue({
        ...mockConfig,
        errorCount: 5,
        circuitBreakerStatus: CircuitBreakerStatus.OPEN,
        circuitBreakerOpenedAt: new Date()
      } as any);

      global.fetch = jest.fn().mockRejectedValue(new Error('Service unavailable'));

      const result = await configManager.testConnection('QUICKBOOKS' as Platform, testTenantId);

      expect(mockPrisma.integrationConfiguration.update).toHaveBeenCalledWith({
        where: { id: 'config-123' },
        data: expect.objectContaining({
          circuitBreakerStatus: CircuitBreakerStatus.OPEN,
          circuitBreakerOpenedAt: expect.any(Date)
        })
      });
    });
  });

  describe('getWebhookConfiguration', () => {
    it('should retrieve webhook configuration', async () => {
      const mockWebhook = {
        id: 'webhook-123',
        platform: 'HUBSPOT',
        webhookUrl: 'https://api.example.com/webhooks',
        encryptedSecret: 'encrypted-secret',
        iv: crypto.randomBytes(16).toString('hex'),
        events: ['invoice.created', 'invoice.updated'],
        isActive: true,
        lastPing: new Date()
      };

      mockPrisma.webhookConfiguration.findFirst.mockResolvedValue(mockWebhook as any);

      const result = await configManager.getWebhookConfiguration('HUBSPOT' as Platform, testTenantId);

      expect(result).toHaveProperty('webhookUrl', 'https://api.example.com/webhooks');
      expect(result).toHaveProperty('events');
      expect(result?.events).toContain('invoice.created');
    });

    it('should return null for non-existent webhook configuration', async () => {
      mockPrisma.webhookConfiguration.findFirst.mockResolvedValue(null);

      const result = await configManager.getWebhookConfiguration('STRIPE' as Platform, testTenantId);

      expect(result).toBeNull();
    });
  });

  describe('saveWebhookConfiguration', () => {
    it('should save webhook configuration with encryption', async () => {
      const webhookConfig: WebhookConfiguration = {
        platform: 'STRIPE' as Platform,
        webhookUrl: 'https://api.example.com/stripe/webhooks',
        webhookSecret: 'whsec_test_secret',
        events: ['invoice.payment_succeeded', 'invoice.payment_failed'],
        isActive: true,
        tenantId: testTenantId,
        retryPolicy: {
          maxAttempts: 3,
          backoffMultiplier: 2,
          maxDelayMs: 60000
        }
      };

      mockPrisma.webhookConfiguration.create.mockResolvedValue({
        id: 'webhook-456',
        ...webhookConfig
      } as any);

      const result = await configManager.saveWebhookConfiguration(webhookConfig, testUserId);

      expect(mockPrisma.webhookConfiguration.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          platform: 'STRIPE',
          webhookUrl: 'https://api.example.com/stripe/webhooks',
          events: ['invoice.payment_succeeded', 'invoice.payment_failed']
        })
      });

      expect(result).toHaveProperty('platform', 'STRIPE');
    });

    it('should update existing webhook configuration', async () => {
      const existingWebhook = {
        id: 'webhook-existing',
        platform: 'HUBSPOT',
        tenantId: testTenantId
      };

      mockPrisma.webhookConfiguration.findFirst.mockResolvedValue(existingWebhook as any);
      mockPrisma.webhookConfiguration.update.mockResolvedValue({
        ...existingWebhook,
        isActive: false
      } as any);

      const webhookConfig: WebhookConfiguration = {
        platform: 'HUBSPOT' as Platform,
        webhookUrl: 'https://updated.example.com/webhooks',
        isActive: false,
        tenantId: testTenantId
      };

      await configManager.saveWebhookConfiguration(webhookConfig, testUserId);

      expect(mockPrisma.webhookConfiguration.update).toHaveBeenCalled();
    });
  });

  describe('getAuditLogs', () => {
    it('should retrieve audit logs with filters', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          action: AuditAction.CREATE,
          platform: 'HUBSPOT',
          tenantId: testTenantId,
          userId: testUserId,
          createdAt: new Date(),
          metadata: { field: 'apiKey' }
        },
        {
          id: 'log-2',
          action: AuditAction.UPDATE,
          platform: 'HUBSPOT',
          tenantId: testTenantId,
          userId: testUserId,
          createdAt: new Date(),
          metadata: { field: 'isActive' }
        }
      ];

      mockPrisma.configurationAuditLog.findMany.mockResolvedValue(mockLogs as any);

      const result = await configManager.getAuditLogs({
        tenantId: testTenantId,
        platform: 'HUBSPOT' as Platform,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        limit: 10
      });

      expect(mockPrisma.configurationAuditLog.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: testTenantId,
          platform: 'HUBSPOT',
          createdAt: {
            gte: expect.any(Date),
            lte: expect.any(Date)
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('action', AuditAction.CREATE);
    });

    it('should filter by action type', async () => {
      mockPrisma.configurationAuditLog.findMany.mockResolvedValue([]);

      await configManager.getAuditLogs({
        tenantId: testTenantId,
        action: AuditAction.DELETE
      });

      expect(mockPrisma.configurationAuditLog.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          action: AuditAction.DELETE
        }),
        orderBy: { createdAt: 'desc' },
        take: 100
      });
    });

    it('should filter by risk level', async () => {
      mockPrisma.configurationAuditLog.findMany.mockResolvedValue([]);

      await configManager.getAuditLogs({
        tenantId: testTenantId,
        riskLevel: RiskLevel.HIGH
      });

      expect(mockPrisma.configurationAuditLog.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          riskLevel: RiskLevel.HIGH
        }),
        orderBy: { createdAt: 'desc' },
        take: 100
      });
    });
  });

  describe('deleteConfiguration', () => {
    it('should soft delete configuration', async () => {
      const mockConfig = {
        id: 'config-to-delete',
        platform: 'HUBSPOT',
        tenantId: testTenantId,
        isActive: true
      };

      mockPrisma.integrationConfiguration.findFirst.mockResolvedValue(mockConfig as any);
      mockPrisma.integrationConfiguration.update.mockResolvedValue({
        ...mockConfig,
        isActive: false,
        deletedAt: new Date()
      } as any);
      mockPrisma.configurationAuditLog.create.mockResolvedValue({} as any);

      const result = await configManager.deleteConfiguration('HUBSPOT' as Platform, testTenantId, testUserId);

      expect(result).toBe(true);
      expect(mockPrisma.integrationConfiguration.update).toHaveBeenCalledWith({
        where: { id: 'config-to-delete' },
        data: expect.objectContaining({
          isActive: false,
          deletedAt: expect.any(Date)
        })
      });

      expect(mockPrisma.configurationAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: AuditAction.DELETE,
          riskLevel: RiskLevel.HIGH
        })
      });
    });

    it('should return false for non-existent configuration', async () => {
      mockPrisma.integrationConfiguration.findFirst.mockResolvedValue(null);

      const result = await configManager.deleteConfiguration('STRIPE' as Platform, testTenantId, testUserId);

      expect(result).toBe(false);
      expect(mockPrisma.integrationConfiguration.update).not.toHaveBeenCalled();
    });
  });

  describe('Circuit Breaker', () => {
    it('should check circuit breaker status', async () => {
      const mockConfig = {
        id: 'config-123',
        circuitBreakerStatus: CircuitBreakerStatus.OPEN,
        circuitBreakerOpenedAt: new Date(Date.now() - 30000) // 30 seconds ago
      };

      mockPrisma.integrationConfiguration.findFirst.mockResolvedValue(mockConfig as any);

      const isOpen = await (configManager as any).isCircuitBreakerOpen('HUBSPOT', testTenantId);

      expect(isOpen).toBe(true);
    });

    it('should auto-close circuit breaker after cooldown', async () => {
      const mockConfig = {
        id: 'config-123',
        circuitBreakerStatus: CircuitBreakerStatus.OPEN,
        circuitBreakerOpenedAt: new Date(Date.now() - 65000) // 65 seconds ago (past 60s cooldown)
      };

      mockPrisma.integrationConfiguration.findFirst.mockResolvedValue(mockConfig as any);
      mockPrisma.integrationConfiguration.update.mockResolvedValue({
        ...mockConfig,
        circuitBreakerStatus: CircuitBreakerStatus.HALF_OPEN
      } as any);

      const isOpen = await (configManager as any).isCircuitBreakerOpen('HUBSPOT', testTenantId);

      expect(isOpen).toBe(false);
      expect(mockPrisma.integrationConfiguration.update).toHaveBeenCalledWith({
        where: { id: 'config-123' },
        data: expect.objectContaining({
          circuitBreakerStatus: CircuitBreakerStatus.HALF_OPEN
        })
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should check rate limit status', async () => {
      const mockConfig = {
        id: 'config-123',
        rateLimitPerMinute: 100,
        rateLimitRemaining: 50,
        rateLimitResetAt: new Date(Date.now() + 30000) // 30 seconds in future
      };

      mockPrisma.integrationConfiguration.findFirst.mockResolvedValue(mockConfig as any);

      const status = await configManager.getRateLimitStatus('HUBSPOT' as Platform, testTenantId);

      expect(status).toHaveProperty('limit', 100);
      expect(status).toHaveProperty('remaining', 50);
      expect(status).toHaveProperty('resetAt');
    });

    it('should update rate limit after API call', async () => {
      const mockConfig = {
        id: 'config-123',
        rateLimitPerMinute: 100,
        rateLimitRemaining: 50
      };

      mockPrisma.integrationConfiguration.findFirst.mockResolvedValue(mockConfig as any);
      mockPrisma.integrationConfiguration.update.mockResolvedValue({
        ...mockConfig,
        rateLimitRemaining: 49
      } as any);

      await (configManager as any).updateRateLimit('HUBSPOT', testTenantId, 49);

      expect(mockPrisma.integrationConfiguration.update).toHaveBeenCalledWith({
        where: { id: 'config-123' },
        data: expect.objectContaining({
          rateLimitRemaining: 49
        })
      });
    });
  });

  describe('Bulk Operations', () => {
    it('should retrieve all configurations for a tenant', async () => {
      const mockConfigs = [
        { id: '1', platform: 'HUBSPOT', tenantId: testTenantId },
        { id: '2', platform: 'STRIPE', tenantId: testTenantId },
        { id: '3', platform: 'QUICKBOOKS', tenantId: testTenantId }
      ];

      mockPrisma.integrationConfiguration.findMany.mockResolvedValue(mockConfigs as any);

      const configs = await configManager.getAllConfigurations(testTenantId);

      expect(configs).toHaveLength(3);
      expect(mockPrisma.integrationConfiguration.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: testTenantId,
          deletedAt: null
        }
      });
    });

    it('should export configuration for backup', async () => {
      const mockConfig = {
        id: 'config-123',
        platform: 'HUBSPOT',
        tenantId: testTenantId,
        encryptedApiKey: 'encrypted',
        iv: 'test-iv',
        webhookUrl: 'https://api.example.com',
        syncDirection: SyncDirection.BIDIRECTIONAL,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.integrationConfiguration.findFirst.mockResolvedValue(mockConfig as any);

      const exported = await configManager.exportConfiguration('HUBSPOT' as Platform, testTenantId);

      expect(exported).toHaveProperty('platform', 'HUBSPOT');
      expect(exported).toHaveProperty('exportedAt');
      expect(exported).not.toHaveProperty('encryptedApiKey'); // Should not export encrypted data
    });
  });
});