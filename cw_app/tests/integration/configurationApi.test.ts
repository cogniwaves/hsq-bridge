/**
 * Configuration API Integration Tests
 * Comprehensive test suite for configuration API endpoints
 */

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { ConfigurationManager } from '../../src/services/configurationManager';
import { 
  Platform, 
  ConfigType,
  SyncDirection,
  HealthStatus,
  AuditAction,
  RiskLevel
} from '../../src/types/configuration.types';

// Mock dependencies
jest.mock('../../src/services/configurationManager');
jest.mock('jsonwebtoken');

describe('Configuration API Endpoints', () => {
  let app: express.Application;
  let mockConfigManager: jest.Mocked<ConfigurationManager>;
  let mockPrisma: PrismaClient;
  
  const testToken = 'valid-jwt-token';
  const testTenantId = 'test-tenant-123';
  const testUserId = 'test-user-456';

  beforeEach(() => {
    // Setup Express app with middleware
    app = express();
    app.use(express.json());
    
    // Mock JWT verification
    (jwt.verify as jest.Mock).mockReturnValue({
      tenantId: testTenantId,
      userId: testUserId,
      roles: ['admin']
    });

    // Mock ConfigurationManager
    mockConfigManager = {
      saveConfiguration: jest.fn(),
      getConfiguration: jest.fn(),
      validateConfiguration: jest.fn(),
      testConnection: jest.fn(),
      deleteConfiguration: jest.fn(),
      getAllConfigurations: jest.fn(),
      getWebhookConfiguration: jest.fn(),
      saveWebhookConfiguration: jest.fn(),
      getAuditLogs: jest.fn(),
      exportConfiguration: jest.fn(),
      importConfiguration: jest.fn(),
      getRateLimitStatus: jest.fn()
    } as any;

    // Setup routes (simplified version - in real app these would be imported)
    setupConfigurationRoutes(app, mockConfigManager);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/config/:platform', () => {
    it('should retrieve configuration for a platform', async () => {
      const mockConfig = {
        id: 'config-123',
        platform: 'HUBSPOT',
        apiKey: 'decrypted-key',
        isActive: true,
        tenantId: testTenantId
      };

      mockConfigManager.getConfiguration.mockResolvedValue(mockConfig);

      const response = await request(app)
        .get('/api/config/hubspot')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('platform', 'HUBSPOT');
      expect(mockConfigManager.getConfiguration).toHaveBeenCalledWith('HUBSPOT', testTenantId);
    });

    it('should return 404 for non-existent configuration', async () => {
      mockConfigManager.getConfiguration.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/config/stripe')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Configuration not found');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/config/hubspot');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Authentication required');
    });

    it('should validate platform parameter', async () => {
      const response = await request(app)
        .get('/api/config/invalid-platform')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid platform');
    });
  });

  describe('POST /api/config/:platform', () => {
    it('should save new configuration', async () => {
      const configData = {
        apiKey: 'pat-na1-test-key',
        webhookSecret: 'webhook-secret',
        isActive: true,
        syncDirection: SyncDirection.BIDIRECTIONAL,
        syncFrequency: 300
      };

      const savedConfig = {
        id: 'new-config-123',
        platform: 'HUBSPOT',
        ...configData,
        tenantId: testTenantId
      };

      mockConfigManager.saveConfiguration.mockResolvedValue(savedConfig);

      const response = await request(app)
        .post('/api/config/hubspot')
        .set('Authorization', `Bearer ${testToken}`)
        .send(configData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id', 'new-config-123');
      expect(mockConfigManager.saveConfiguration).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: 'HUBSPOT',
          apiKey: 'pat-na1-test-key',
          tenantId: testTenantId
        }),
        testUserId
      );
    });

    it('should validate required fields', async () => {
      const invalidConfig = {
        // Missing required apiKey
        isActive: true
      };

      const response = await request(app)
        .post('/api/config/stripe')
        .set('Authorization', `Bearer ${testToken}`)
        .send(invalidConfig);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('apiKey is required');
    });

    it('should validate API key format', async () => {
      const configData = {
        apiKey: 'invalid-format-key',
        isActive: true
      };

      const response = await request(app)
        .post('/api/config/stripe')
        .set('Authorization', `Bearer ${testToken}`)
        .send(configData);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid Stripe API key format');
    });

    it('should handle save errors', async () => {
      mockConfigManager.saveConfiguration.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/config/hubspot')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ apiKey: 'valid-key' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Failed to save configuration');
    });
  });

  describe('POST /api/config/:platform/validate', () => {
    it('should validate configuration successfully', async () => {
      const configData = {
        apiKey: 'sk_test_valid_key',
        webhookSecret: 'whsec_secret'
      };

      mockConfigManager.validateConfiguration.mockResolvedValue({
        isValid: true,
        platform: 'STRIPE',
        message: 'Configuration is valid'
      });

      const response = await request(app)
        .post('/api/config/stripe/validate')
        .set('Authorization', `Bearer ${testToken}`)
        .send(configData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('isValid', true);
    });

    it('should return validation errors', async () => {
      mockConfigManager.validateConfiguration.mockResolvedValue({
        isValid: false,
        platform: 'HUBSPOT',
        error: 'Invalid API key: 401 Unauthorized'
      });

      const response = await request(app)
        .post('/api/config/hubspot/validate')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ apiKey: 'invalid-key' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('isValid', false);
      expect(response.body.data).toHaveProperty('error');
    });
  });

  describe('POST /api/config/:platform/test', () => {
    it('should test connection successfully', async () => {
      mockConfigManager.testConnection.mockResolvedValue({
        success: true,
        status: HealthStatus.HEALTHY,
        responseTime: 250,
        message: 'Connection successful'
      });

      const response = await request(app)
        .post('/api/config/hubspot/test')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('status', HealthStatus.HEALTHY);
      expect(response.body.data).toHaveProperty('responseTime', 250);
    });

    it('should report connection failures', async () => {
      mockConfigManager.testConnection.mockResolvedValue({
        success: false,
        status: HealthStatus.UNHEALTHY,
        error: 'Connection timeout',
        responseTime: 30000
      });

      const response = await request(app)
        .post('/api/config/stripe/test')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('success', false);
      expect(response.body.data).toHaveProperty('error', 'Connection timeout');
    });

    it('should handle circuit breaker status', async () => {
      mockConfigManager.testConnection.mockResolvedValue({
        success: false,
        status: HealthStatus.DEGRADED,
        error: 'Circuit breaker is open',
        circuitBreakerStatus: 'OPEN'
      });

      const response = await request(app)
        .post('/api/config/quickbooks/test')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.body.data).toHaveProperty('circuitBreakerStatus', 'OPEN');
    });
  });

  describe('DELETE /api/config/:platform', () => {
    it('should delete configuration', async () => {
      mockConfigManager.deleteConfiguration.mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/config/hubspot')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Configuration deleted successfully');
      expect(mockConfigManager.deleteConfiguration).toHaveBeenCalledWith(
        'HUBSPOT',
        testTenantId,
        testUserId
      );
    });

    it('should return 404 for non-existent configuration', async () => {
      mockConfigManager.deleteConfiguration.mockResolvedValue(false);

      const response = await request(app)
        .delete('/api/config/stripe')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Configuration not found');
    });

    it('should require admin role', async () => {
      (jwt.verify as jest.Mock).mockReturnValue({
        tenantId: testTenantId,
        userId: testUserId,
        roles: ['user'] // Not admin
      });

      const response = await request(app)
        .delete('/api/config/hubspot')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Insufficient permissions');
    });
  });

  describe('GET /api/config', () => {
    it('should retrieve all configurations', async () => {
      const mockConfigs = [
        { id: '1', platform: 'HUBSPOT', isActive: true },
        { id: '2', platform: 'STRIPE', isActive: true },
        { id: '3', platform: 'QUICKBOOKS', isActive: false }
      ];

      mockConfigManager.getAllConfigurations.mockResolvedValue(mockConfigs);

      const response = await request(app)
        .get('/api/config')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(3);
      expect(mockConfigManager.getAllConfigurations).toHaveBeenCalledWith(testTenantId);
    });

    it('should filter by active status', async () => {
      const activeConfigs = [
        { id: '1', platform: 'HUBSPOT', isActive: true },
        { id: '2', platform: 'STRIPE', isActive: true }
      ];

      mockConfigManager.getAllConfigurations.mockResolvedValue(activeConfigs);

      const response = await request(app)
        .get('/api/config?active=true')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.every((c: any) => c.isActive)).toBe(true);
    });
  });

  describe('Webhook Configuration Endpoints', () => {
    describe('GET /api/config/:platform/webhook', () => {
      it('should retrieve webhook configuration', async () => {
        const mockWebhook = {
          id: 'webhook-123',
          platform: 'STRIPE',
          webhookUrl: 'https://api.example.com/webhooks',
          events: ['invoice.created', 'invoice.updated'],
          isActive: true
        };

        mockConfigManager.getWebhookConfiguration.mockResolvedValue(mockWebhook);

        const response = await request(app)
          .get('/api/config/stripe/webhook')
          .set('Authorization', `Bearer ${testToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveProperty('webhookUrl');
        expect(response.body.data.events).toContain('invoice.created');
      });
    });

    describe('POST /api/config/:platform/webhook', () => {
      it('should save webhook configuration', async () => {
        const webhookData = {
          webhookUrl: 'https://api.example.com/hubspot/webhooks',
          webhookSecret: 'secret-123',
          events: ['deal.created', 'deal.updated'],
          isActive: true
        };

        const savedWebhook = {
          id: 'webhook-456',
          platform: 'HUBSPOT',
          ...webhookData
        };

        mockConfigManager.saveWebhookConfiguration.mockResolvedValue(savedWebhook);

        const response = await request(app)
          .post('/api/config/hubspot/webhook')
          .set('Authorization', `Bearer ${testToken}`)
          .send(webhookData);

        expect(response.status).toBe(201);
        expect(response.body.data).toHaveProperty('id', 'webhook-456');
      });

      it('should validate webhook URL format', async () => {
        const invalidWebhook = {
          webhookUrl: 'not-a-valid-url',
          events: ['invoice.created']
        };

        const response = await request(app)
          .post('/api/config/stripe/webhook')
          .set('Authorization', `Bearer ${testToken}`)
          .send(invalidWebhook);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid webhook URL');
      });
    });
  });

  describe('Audit Log Endpoints', () => {
    describe('GET /api/config/audit', () => {
      it('should retrieve audit logs', async () => {
        const mockLogs = [
          {
            id: 'log-1',
            action: AuditAction.CREATE,
            platform: 'HUBSPOT',
            userId: testUserId,
            createdAt: new Date(),
            metadata: { field: 'apiKey' },
            riskLevel: RiskLevel.HIGH
          },
          {
            id: 'log-2',
            action: AuditAction.UPDATE,
            platform: 'STRIPE',
            userId: testUserId,
            createdAt: new Date(),
            metadata: { field: 'isActive' },
            riskLevel: RiskLevel.LOW
          }
        ];

        mockConfigManager.getAuditLogs.mockResolvedValue(mockLogs);

        const response = await request(app)
          .get('/api/config/audit')
          .set('Authorization', `Bearer ${testToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(2);
        expect(mockConfigManager.getAuditLogs).toHaveBeenCalledWith(
          expect.objectContaining({ tenantId: testTenantId })
        );
      });

      it('should filter audit logs by platform', async () => {
        mockConfigManager.getAuditLogs.mockResolvedValue([]);

        const response = await request(app)
          .get('/api/config/audit?platform=hubspot')
          .set('Authorization', `Bearer ${testToken}`);

        expect(mockConfigManager.getAuditLogs).toHaveBeenCalledWith(
          expect.objectContaining({
            platform: 'HUBSPOT'
          })
        );
      });

      it('should filter by date range', async () => {
        mockConfigManager.getAuditLogs.mockResolvedValue([]);

        const response = await request(app)
          .get('/api/config/audit?startDate=2024-01-01&endDate=2024-12-31')
          .set('Authorization', `Bearer ${testToken}`);

        expect(mockConfigManager.getAuditLogs).toHaveBeenCalledWith(
          expect.objectContaining({
            startDate: expect.any(Date),
            endDate: expect.any(Date)
          })
        );
      });

      it('should filter by risk level', async () => {
        mockConfigManager.getAuditLogs.mockResolvedValue([]);

        const response = await request(app)
          .get('/api/config/audit?riskLevel=HIGH')
          .set('Authorization', `Bearer ${testToken}`);

        expect(mockConfigManager.getAuditLogs).toHaveBeenCalledWith(
          expect.objectContaining({
            riskLevel: RiskLevel.HIGH
          })
        );
      });
    });
  });

  describe('Export/Import Endpoints', () => {
    describe('GET /api/config/:platform/export', () => {
      it('should export configuration', async () => {
        const exportedConfig = {
          platform: 'HUBSPOT',
          webhookUrl: 'https://api.example.com',
          syncDirection: SyncDirection.BIDIRECTIONAL,
          exportedAt: new Date().toISOString(),
          version: '1.0.0'
        };

        mockConfigManager.exportConfiguration.mockResolvedValue(exportedConfig);

        const response = await request(app)
          .get('/api/config/hubspot/export')
          .set('Authorization', `Bearer ${testToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveProperty('exportedAt');
        expect(response.body.data).not.toHaveProperty('apiKey'); // Should not export sensitive data
      });
    });

    describe('POST /api/config/:platform/import', () => {
      it('should import configuration', async () => {
        const importData = {
          webhookUrl: 'https://api.example.com',
          syncDirection: SyncDirection.BIDIRECTIONAL,
          syncFrequency: 300,
          version: '1.0.0'
        };

        mockConfigManager.importConfiguration.mockResolvedValue({
          id: 'imported-123',
          platform: 'STRIPE',
          ...importData
        });

        const response = await request(app)
          .post('/api/config/stripe/import')
          .set('Authorization', `Bearer ${testToken}`)
          .send(importData);

        expect(response.status).toBe(201);
        expect(response.body.data).toHaveProperty('id', 'imported-123');
      });

      it('should validate import data version', async () => {
        const oldVersionData = {
          version: '0.1.0', // Incompatible version
          webhookUrl: 'https://api.example.com'
        };

        const response = await request(app)
          .post('/api/config/hubspot/import')
          .set('Authorization', `Bearer ${testToken}`)
          .send(oldVersionData);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Incompatible version');
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should return rate limit headers', async () => {
      mockConfigManager.getRateLimitStatus.mockResolvedValue({
        limit: 100,
        remaining: 75,
        resetAt: new Date(Date.now() + 60000)
      });

      mockConfigManager.getConfiguration.mockResolvedValue({
        id: 'config-123',
        platform: 'HUBSPOT'
      });

      const response = await request(app)
        .get('/api/config/hubspot')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.headers).toHaveProperty('x-ratelimit-limit', '100');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining', '75');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    });

    it('should return 429 when rate limited', async () => {
      mockConfigManager.getRateLimitStatus.mockResolvedValue({
        limit: 100,
        remaining: 0,
        resetAt: new Date(Date.now() + 60000)
      });

      const response = await request(app)
        .get('/api/config/stripe')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(429);
      expect(response.body).toHaveProperty('error', 'Rate limit exceeded');
    });
  });

  describe('OAuth Flow Endpoints', () => {
    describe('GET /api/config/:platform/oauth/authorize', () => {
      it('should initiate OAuth flow', async () => {
        const response = await request(app)
          .get('/api/config/quickbooks/oauth/authorize')
          .set('Authorization', `Bearer ${testToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveProperty('authorizationUrl');
        expect(response.body.data).toHaveProperty('state');
        expect(response.body.data.authorizationUrl).toContain('appcenter.intuit.com');
      });

      it('should include PKCE challenge for supported platforms', async () => {
        const response = await request(app)
          .get('/api/config/quickbooks/oauth/authorize')
          .set('Authorization', `Bearer ${testToken}`);

        expect(response.body.data).toHaveProperty('codeChallenge');
        expect(response.body.data).toHaveProperty('codeChallengeMethod', 'S256');
      });
    });

    describe('POST /api/config/:platform/oauth/callback', () => {
      it('should handle OAuth callback', async () => {
        const callbackData = {
          code: 'auth-code-123',
          state: 'state-123',
          codeVerifier: 'verifier-123'
        };

        mockConfigManager.saveConfiguration.mockResolvedValue({
          id: 'oauth-config-123',
          platform: 'QUICKBOOKS',
          isActive: true
        });

        const response = await request(app)
          .post('/api/config/quickbooks/oauth/callback')
          .set('Authorization', `Bearer ${testToken}`)
          .send(callbackData);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
      });

      it('should validate state parameter', async () => {
        const callbackData = {
          code: 'auth-code-123',
          state: 'invalid-state'
        };

        const response = await request(app)
          .post('/api/config/quickbooks/oauth/callback')
          .set('Authorization', `Bearer ${testToken}`)
          .send(callbackData);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid state');
      });
    });

    describe('POST /api/config/:platform/oauth/refresh', () => {
      it('should refresh OAuth tokens', async () => {
        mockConfigManager.getConfiguration.mockResolvedValue({
          id: 'config-123',
          platform: 'QUICKBOOKS',
          refreshToken: 'refresh-token-123'
        });

        mockConfigManager.saveConfiguration.mockResolvedValue({
          id: 'config-123',
          platform: 'QUICKBOOKS',
          accessToken: 'new-access-token'
        });

        const response = await request(app)
          .post('/api/config/quickbooks/oauth/refresh')
          .set('Authorization', `Bearer ${testToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('message', 'Token refreshed successfully');
      });

      it('should handle refresh failures', async () => {
        mockConfigManager.getConfiguration.mockResolvedValue({
          id: 'config-123',
          platform: 'QUICKBOOKS',
          refreshToken: 'expired-refresh-token'
        });

        // Mock refresh failure
        mockConfigManager.saveConfiguration.mockRejectedValue(new Error('Refresh token expired'));

        const response = await request(app)
          .post('/api/config/quickbooks/oauth/refresh')
          .set('Authorization', `Bearer ${testToken}`);

        expect(response.status).toBe(500);
        expect(response.body.error).toContain('Failed to refresh token');
      });
    });
  });

  describe('Security Tests', () => {
    it('should sanitize input to prevent injection', async () => {
      const maliciousInput = {
        apiKey: '<script>alert("XSS")</script>',
        webhookUrl: 'javascript:alert("XSS")'
      };

      const response = await request(app)
        .post('/api/config/hubspot')
        .set('Authorization', `Bearer ${testToken}`)
        .send(maliciousInput);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid');
    });

    it('should validate JWT signature', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const response = await request(app)
        .get('/api/config/hubspot')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid token');
    });

    it('should enforce tenant isolation', async () => {
      // User from different tenant
      (jwt.verify as jest.Mock).mockReturnValue({
        tenantId: 'different-tenant',
        userId: testUserId,
        roles: ['admin']
      });

      const response = await request(app)
        .get('/api/config/hubspot')
        .set('Authorization', `Bearer ${testToken}`);

      expect(mockConfigManager.getConfiguration).toHaveBeenCalledWith('HUBSPOT', 'different-tenant');
    });

    it('should redact sensitive data in responses', async () => {
      mockConfigManager.getConfiguration.mockResolvedValue({
        id: 'config-123',
        platform: 'STRIPE',
        apiKey: 'sk_test_secret_key_12345',
        webhookSecret: 'whsec_secret_123'
      });

      const response = await request(app)
        .get('/api/config/stripe')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.body.data.apiKey).toMatch(/sk_test_\*+/);
      expect(response.body.data.webhookSecret).toMatch(/whsec_\*+/);
    });
  });
});

// Helper function to setup routes (simplified for testing)
function setupConfigurationRoutes(app: express.Application, configManager: ConfigurationManager) {
  // Authentication middleware
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    try {
      const decoded = jwt.verify(token, 'test-secret');
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };

  // Authorization middleware
  const requireAdmin = (req: any, res: any, next: any) => {
    if (!req.user.roles?.includes('admin')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };

  // Platform validation
  const validatePlatform = (platform: string): Platform | null => {
    const normalized = platform.toUpperCase();
    if (['HUBSPOT', 'STRIPE', 'QUICKBOOKS'].includes(normalized)) {
      return normalized as Platform;
    }
    return null;
  };

  // Routes
  app.get('/api/config', authenticate, async (req, res) => {
    try {
      const configs = await configManager.getAllConfigurations(req.user.tenantId);
      res.json({ success: true, data: configs });
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve configurations' });
    }
  });

  app.get('/api/config/:platform', authenticate, async (req, res) => {
    const platform = validatePlatform(req.params.platform);
    if (!platform) {
      return res.status(400).json({ error: 'Invalid platform' });
    }

    try {
      const config = await configManager.getConfiguration(platform, req.user.tenantId);
      if (!config) {
        return res.status(404).json({ success: false, error: 'Configuration not found' });
      }

      // Redact sensitive data
      if (config.apiKey) {
        config.apiKey = config.apiKey.substring(0, 10) + '*'.repeat(20);
      }
      if (config.webhookSecret) {
        config.webhookSecret = config.webhookSecret.substring(0, 8) + '*'.repeat(15);
      }

      res.json({ success: true, data: config });
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve configuration' });
    }
  });

  app.post('/api/config/:platform', authenticate, async (req, res) => {
    const platform = validatePlatform(req.params.platform);
    if (!platform) {
      return res.status(400).json({ error: 'Invalid platform' });
    }

    // Validate required fields
    if (!req.body.apiKey) {
      return res.status(400).json({ error: 'apiKey is required' });
    }

    // Platform-specific validation
    if (platform === 'STRIPE' && !req.body.apiKey.startsWith('sk_')) {
      return res.status(400).json({ error: 'Invalid Stripe API key format' });
    }

    // Input sanitization
    if (req.body.apiKey.includes('<script>') || req.body.webhookUrl?.includes('javascript:')) {
      return res.status(400).json({ error: 'Invalid input detected' });
    }

    try {
      const config = {
        ...req.body,
        platform,
        tenantId: req.user.tenantId
      };
      const saved = await configManager.saveConfiguration(config, req.user.userId);
      res.status(201).json({ success: true, data: saved });
    } catch (error) {
      res.status(500).json({ error: 'Failed to save configuration' });
    }
  });

  app.post('/api/config/:platform/validate', authenticate, async (req, res) => {
    const platform = validatePlatform(req.params.platform);
    if (!platform) {
      return res.status(400).json({ error: 'Invalid platform' });
    }

    try {
      const config = {
        ...req.body,
        platform,
        tenantId: req.user.tenantId
      };
      const result = await configManager.validateConfiguration(config);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ error: 'Validation failed' });
    }
  });

  app.post('/api/config/:platform/test', authenticate, async (req, res) => {
    const platform = validatePlatform(req.params.platform);
    if (!platform) {
      return res.status(400).json({ error: 'Invalid platform' });
    }

    try {
      const result = await configManager.testConnection(platform, req.user.tenantId);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ error: 'Connection test failed' });
    }
  });

  app.delete('/api/config/:platform', authenticate, requireAdmin, async (req, res) => {
    const platform = validatePlatform(req.params.platform);
    if (!platform) {
      return res.status(400).json({ error: 'Invalid platform' });
    }

    try {
      const deleted = await configManager.deleteConfiguration(platform, req.user.tenantId, req.user.userId);
      if (!deleted) {
        return res.status(404).json({ error: 'Configuration not found' });
      }
      res.json({ success: true, message: 'Configuration deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete configuration' });
    }
  });

  // Webhook configuration routes
  app.get('/api/config/:platform/webhook', authenticate, async (req, res) => {
    const platform = validatePlatform(req.params.platform);
    if (!platform) {
      return res.status(400).json({ error: 'Invalid platform' });
    }

    try {
      const webhook = await configManager.getWebhookConfiguration(platform, req.user.tenantId);
      res.json({ success: true, data: webhook });
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve webhook configuration' });
    }
  });

  app.post('/api/config/:platform/webhook', authenticate, async (req, res) => {
    const platform = validatePlatform(req.params.platform);
    if (!platform) {
      return res.status(400).json({ error: 'Invalid platform' });
    }

    // Validate webhook URL
    if (req.body.webhookUrl && !req.body.webhookUrl.startsWith('https://')) {
      return res.status(400).json({ error: 'Invalid webhook URL - must use HTTPS' });
    }

    try {
      const webhook = {
        ...req.body,
        platform,
        tenantId: req.user.tenantId
      };
      const saved = await configManager.saveWebhookConfiguration(webhook, req.user.userId);
      res.status(201).json({ success: true, data: saved });
    } catch (error) {
      res.status(500).json({ error: 'Failed to save webhook configuration' });
    }
  });

  // Audit log routes
  app.get('/api/config/audit', authenticate, async (req, res) => {
    try {
      const filters: any = {
        tenantId: req.user.tenantId
      };

      if (req.query.platform) {
        filters.platform = validatePlatform(req.query.platform as string);
      }
      if (req.query.startDate) {
        filters.startDate = new Date(req.query.startDate as string);
      }
      if (req.query.endDate) {
        filters.endDate = new Date(req.query.endDate as string);
      }
      if (req.query.riskLevel) {
        filters.riskLevel = req.query.riskLevel;
      }

      const logs = await configManager.getAuditLogs(filters);
      res.json({ success: true, data: logs });
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve audit logs' });
    }
  });

  // Export/Import routes
  app.get('/api/config/:platform/export', authenticate, async (req, res) => {
    const platform = validatePlatform(req.params.platform);
    if (!platform) {
      return res.status(400).json({ error: 'Invalid platform' });
    }

    try {
      const exported = await configManager.exportConfiguration(platform, req.user.tenantId);
      res.json({ success: true, data: exported });
    } catch (error) {
      res.status(500).json({ error: 'Failed to export configuration' });
    }
  });

  app.post('/api/config/:platform/import', authenticate, async (req, res) => {
    const platform = validatePlatform(req.params.platform);
    if (!platform) {
      return res.status(400).json({ error: 'Invalid platform' });
    }

    // Validate version compatibility
    if (req.body.version && !req.body.version.startsWith('1.')) {
      return res.status(400).json({ error: 'Incompatible version' });
    }

    try {
      const imported = await configManager.importConfiguration(platform, req.body, req.user.tenantId, req.user.userId);
      res.status(201).json({ success: true, data: imported });
    } catch (error) {
      res.status(500).json({ error: 'Failed to import configuration' });
    }
  });

  // OAuth flow routes
  app.get('/api/config/:platform/oauth/authorize', authenticate, async (req, res) => {
    const platform = validatePlatform(req.params.platform);
    if (!platform) {
      return res.status(400).json({ error: 'Invalid platform' });
    }

    // Generate OAuth authorization URL
    const state = Buffer.from(JSON.stringify({
      tenantId: req.user.tenantId,
      userId: req.user.userId,
      timestamp: Date.now()
    })).toString('base64');

    const authUrl = platform === 'QUICKBOOKS' 
      ? `https://appcenter.intuit.com/connect/oauth2/v1/authorize?client_id=test&scope=com.intuit.quickbooks.accounting&redirect_uri=https://api.example.com/callback&state=${state}`
      : '';

    // PKCE support for QuickBooks
    const codeChallenge = 'test-challenge';
    const codeChallengeMethod = 'S256';

    res.json({
      success: true,
      data: {
        authorizationUrl: authUrl,
        state,
        codeChallenge,
        codeChallengeMethod
      }
    });
  });

  app.post('/api/config/:platform/oauth/callback', authenticate, async (req, res) => {
    const platform = validatePlatform(req.params.platform);
    if (!platform) {
      return res.status(400).json({ error: 'Invalid platform' });
    }

    // Validate state
    try {
      const stateData = JSON.parse(Buffer.from(req.body.state, 'base64').toString());
      if (stateData.tenantId !== req.user.tenantId) {
        throw new Error('State mismatch');
      }
    } catch {
      return res.status(400).json({ error: 'Invalid state parameter' });
    }

    try {
      // Exchange code for tokens (mocked)
      const config = {
        platform,
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        tenantId: req.user.tenantId,
        isActive: true
      };
      
      const saved = await configManager.saveConfiguration(config, req.user.userId);
      res.json({ success: true, data: saved });
    } catch (error) {
      res.status(500).json({ error: 'OAuth callback failed' });
    }
  });

  app.post('/api/config/:platform/oauth/refresh', authenticate, async (req, res) => {
    const platform = validatePlatform(req.params.platform);
    if (!platform) {
      return res.status(400).json({ error: 'Invalid platform' });
    }

    try {
      const config = await configManager.getConfiguration(platform, req.user.tenantId);
      if (!config || !config.refreshToken) {
        return res.status(400).json({ error: 'No refresh token available' });
      }

      // Refresh token (mocked)
      const updatedConfig = {
        ...config,
        accessToken: 'refreshed-access-token'
      };

      await configManager.saveConfiguration(updatedConfig, req.user.userId);
      res.json({ success: true, message: 'Token refreshed successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to refresh token' });
    }
  });

  // Rate limiting middleware (simplified)
  app.use('/api/config', async (req: any, res: any, next: any) => {
    if (req.user && req.params.platform) {
      const platform = validatePlatform(req.params.platform);
      if (platform) {
        const rateLimit = await configManager.getRateLimitStatus(platform, req.user.tenantId);
        
        res.setHeader('X-RateLimit-Limit', rateLimit.limit.toString());
        res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());
        res.setHeader('X-RateLimit-Reset', rateLimit.resetAt.toISOString());

        if (rateLimit.remaining === 0) {
          return res.status(429).json({ error: 'Rate limit exceeded' });
        }
      }
    }
    next();
  });
}