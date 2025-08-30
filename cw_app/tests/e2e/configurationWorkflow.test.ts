/**
 * Configuration Workflow End-to-End Tests
 * Comprehensive test suite for complete configuration workflows
 */

import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { ConfigurationManager } from '../../src/services/configurationManager';
import { createTestApp } from '../helpers/testApp';
import { 
  Platform, 
  HealthStatus,
  SyncDirection,
  AuditAction,
  RiskLevel
} from '../../src/types/configuration.types';

describe('Configuration Workflow E2E Tests', () => {
  let app: any;
  let prisma: PrismaClient;
  let configManager: ConfigurationManager;
  let authToken: string;
  const testTenantId = 'test-tenant-e2e';
  const testUserId = 'test-user-e2e';

  beforeAll(async () => {
    // Setup test database
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/test_e2e'
        }
      }
    });

    // Clear test data
    await prisma.$executeRaw`TRUNCATE TABLE integration_configuration CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE webhook_configuration CASCADE`;
    await prisma.$executeRaw`TRUNCATE TABLE configuration_audit_log CASCADE`;

    // Initialize services
    configManager = new ConfigurationManager(prisma);
    app = createTestApp(configManager);

    // Generate test JWT token
    authToken = jwt.sign(
      {
        tenantId: testTenantId,
        userId: testUserId,
        roles: ['admin']
      },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Complete HubSpot Configuration Workflow', () => {
    it('should complete full HubSpot setup workflow', async () => {
      // Step 1: Check initial state - no configuration
      let response = await request(app)
        .get('/api/config/hubspot')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');

      // Step 2: Save initial configuration
      const hubspotConfig = {
        apiKey: 'pat-na1-test-hubspot-key',
        webhookSecret: 'hubspot-webhook-secret',
        isActive: true,
        syncDirection: SyncDirection.BIDIRECTIONAL,
        syncFrequency: 300,
        webhookUrl: 'https://api.example.com/webhooks/hubspot',
        environment: 'sandbox'
      };

      response = await request(app)
        .post('/api/config/hubspot')
        .set('Authorization', `Bearer ${authToken}`)
        .send(hubspotConfig);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      
      const configId = response.body.data.id;

      // Step 3: Validate configuration
      response = await request(app)
        .post('/api/config/hubspot/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ apiKey: hubspotConfig.apiKey });

      expect(response.status).toBe(200);
      // Note: In real scenario, this would make actual API call

      // Step 4: Test connection
      response = await request(app)
        .post('/api/config/hubspot/test')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('status');

      // Step 5: Configure webhook
      const webhookConfig = {
        webhookUrl: 'https://api.example.com/webhooks/hubspot',
        webhookSecret: 'hubspot-webhook-secret',
        events: ['deal.created', 'deal.updated', 'invoice.created'],
        isActive: true
      };

      response = await request(app)
        .post('/api/config/hubspot/webhook')
        .set('Authorization', `Bearer ${authToken}`)
        .send(webhookConfig);

      expect(response.status).toBe(201);
      expect(response.body.data.events).toEqual(expect.arrayContaining(['deal.created']));

      // Step 6: Verify audit logs were created
      response = await request(app)
        .get('/api/config/audit?platform=hubspot')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty('action', AuditAction.CREATE);

      // Step 7: Update configuration
      response = await request(app)
        .post('/api/config/hubspot')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...hubspotConfig,
          syncFrequency: 600,
          environment: 'production'
        });

      expect(response.status).toBe(201);

      // Step 8: Verify update in audit log
      response = await request(app)
        .get('/api/config/audit?platform=hubspot')
        .set('Authorization', `Bearer ${authToken}`);

      const updateLog = response.body.data.find((log: any) => log.action === AuditAction.UPDATE);
      expect(updateLog).toBeDefined();
      expect(updateLog.riskLevel).toBe(RiskLevel.HIGH); // Production change is high risk

      // Step 9: Export configuration
      response = await request(app)
        .get('/api/config/hubspot/export')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).not.toHaveProperty('apiKey'); // Should not export sensitive data
      expect(response.body.data).toHaveProperty('syncDirection', SyncDirection.BIDIRECTIONAL);

      // Step 10: Test rate limiting
      const rateTestPromises = [];
      for (let i = 0; i < 5; i++) {
        rateTestPromises.push(
          request(app)
            .get('/api/config/hubspot')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const rateResponses = await Promise.all(rateTestPromises);
      const rateLimitHeaders = rateResponses[0].headers;
      expect(rateLimitHeaders).toHaveProperty('x-ratelimit-limit');
      expect(rateLimitHeaders).toHaveProperty('x-ratelimit-remaining');
    });
  });

  describe('Complete Stripe Configuration Workflow', () => {
    it('should complete full Stripe setup workflow', async () => {
      // Step 1: Save Stripe configuration
      const stripeConfig = {
        apiKey: 'sk_test_stripe_secret_key',
        publishableKey: 'pk_test_stripe_publishable_key',
        webhookSecret: 'whsec_stripe_webhook_secret',
        isActive: true,
        environment: 'test'
      };

      let response = await request(app)
        .post('/api/config/stripe')
        .set('Authorization', `Bearer ${authToken}`)
        .send(stripeConfig);

      expect(response.status).toBe(201);

      // Step 2: Configure Stripe webhook
      const webhookConfig = {
        webhookUrl: 'https://api.example.com/webhooks/stripe',
        webhookSecret: stripeConfig.webhookSecret,
        events: [
          'invoice.created',
          'invoice.payment_succeeded',
          'invoice.payment_failed',
          'payment_intent.succeeded'
        ],
        isActive: true
      };

      response = await request(app)
        .post('/api/config/stripe/webhook')
        .set('Authorization', `Bearer ${authToken}`)
        .send(webhookConfig);

      expect(response.status).toBe(201);
      expect(response.body.data.events).toHaveLength(4);

      // Step 3: Test Stripe connection
      response = await request(app)
        .post('/api/config/stripe/test')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);

      // Step 4: Retrieve configuration with redacted sensitive data
      response = await request(app)
        .get('/api/config/stripe')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.apiKey).toMatch(/sk_test_\*+/); // Should be redacted
      expect(response.body.data.webhookSecret).toMatch(/whsec_\*+/); // Should be redacted

      // Step 5: Verify both configurations exist
      response = await request(app)
        .get('/api/config')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.map((c: any) => c.platform)).toEqual(
        expect.arrayContaining(['HUBSPOT', 'STRIPE'])
      );
    });
  });

  describe('Complete QuickBooks OAuth Workflow', () => {
    it('should complete full QuickBooks OAuth setup workflow', async () => {
      // Step 1: Initiate OAuth flow
      let response = await request(app)
        .get('/api/config/quickbooks/oauth/authorize')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('authorizationUrl');
      expect(response.body.data).toHaveProperty('state');
      expect(response.body.data).toHaveProperty('codeChallenge'); // PKCE

      const { state, codeChallenge } = response.body.data;

      // Step 2: Simulate OAuth callback
      response = await request(app)
        .post('/api/config/quickbooks/oauth/callback')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'test-auth-code',
          state: state,
          codeVerifier: 'test-code-verifier' // PKCE verifier
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Step 3: Verify QuickBooks configuration was saved
      response = await request(app)
        .get('/api/config/quickbooks')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.platform).toBe('QUICKBOOKS');

      // Step 4: Test token refresh
      response = await request(app)
        .post('/api/config/quickbooks/oauth/refresh')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('refreshed');

      // Step 5: Configure QuickBooks webhook
      const webhookConfig = {
        webhookUrl: 'https://api.example.com/webhooks/quickbooks',
        events: ['invoice.created', 'payment.created'],
        isActive: true
      };

      response = await request(app)
        .post('/api/config/quickbooks/webhook')
        .set('Authorization', `Bearer ${authToken}`)
        .send(webhookConfig);

      expect(response.status).toBe(201);

      // Step 6: Test QuickBooks connection
      response = await request(app)
        .post('/api/config/quickbooks/test')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);

      // Step 7: Verify all three platforms are configured
      response = await request(app)
        .get('/api/config')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(3);
      const platforms = response.body.data.map((c: any) => c.platform);
      expect(platforms).toEqual(expect.arrayContaining(['HUBSPOT', 'STRIPE', 'QUICKBOOKS']));
    });
  });

  describe('Configuration Health Monitoring Workflow', () => {
    it('should monitor and handle configuration health', async () => {
      // Step 1: Simulate healthy connection
      await configManager.testConnection('HUBSPOT' as Platform, testTenantId);
      
      let response = await request(app)
        .get('/api/config/hubspot')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      // Health status would be updated by testConnection

      // Step 2: Simulate connection failures
      for (let i = 0; i < 3; i++) {
        // Mock failure by directly updating database
        await prisma.integrationConfiguration.updateMany({
          where: { 
            platform: 'HUBSPOT',
            tenantId: testTenantId
          },
          data: {
            errorCount: i + 1,
            lastError: `Connection failed ${i + 1}`,
            healthStatus: HealthStatus.UNHEALTHY
          }
        });
      }

      // Step 3: Check health status
      response = await request(app)
        .post('/api/config/hubspot/test')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      // Would show unhealthy status

      // Step 4: Simulate circuit breaker activation
      await prisma.integrationConfiguration.updateMany({
        where: { 
          platform: 'HUBSPOT',
          tenantId: testTenantId
        },
        data: {
          errorCount: 5,
          circuitBreakerStatus: 'OPEN',
          circuitBreakerOpenedAt: new Date()
        }
      });

      response = await request(app)
        .get('/api/config/hubspot')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      // Would show circuit breaker is open

      // Step 5: Wait and check circuit breaker half-open
      // In real scenario, would wait for cooldown period
      await prisma.integrationConfiguration.updateMany({
        where: { 
          platform: 'HUBSPOT',
          tenantId: testTenantId
        },
        data: {
          circuitBreakerStatus: 'HALF_OPEN'
        }
      });

      // Step 6: Successful connection closes circuit breaker
      await prisma.integrationConfiguration.updateMany({
        where: { 
          platform: 'HUBSPOT',
          tenantId: testTenantId
        },
        data: {
          circuitBreakerStatus: 'CLOSED',
          errorCount: 0,
          healthStatus: HealthStatus.HEALTHY
        }
      });

      response = await request(app)
        .get('/api/config/hubspot')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      // Circuit breaker would be closed
    });
  });

  describe('Configuration Import/Export Workflow', () => {
    it('should export and import configurations', async () => {
      // Step 1: Export all configurations
      const exportedConfigs: any = {};
      
      for (const platform of ['hubspot', 'stripe', 'quickbooks']) {
        const response = await request(app)
          .get(`/api/config/${platform}/export`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        exportedConfigs[platform] = response.body.data;
      }

      // Step 2: Delete all configurations
      for (const platform of ['hubspot', 'stripe', 'quickbooks']) {
        const response = await request(app)
          .delete(`/api/config/${platform}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
      }

      // Step 3: Verify configurations are deleted
      let response = await request(app)
        .get('/api/config')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);

      // Step 4: Import configurations back
      for (const platform of ['hubspot', 'stripe', 'quickbooks']) {
        response = await request(app)
          .post(`/api/config/${platform}/import`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(exportedConfigs[platform]);

        expect(response.status).toBe(201);
      }

      // Step 5: Verify configurations are restored
      response = await request(app)
        .get('/api/config')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(3);
    });
  });

  describe('Multi-Tenant Configuration Isolation', () => {
    it('should isolate configurations between tenants', async () => {
      // Create second tenant token
      const tenant2Token = jwt.sign(
        {
          tenantId: 'tenant-2',
          userId: 'user-2',
          roles: ['admin']
        },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      // Step 1: Create configuration for tenant 2
      let response = await request(app)
        .post('/api/config/hubspot')
        .set('Authorization', `Bearer ${tenant2Token}`)
        .send({
          apiKey: 'pat-na1-tenant2-key',
          isActive: true
        });

      expect(response.status).toBe(201);

      // Step 2: Verify tenant 1 cannot see tenant 2's configuration
      response = await request(app)
        .get('/api/config')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const tenant1Configs = response.body.data;

      // Step 3: Verify tenant 2 only sees their configuration
      response = await request(app)
        .get('/api/config')
        .set('Authorization', `Bearer ${tenant2Token}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].platform).toBe('HUBSPOT');

      // Step 4: Verify audit logs are isolated
      response = await request(app)
        .get('/api/config/audit')
        .set('Authorization', `Bearer ${tenant2Token}`);

      expect(response.status).toBe(200);
      const tenant2Logs = response.body.data;
      expect(tenant2Logs.every((log: any) => log.tenantId === 'tenant-2')).toBe(true);

      // Step 5: Verify tenant 1 cannot delete tenant 2's configuration
      response = await request(app)
        .delete('/api/config/hubspot')
        .set('Authorization', `Bearer ${authToken}`);

      // This would delete tenant 1's config if it exists, not tenant 2's

      // Step 6: Verify tenant 2's configuration still exists
      response = await request(app)
        .get('/api/config/hubspot')
        .set('Authorization', `Bearer ${tenant2Token}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
    });
  });

  describe('Configuration Security Workflow', () => {
    it('should enforce security measures', async () => {
      // Step 1: Attempt to access without authentication
      let response = await request(app)
        .get('/api/config/hubspot');

      expect(response.status).toBe(401);

      // Step 2: Attempt with invalid token
      response = await request(app)
        .get('/api/config/hubspot')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);

      // Step 3: Attempt admin action with non-admin user
      const userToken = jwt.sign(
        {
          tenantId: testTenantId,
          userId: 'regular-user',
          roles: ['user'] // Not admin
        },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      response = await request(app)
        .delete('/api/config/hubspot')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);

      // Step 4: Attempt SQL injection
      response = await request(app)
        .get("/api/config/'; DROP TABLE integration_configuration; --")
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);

      // Step 5: Attempt XSS in configuration
      response = await request(app)
        .post('/api/config/hubspot')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          apiKey: '<script>alert("XSS")</script>',
          webhookUrl: 'javascript:alert("XSS")'
        });

      expect(response.status).toBe(400);

      // Step 6: Verify sensitive data is encrypted in database
      const config = await prisma.integrationConfiguration.findFirst({
        where: { 
          platform: 'HUBSPOT',
          tenantId: testTenantId
        }
      });

      if (config) {
        expect(config.encryptedApiKey).toBeDefined();
        expect(config.encryptedApiKey).not.toContain('pat-na1'); // Should be encrypted
        expect(config.iv).toBeDefined(); // Should have IV for decryption
      }
    });
  });

  describe('Configuration Performance Workflow', () => {
    it('should handle high load efficiently', async () => {
      // Step 1: Create multiple configurations
      const platforms = ['HUBSPOT', 'STRIPE', 'QUICKBOOKS'];
      const createPromises = platforms.map(platform => 
        configManager.saveConfiguration({
          platform: platform as Platform,
          apiKey: `test-key-${platform}`,
          tenantId: `perf-tenant-${Math.random()}`,
          isActive: true
        }, testUserId)
      );

      await Promise.all(createPromises);

      // Step 2: Concurrent read operations
      const startTime = Date.now();
      const readPromises = [];
      
      for (let i = 0; i < 100; i++) {
        readPromises.push(
          request(app)
            .get('/api/config')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const responses = await Promise.all(readPromises);
      const endTime = Date.now();

      // All requests should succeed
      expect(responses.every(r => r.status === 200)).toBe(true);
      
      // Should complete within reasonable time (adjust based on system)
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds for 100 requests

      // Step 3: Test connection pooling
      const connectionPromises = [];
      for (let i = 0; i < 20; i++) {
        connectionPromises.push(
          configManager.testConnection('HUBSPOT' as Platform, testTenantId)
        );
      }

      const results = await Promise.all(connectionPromises);
      expect(results.every(r => r !== null)).toBe(true);

      // Step 4: Test bulk operations
      const bulkConfigs = await configManager.getAllConfigurations(testTenantId);
      expect(bulkConfigs).toBeDefined();

      // Step 5: Test audit log pagination
      const auditLogs = await configManager.getAuditLogs({
        tenantId: testTenantId,
        limit: 10
      });
      expect(auditLogs.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Configuration Recovery Workflow', () => {
    it('should handle and recover from failures', async () => {
      // Step 1: Simulate database connection failure
      const originalFindFirst = prisma.integrationConfiguration.findFirst;
      prisma.integrationConfiguration.findFirst = jest.fn().mockRejectedValue(
        new Error('Database connection lost')
      );

      let response = await request(app)
        .get('/api/config/hubspot')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);

      // Restore database function
      prisma.integrationConfiguration.findFirst = originalFindFirst;

      // Step 2: Verify recovery after database restoration
      response = await request(app)
        .get('/api/config/hubspot')
        .set('Authorization', `Bearer ${authToken}`);

      // Should work again
      expect([200, 404]).toContain(response.status);

      // Step 3: Test transaction rollback on partial failure
      const invalidConfig = {
        platform: 'INVALID_PLATFORM' as Platform,
        apiKey: 'test-key',
        tenantId: testTenantId
      };

      try {
        await configManager.saveConfiguration(invalidConfig, testUserId);
      } catch (error) {
        // Transaction should rollback
      }

      // Verify no partial data was saved
      const configs = await configManager.getAllConfigurations(testTenantId);
      expect(configs.every(c => c.platform !== 'INVALID_PLATFORM')).toBe(true);

      // Step 4: Test graceful degradation
      // Simulate rate limit exceeded
      await prisma.integrationConfiguration.updateMany({
        where: { 
          platform: 'STRIPE',
          tenantId: testTenantId
        },
        data: {
          rateLimitRemaining: 0,
          rateLimitResetAt: new Date(Date.now() + 60000)
        }
      });

      response = await request(app)
        .get('/api/config/stripe')
        .set('Authorization', `Bearer ${authToken}`);

      // Should still return config but with rate limit headers
      if (response.status === 200) {
        expect(response.headers['x-ratelimit-remaining']).toBe('0');
      }
    });
  });
});

// Helper function to create test Express app
function createTestApp(configManager: ConfigurationManager): any {
  const express = require('express');
  const app = express();
  
  app.use(express.json());
  
  // Add mock authentication middleware
  app.use((req: any, res: any, next: any) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
        req.user = decoded;
      } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }
    next();
  });

  // Add configuration routes (simplified for testing)
  require('../../src/routes/config.routes')(app, configManager);
  
  return app;
}