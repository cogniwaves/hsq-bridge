/**
 * Configuration Management API Router
 * Secure endpoints for managing multi-tenant integration configurations
 * Implements JWT authentication, tenant isolation, and role-based access control
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Platform, TenantRole, Prisma, PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import { asyncHandler } from '../utils/errorHandler';
import { createSuccessResponse, createErrorResponse } from '../utils/responses';
import { logger } from '../utils/logger';
import { configurationManager } from '../services/configurationManager';
import { getHubSpotClient } from '../services/hubspotClient';
import { getQuickBooksClient } from '../services/quickbooksClient';

const prisma = new PrismaClient();

// Import middleware
import { 
  jwtAuth, 
  requireTenant, 
  requireTenantRole, 
  tenantIsolation,
  perUserRateLimit,
  auditLog
} from '../middleware/jwtAuth';

// Import types - use enums from configuration.types for compatibility
import { 
  ConfigType, 
  HealthStatus, 
  AuditAction,
  RiskLevel
} from '../types/configuration.types';

// Extended request interface with authentication context
interface ConfigRequest extends Request {
  auth?: {
    userId: string;
    email: string;
    sessionId?: string;
    isSuperAdmin?: boolean;
    type: 'jwt';
  };
  user?: any;
  tenant?: any;
  membership?: any;
}

// Validation schemas
const API_KEY_PATTERNS = {
  HUBSPOT: /^pat-na\d+-[a-zA-Z0-9-]{36,}$/,
  STRIPE: /^(sk_test_|sk_live_)[a-zA-Z0-9]{24,}$/,
  QUICKBOOKS: /^[A-Za-z0-9]{20,}$/ // OAuth tokens
};

const WEBHOOK_URL_PATTERN = /^https?:\/\/.+$/;

export const configRoutes = Router();

// Apply JWT authentication to all routes except test endpoints
configRoutes.use((req: ConfigRequest, res: Response, next: NextFunction) => {
  // Skip authentication for test endpoints during development
  if (req.path.startsWith('/test-')) {
    return next();
  }
  return jwtAuth(req as any, res, next);
});

// Apply tenant context for authenticated routes
configRoutes.use((req: ConfigRequest, res: Response, next: NextFunction) => {
  // Skip tenant requirements for test endpoints
  if (req.path.startsWith('/test-') || !req.auth) {
    return next();
  }
  return requireTenant(req as any, res, next);
});

// Apply tenant isolation for authenticated routes
configRoutes.use((req: ConfigRequest, res: Response, next: NextFunction) => {
  // Skip tenant isolation for test endpoints
  if (req.path.startsWith('/test-') || !req.auth) {
    return next();
  }
  return tenantIsolation(req as any, res, next);
});

// Apply rate limiting to configuration endpoints
const configRateLimit = perUserRateLimit(20, 5); // 20 requests per 5 minutes

/**
 * GET /api/config/overview
 * Overall configuration overview for settings dashboard
 * Returns summary of all integrations and recent activity
 */
configRoutes.get('/overview',
  asyncHandler(async (req: ConfigRequest, res: Response) => {
    const tenantId = req.tenant?.id;
    
    if (!tenantId) {
      return res.status(403).json(createErrorResponse(
        'Tenant context required',
        'You must be a member of a tenant to access this resource'
      ));
    }

    try {
      // Get all configurations
      const configs = await prisma.integrationConfig.findMany({
        where: {
          tenantId,
          deletedAt: null
        },
        include: {
          webhookConfigs: {
            where: { deletedAt: null }
          }
        }
      });

      // Get recent audit logs
      const recentActivity = await prisma.configurationAuditLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          action: true,
          entityType: true,
          platform: true,
          performedByName: true,
          createdAt: true,
          riskLevel: true
        }
      });

      // Build overview
      const overview = {
        totalIntegrations: configs.length,
        activeIntegrations: configs.filter(c => c.isActive).length,
        healthyIntegrations: configs.filter(c => c.healthStatus === HealthStatus.HEALTHY).length,
        totalWebhooks: configs.reduce((sum, c) => sum + (c.webhookConfigs?.length || 0), 0),
        platforms: {
          hubspot: {
            configured: configs.some(c => c.platform === Platform.HUBSPOT && c.isActive),
            healthy: configs.some(c => c.platform === Platform.HUBSPOT && c.healthStatus === HealthStatus.HEALTHY),
            webhooks: configs.filter(c => c.platform === Platform.HUBSPOT).reduce((sum, c) => sum + (c.webhookConfigs?.length || 0), 0)
          },
          stripe: {
            configured: configs.some(c => c.platform === Platform.STRIPE && c.isActive),
            healthy: configs.some(c => c.platform === Platform.STRIPE && c.healthStatus === HealthStatus.HEALTHY),
            webhooks: configs.filter(c => c.platform === Platform.STRIPE).reduce((sum, c) => sum + (c.webhookConfigs?.length || 0), 0)
          },
          quickbooks: {
            configured: configs.some(c => c.platform === Platform.QUICKBOOKS && c.isActive),
            healthy: configs.some(c => c.platform === Platform.QUICKBOOKS && c.healthStatus === HealthStatus.HEALTHY),
            webhooks: configs.filter(c => c.platform === Platform.QUICKBOOKS).reduce((sum, c) => sum + (c.webhookConfigs?.length || 0), 0)
          }
        },
        recentActivity,
        lastUpdated: configs.reduce((latest, c) => {
          const updated = c.updatedAt || c.createdAt;
          return updated > latest ? updated : latest;
        }, new Date(0))
      };

      res.json(createSuccessResponse(overview, 'Configuration overview retrieved'));

    } catch (error) {
      logger.error('Failed to get configuration overview:', error);
      res.status(500).json(createErrorResponse(
        'Failed to retrieve configuration overview',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  })
);

/**
 * GET /api/config/status
 * Overall integration status dashboard
 * Returns health status for all configured integrations
 */
configRoutes.get('/status', 
  asyncHandler(async (req: ConfigRequest, res: Response) => {
    const tenantId = req.tenant?.id;
    
    if (!tenantId) {
      return res.status(403).json(createErrorResponse(
        'Tenant context required',
        'You must be a member of a tenant to access this resource'
      ));
    }

    try {
      const configManager = configurationManager(prisma);
      
      // Get all active configurations for tenant
      const configs = await prisma.integrationConfig.findMany({
        where: {
          tenantId,
          isActive: true,
          deletedAt: null
        },
        include: {
          webhookConfigs: {
            where: { isActive: true, deletedAt: null }
          }
        }
      });

      // Build status summary
      const statusSummary = {
        hubspot: {
          configured: false,
          healthy: false,
          lastCheck: null as Date | null,
          message: 'Not configured',
          webhooks: 0
        },
        stripe: {
          configured: false,
          healthy: false,
          lastCheck: null as Date | null,
          message: 'Not configured',
          webhooks: 0
        },
        quickbooks: {
          configured: false,
          healthy: false,
          lastCheck: null as Date | null,
          message: 'Not configured',
          webhooks: 0
        }
      };

      for (const config of configs) {
        const platformKey = config.platform.toLowerCase() as keyof typeof statusSummary;
        if (platformKey in statusSummary) {
          statusSummary[platformKey] = {
            configured: true,
            healthy: config.healthStatus === HealthStatus.HEALTHY,
            lastCheck: config.lastHealthCheckAt,
            message: config.healthMessage || 'Configuration active',
            webhooks: config.webhookConfigs?.length || 0
          };
        }
      }

      // Get recent audit logs
      const recentChanges = await prisma.configurationAuditLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          action: true,
          entityType: true,
          platform: true,
          performedByName: true,
          createdAt: true,
          riskLevel: true
        }
      });

      res.json(createSuccessResponse({
        integrations: statusSummary,
        summary: {
          totalConfigured: configs.length,
          healthyCount: configs.filter(c => c.healthStatus === HealthStatus.HEALTHY).length,
          unhealthyCount: configs.filter(c => c.healthStatus === HealthStatus.UNHEALTHY).length,
          totalWebhooks: configs.reduce((sum, c) => sum + (c.webhookConfigs?.length || 0), 0)
        },
        recentChanges,
        tenantInfo: {
          id: tenantId,
          name: req.tenant?.name,
          plan: req.tenant?.plan
        }
      }, 'Integration status retrieved successfully'));

    } catch (error) {
      logger.error('Failed to get integration status:', error);
      res.status(500).json(createErrorResponse(
        'Failed to retrieve integration status',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  })
);

/**
 * GET /api/config/hubspot
 * Get HubSpot configuration status for authenticated user
 */
configRoutes.get('/hubspot',
  asyncHandler(async (req: ConfigRequest, res: Response) => {
    const tenantId = req.tenant?.id;
    const userId = req.auth?.userId;
    
    try {
      const configManager = configurationManager(prisma);
      const config = await configManager.getActiveConfig(tenantId, Platform.HUBSPOT);
      
      if (!config) {
        return res.json(createSuccessResponse({
          configured: false,
          message: 'HubSpot integration not configured',
          instructions: 'Use POST /api/config/hubspot to configure'
        }, 'HubSpot configuration status'));
      }

      // Mask sensitive data and include enhanced metadata
      const metadata = config.metadata as any || {};
      const features = config.features as any || {};
      
      const maskedConfig = {
        id: config.id,
        configured: true,
        isActive: config.isActive,
        environment: config.environment,
        portalId: config.hubspotPortalId,
        accountId: config.hubspotAccountId,
        hasApiKey: !!config.apiKey,
        apiKeyMasked: config.apiKey ? `${config.apiKey.substring(0, 10)}...` : null,
        healthStatus: config.healthStatus,
        healthMessage: config.healthMessage,
        lastHealthCheck: config.lastHealthCheckAt,
        lastSync: config.lastSyncAt,
        nextSync: config.nextSyncAt,
        syncEnabled: config.syncEnabled,
        syncInterval: config.syncInterval,
        features: {
          invoices: features.invoices || false,
          contacts: features.contacts || false,
          companies: features.companies || false,
          lineItems: features.lineItems || false,
          products: features.products || false,
          webhooks: features.webhooks || false
        },
        rateLimitPerMinute: config.rateLimitPerMinute,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
        // Enhanced metadata for user display
        portalInfo: {
          detectedPortalId: metadata.portalId,
          autoDetected: metadata.autoDetectedPortal || false,
          scopes: metadata.scopes || [],
          missingScopes: metadata.missingScopes || [],
          apiUsage: metadata.apiUsage || null
        },
        scopeValidation: features._scopeValidation || {},
        lastConnectionTest: metadata.lastConnectionTest,
        configuredBy: metadata.configuredBy,
        validatedAt: config.validatedAt,
        validatedBy: config.validatedBy
      };

      res.json(createSuccessResponse(maskedConfig, 'HubSpot configuration retrieved'));

    } catch (error) {
      logger.error('Failed to get HubSpot config:', error);
      res.status(500).json(createErrorResponse(
        'Failed to retrieve HubSpot configuration',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  })
);

/**
 * POST /api/config/hubspot
 * Save/update HubSpot API credentials
 * Enhanced with user-scoped configuration and portal auto-detection
 */
configRoutes.post('/hubspot',
  configRateLimit as any,
  requireTenantRole(TenantRole.ADMIN, TenantRole.OWNER) as any,
  auditLog('CONFIG_HUBSPOT_UPDATE') as any,
  asyncHandler(async (req: ConfigRequest, res: Response) => {
    const tenantId = req.tenant?.id;
    const userId = req.auth?.userId;
    const userEmail = req.auth?.email;
    const userRole = req.membership?.role;
    
    const { 
      apiKey, 
      portalId, 
      accountId,
      environment = 'production',
      syncEnabled = true,
      syncInterval = 300000, // 5 minutes default
      features = {
        invoices: true,
        contacts: true,
        companies: true,
        lineItems: true,
        products: true,
        webhooks: false
      },
      rateLimitPerMinute = 100
    } = req.body;

    // Validate required fields
    if (!apiKey) {
      return res.status(400).json(createErrorResponse(
        'Validation error',
        'API key is required'
      ));
    }

    // Validate API key format
    if (!API_KEY_PATTERNS.HUBSPOT.test(apiKey)) {
      return res.status(400).json(createErrorResponse(
        'Invalid API key format',
        'HubSpot API key must start with "pat-na" followed by portal ID and token'
      ));
    }

    try {
      // Test the API key and auto-detect portal information
      const testClient = getHubSpotClient();
      const testResult = await testClient.testConnectionWithKey(apiKey);
      
      if (!testResult.success) {
        return res.status(400).json(createErrorResponse(
          'API key validation failed',
          testResult.message || 'Unable to connect to HubSpot with provided credentials'
        ));
      }

      // Auto-detect portal information if not provided
      const detectedPortalId = testResult.portalId;
      const finalPortalId = portalId || detectedPortalId;
      const detectedScopes = testResult.scopes || [];
      
      // Log successful portal detection
      if (detectedPortalId && !portalId) {
        logger.info('Auto-detected HubSpot portal ID', { 
          userId, 
          tenantId, 
          detectedPortalId,
          scopes: detectedScopes
        });
      }

      // Validate required scopes for enabled features
      const requiredScopes = [];
      if (features.invoices) requiredScopes.push('commerce.read');
      if (features.contacts) requiredScopes.push('crm.objects.contacts.read');
      if (features.companies) requiredScopes.push('crm.objects.companies.read');
      if (features.lineItems) requiredScopes.push('crm.objects.line_items.read');
      
      const missingScopes = requiredScopes.filter(scope => 
        !detectedScopes.some(s => s.includes(scope.replace('.read', '')) || s === scope)
      );
      
      if (missingScopes.length > 0) {
        logger.warn('Missing required HubSpot scopes', { 
          userId, 
          tenantId, 
          missingScopes,
          availableScopes: detectedScopes
        });
      }

      const configManager = configurationManager(prisma);
      
      // Upsert configuration with enhanced metadata
      const config = await configManager.upsertConfig(
        tenantId,
        Platform.HUBSPOT,
        {
          apiKey,
          hubspotPortalId: finalPortalId,
          hubspotAccountId: accountId,
          environment,
          configType: ConfigType.API_KEY,
          syncEnabled,
          syncInterval,
          features: {
            ...features,
            _detectedScopes: detectedScopes,
            _missingScopes: missingScopes
          },
          rateLimitPerMinute,
          healthStatus: HealthStatus.HEALTHY,
          healthMessage: missingScopes.length > 0 
            ? `Connected with limited scopes. Missing: ${missingScopes.join(', ')}`
            : 'Connection verified with all required scopes',
          validatedAt: new Date(),
          validatedBy: userEmail || userId,
          isActive: true,
          isPrimary: true,
          metadata: {
            portalId: detectedPortalId,
            accountId,
            scopes: detectedScopes,
            missingScopes,
            autoDetectedPortal: !portalId && !!detectedPortalId,
            apiUsage: testResult.apiCalls,
            lastConnectionTest: new Date().toISOString(),
            configuredBy: {
              userId,
              email: userEmail,
              role: userRole
            }
          }
        },
        userEmail || userId
      );

      // Create audit log entry
      await prisma.configurationAuditLog.create({
        data: {
          tenantId,
          entityType: 'INTEGRATION_CONFIG',
          entityId: config.id,
          action: AuditAction.UPDATE,
          performedBy: userId,
          performedByEmail: userEmail,
          performedByName: req.user?.name,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          sessionId: req.auth?.sessionId,
          riskLevel: RiskLevel.MEDIUM,
          platform: Platform.HUBSPOT,
          environment,
          metadata: {
            portalId: testResult.portalId,
            scopes: testResult.scopes,
            timestamp: new Date().toISOString()
          }
        }
      });

      res.json(createSuccessResponse({
        success: true,
        configId: config.id,
        portalId: finalPortalId,
        detectedPortalId: detectedPortalId,
        autoDetected: !portalId && !!detectedPortalId,
        accountId: accountId,
        scopes: detectedScopes,
        missingScopes: missingScopes,
        scopeWarnings: missingScopes.length > 0 ? 
          `Some features may be limited due to missing scopes: ${missingScopes.join(', ')}` : null,
        healthStatus: HealthStatus.HEALTHY,
        apiUsage: testResult.apiCalls,
        features: {
          ...features,
          _scopeValidation: {
            invoices: features.invoices && detectedScopes.some(s => s.includes('commerce')),
            contacts: features.contacts && detectedScopes.some(s => s.includes('contacts')),
            companies: features.companies && detectedScopes.some(s => s.includes('companies')),
            lineItems: features.lineItems && detectedScopes.some(s => s.includes('line_items'))
          }
        },
        message: 'HubSpot configuration saved successfully'
      }, 'HubSpot configuration updated'));

    } catch (error) {
      logger.error('Failed to save HubSpot config:', error);
      res.status(500).json(createErrorResponse(
        'Failed to save HubSpot configuration',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  })
);

/**
 * POST /api/config/test-hubspot
 * Test HubSpot API connection with provided credentials  
 */
configRoutes.post('/test-hubspot', async (req: ConfigRequest, res: Response) => {
  // TEMPORARY SIMPLE IMPLEMENTATION FOR TESTING
  console.log('🔥 [DEBUG] test-hubspot endpoint reached!');
  
  try {
    const { apiKey } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: 'API key is required for testing'
      });
    }

    // Test the HubSpot API connection
    const testClient = getHubSpotClient();
    const testResult = await testClient.testConnectionWithKey(apiKey);
    
    console.log('🔥 [DEBUG] HubSpot test result:', testResult);
    
    if (!testResult.success) {
      return res.json({
        success: false,
        message: testResult.message || 'Unable to connect to HubSpot',
        error: 'Connection failed',
        details: {
          apiReachable: false,
          authValid: false,
          errorCount: 1,
          timestamp: new Date().toISOString(),
          debugInfo: {
            errorType: 'ConnectionError',
            hasApiKey: !!apiKey,
            apiKeyLength: apiKey?.length || 0,
            apiKeyPrefix: apiKey ? apiKey.substring(0, 8) + '...' : 'none'
          }
        }
      });
    }

    // Success case
    return res.json({
      success: true,
      message: 'Successfully connected to HubSpot',
      details: {
        portalId: testResult.portalId,
        accountName: `Portal ${testResult.portalId}`,
        apiReachable: true,
        authValid: true,
        responseTime: 100,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('🔴 [DEBUG] HubSpot test endpoint error:', error);
    
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      error: 'Connection test failed',
      details: {
        apiReachable: false,
        authValid: false,
        errorCount: 1,
        timestamp: new Date().toISOString(),
        debugInfo: {
          errorType: error instanceof Error ? error.name : 'UnknownError',
          hasApiKey: !!(req.body.apiKey),
          apiKeyLength: req.body.apiKey ? req.body.apiKey.length : 0,
          apiKeyPrefix: req.body.apiKey ? req.body.apiKey.substring(0, 8) + '...' : 'none'
        }
      }
    });
  }
});

/**
 * GET /api/config/stripe
 * Get Stripe configuration status
 */
configRoutes.get('/stripe',
  asyncHandler(async (req: ConfigRequest, res: Response) => {
    const tenantId = req.tenant?.id;
    
    try {
      const configManager = configurationManager(prisma);
      const config = await configManager.getActiveConfig(tenantId, Platform.STRIPE);
      
      if (!config) {
        return res.json(createSuccessResponse({
          configured: false,
          message: 'Stripe integration not configured',
          instructions: 'Use POST /api/config/stripe to configure'
        }, 'Stripe configuration status'));
      }

      // Mask sensitive data
      const maskedConfig = {
        id: config.id,
        configured: true,
        isActive: config.isActive,
        environment: config.environment,
        accountId: config.stripeAccountId,
        hasSecretKey: !!config.apiKey,
        secretKeyMasked: config.apiKey ? `${config.apiKey.substring(0, 10)}...` : null,
        liveMode: config.environment === 'production',
        healthStatus: config.healthStatus,
        healthMessage: config.healthMessage,
        lastHealthCheck: config.lastHealthCheckAt,
        lastSync: config.lastSyncAt,
        nextSync: config.nextSyncAt,
        syncEnabled: config.syncEnabled,
        syncInterval: config.syncInterval,
        features: config.features,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt
      };

      res.json(createSuccessResponse(maskedConfig, 'Stripe configuration retrieved'));

    } catch (error) {
      logger.error('Failed to get Stripe config:', error);
      res.status(500).json(createErrorResponse(
        'Failed to retrieve Stripe configuration',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  })
);

/**
 * POST /api/config/stripe
 * Save/update Stripe API credentials
 * Requires ADMIN or OWNER role
 */
configRoutes.post('/stripe',
  configRateLimit as any,
  requireTenantRole(TenantRole.ADMIN, TenantRole.OWNER) as any,
  auditLog('CONFIG_STRIPE_UPDATE') as any,
  asyncHandler(async (req: ConfigRequest, res: Response) => {
    const tenantId = req.tenant?.id;
    const userId = req.auth?.userId;
    const userEmail = req.auth?.email;
    
    const { 
      secretKey,
      webhookSecret,
      accountId,
      environment = 'production',
      syncEnabled = true,
      syncInterval = 300000,
      features = {}
    } = req.body;

    // Validate required fields
    if (!secretKey) {
      return res.status(400).json(createErrorResponse(
        'Validation error',
        'Secret key is required'
      ));
    }

    // Validate secret key format
    if (!API_KEY_PATTERNS.STRIPE.test(secretKey)) {
      return res.status(400).json(createErrorResponse(
        'Invalid secret key format',
        'Stripe secret key must start with "sk_test_" or "sk_live_"'
      ));
    }

    // Determine environment from key
    const detectedEnvironment = secretKey.startsWith('sk_test_') ? 'test' : 'production';
    
    if (environment !== detectedEnvironment) {
      return res.status(400).json(createErrorResponse(
        'Environment mismatch',
        `Secret key is for ${detectedEnvironment} but environment is set to ${environment}`
      ));
    }

    try {
      // Test the API key before saving
      const Stripe = require('stripe');
      const stripe = new Stripe(secretKey);
      
      let testResult: any;
      try {
        // Test connection by fetching account details
        const account = await stripe.accounts.retrieve();
        testResult = {
          success: true,
          accountId: account.id,
          accountName: account.business_profile?.name,
          country: account.country,
          currency: account.default_currency
        };
      } catch (stripeError: any) {
        return res.status(400).json(createErrorResponse(
          'API key validation failed',
          stripeError.message || 'Unable to connect to Stripe with provided credentials'
        ));
      }

      const configManager = configurationManager(prisma);
      
      // Upsert configuration
      const config = await configManager.upsertConfig(
        tenantId,
        Platform.STRIPE,
        {
          apiKey: secretKey,
          apiSecret: webhookSecret,
          stripeAccountId: accountId || testResult.accountId,
          environment: detectedEnvironment,
          configType: ConfigType.API_KEY,
          syncEnabled,
          syncInterval,
          features,
          healthStatus: HealthStatus.HEALTHY,
          healthMessage: 'Connection verified',
          validatedAt: new Date(),
          validatedBy: userEmail || userId,
          isActive: true,
          isPrimary: true
        },
        userEmail || userId
      );

      // Create audit log entry
      await prisma.configurationAuditLog.create({
        data: {
          tenantId,
          entityType: 'INTEGRATION_CONFIG',
          entityId: config.id,
          action: AuditAction.UPDATE,
          performedBy: userId,
          performedByEmail: userEmail,
          performedByName: req.user?.name,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          sessionId: req.auth?.sessionId,
          riskLevel: RiskLevel.MEDIUM,
          platform: Platform.STRIPE,
          environment: detectedEnvironment,
          metadata: {
            accountId: testResult.accountId,
            accountName: testResult.accountName,
            country: testResult.country,
            currency: testResult.currency,
            timestamp: new Date().toISOString()
          }
        }
      });

      res.json(createSuccessResponse({
        success: true,
        configId: config.id,
        accountId: testResult.accountId,
        accountName: testResult.accountName,
        liveMode: detectedEnvironment === 'production',
        healthStatus: HealthStatus.HEALTHY,
        message: 'Stripe configuration saved successfully'
      }, 'Stripe configuration updated'));

    } catch (error) {
      logger.error('Failed to save Stripe config:', error);
      res.status(500).json(createErrorResponse(
        'Failed to save Stripe configuration',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  })
);

/**
 * GET /api/config/quickbooks
 * Get QuickBooks OAuth status
 */
configRoutes.get('/quickbooks',
  asyncHandler(async (req: ConfigRequest, res: Response) => {
    const tenantId = req.tenant?.id;
    
    try {
      // Check for OAuth tokens in database
      const oauthToken = await prisma.oAuthToken.findFirst({
        where: {
          tenantId,
          provider: 'quickbooks',
          isActive: true,
          revokedAt: null
        },
        orderBy: { createdAt: 'desc' }
      });

      if (!oauthToken) {
        return res.json(createSuccessResponse({
          configured: false,
          authenticated: false,
          message: 'QuickBooks integration not configured',
          instructions: 'Use POST /api/config/quickbooks/initiate to start OAuth flow'
        }, 'QuickBooks configuration status'));
      }

      // Check token expiration
      const now = new Date();
      const tokenExpired = oauthToken.expiresAt < now;
      const refreshTokenExpired = oauthToken.refreshTokenExpiresAt 
        ? oauthToken.refreshTokenExpiresAt < now 
        : false;

      // Test connection if tokens are valid
      let connectionStatus = 'unknown';
      let companyInfo = null;
      
      if (!tokenExpired && !refreshTokenExpired) {
        try {
          const qbClient = getQuickBooksClient();
          const isConnected = await qbClient.testConnection();
          connectionStatus = isConnected ? 'connected' : 'failed';
          
          if (isConnected) {
            // Get company info
            const company = await qbClient.getCompanyInfo();
            companyInfo = {
              name: company.CompanyName,
              id: oauthToken.companyId,
              realmId: oauthToken.realmId
            };
          }
        } catch (error) {
          connectionStatus = 'error';
          logger.error('QuickBooks connection test failed:', error);
        }
      }

      const maskedToken = {
        id: oauthToken.id,
        configured: true,
        authenticated: !tokenExpired && !refreshTokenExpired,
        connectionStatus,
        companyInfo,
        tokenStatus: {
          hasAccessToken: !!oauthToken.accessToken,
          hasRefreshToken: !!oauthToken.refreshToken,
          accessTokenExpired: tokenExpired,
          refreshTokenExpired,
          expiresAt: oauthToken.expiresAt,
          refreshTokenExpiresAt: oauthToken.refreshTokenExpiresAt,
          lastRefreshedAt: oauthToken.lastRefreshedAt,
          refreshCount: oauthToken.refreshCount,
          failedRefreshCount: oauthToken.failedRefreshCount
        },
        environment: (oauthToken.metadata as any)?.sandbox ? 'sandbox' : 'production',
        createdAt: oauthToken.createdAt,
        updatedAt: oauthToken.updatedAt
      };

      res.json(createSuccessResponse(maskedToken, 'QuickBooks configuration retrieved'));

    } catch (error) {
      logger.error('Failed to get QuickBooks config:', error);
      res.status(500).json(createErrorResponse(
        'Failed to retrieve QuickBooks configuration',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  })
);

/**
 * POST /api/config/quickbooks/initiate
 * Start QuickBooks OAuth flow
 * Requires ADMIN or OWNER role
 */
configRoutes.post('/quickbooks/initiate',
  configRateLimit as any,
  requireTenantRole(TenantRole.ADMIN, TenantRole.OWNER) as any,
  auditLog('CONFIG_QUICKBOOKS_OAUTH_INITIATE') as any,
  asyncHandler(async (req: ConfigRequest, res: Response) => {
    const tenantId = req.tenant?.id;
    const userId = req.auth?.userId;
    const userEmail = req.auth?.email;
    
    const { 
      redirectUri = process.env.QUICKBOOKS_REDIRECT_URI || 'https://developer.intuit.com/v2/OAuth2Playground/RedirectUrl',
      environment = 'production'
    } = req.body;

    try {
      const qbClient = getQuickBooksClient();
      const state = crypto.randomBytes(16).toString('hex');
      
      // Store state in database for validation
      await prisma.configurationAuditLog.create({
        data: {
          tenantId,
          entityType: 'OAUTH_TOKEN',
          entityId: state,
          action: AuditAction.CREATE,
          performedBy: userId,
          performedByEmail: userEmail,
          performedByName: req.user?.name,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          sessionId: req.auth?.sessionId,
          riskLevel: RiskLevel.MEDIUM,
          platform: Platform.QUICKBOOKS,
          environment,
          metadata: {
            type: 'oauth_state',
            redirectUri,
            timestamp: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
          }
        }
      });

      const authUrl = qbClient.getAuthUrl(state);

      res.json(createSuccessResponse({
        authUrl,
        state,
        redirectUri,
        instructions: [
          '1. Visit the authUrl to authorize the application',
          '2. You will be redirected after authorization',
          '3. Use the authorization code to complete the OAuth flow',
          '4. The state parameter must match for security'
        ],
        expiresIn: 600 // 10 minutes
      }, 'QuickBooks OAuth URL generated'));

    } catch (error) {
      logger.error('Failed to initiate QuickBooks OAuth:', error);
      res.status(500).json(createErrorResponse(
        'Failed to initiate QuickBooks OAuth',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  })
);

/**
 * GET /api/config/test-connections
 * Test all platform connections
 */
configRoutes.get('/test-connections',
  perUserRateLimit(5, 1) as any, // Strict rate limit: 5 requests per minute
  asyncHandler(async (req: ConfigRequest, res: Response) => {
    const tenantId = req.tenant?.id;
    const userId = req.auth?.userId;
    const userEmail = req.auth?.email;
    
    try {
      const results = {
        hubspot: { 
          tested: false, 
          success: false, 
          message: 'Not configured',
          details: null as any
        },
        stripe: { 
          tested: false, 
          success: false, 
          message: 'Not configured',
          details: null as any
        },
        quickbooks: { 
          tested: false, 
          success: false, 
          message: 'Not configured',
          details: null as any
        }
      };

      const configManager = configurationManager(prisma);

      // Test HubSpot
      const hubspotConfig = await configManager.getActiveConfig(tenantId, Platform.HUBSPOT);
      if (hubspotConfig && hubspotConfig.apiKey) {
        results.hubspot.tested = true;
        try {
          const client = getHubSpotClient();
          const testResult = await client.testConnectionWithKey(hubspotConfig.apiKey);
          results.hubspot.success = testResult.success;
          results.hubspot.message = testResult.message || 'Connection successful';
          results.hubspot.details = {
            portalId: testResult.portalId,
            scopes: testResult.scopes,
            apiCalls: testResult.apiCalls
          };
          
          // Update health status
          await prisma.integrationConfig.update({
            where: { id: hubspotConfig.id },
            data: {
              healthStatus: testResult.success ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
              healthMessage: testResult.message,
              lastHealthCheckAt: new Date()
            }
          });
        } catch (error: any) {
          results.hubspot.success = false;
          results.hubspot.message = error.message || 'Connection test failed';
        }
      }

      // Test Stripe
      const stripeConfig = await configManager.getActiveConfig(tenantId, Platform.STRIPE);
      if (stripeConfig && stripeConfig.apiKey) {
        results.stripe.tested = true;
        try {
          const Stripe = require('stripe');
          const stripe = new Stripe(stripeConfig.apiKey);
          const account = await stripe.accounts.retrieve();
          
          results.stripe.success = true;
          results.stripe.message = 'Connection successful';
          results.stripe.details = {
            accountId: account.id,
            accountName: account.business_profile?.name,
            country: account.country,
            currency: account.default_currency,
            chargesEnabled: account.charges_enabled,
            payoutsEnabled: account.payouts_enabled
          };
          
          // Update health status
          await prisma.integrationConfig.update({
            where: { id: stripeConfig.id },
            data: {
              healthStatus: HealthStatus.HEALTHY,
              healthMessage: 'Connection verified',
              lastHealthCheckAt: new Date()
            }
          });
        } catch (error: any) {
          results.stripe.success = false;
          results.stripe.message = error.message || 'Connection test failed';
          
          await prisma.integrationConfig.update({
            where: { id: stripeConfig.id },
            data: {
              healthStatus: HealthStatus.UNHEALTHY,
              healthMessage: error.message,
              lastHealthCheckAt: new Date()
            }
          });
        }
      }

      // Test QuickBooks
      const qbToken = await prisma.oAuthToken.findFirst({
        where: {
          tenantId,
          provider: 'quickbooks',
          isActive: true,
          revokedAt: null
        },
        orderBy: { createdAt: 'desc' }
      });
      
      if (qbToken) {
        results.quickbooks.tested = true;
        try {
          const qbClient = getQuickBooksClient();
          const isConnected = await qbClient.testConnection();
          
          if (isConnected) {
            const companyInfo = await qbClient.getCompanyInfo();
            results.quickbooks.success = true;
            results.quickbooks.message = 'Connection successful';
            results.quickbooks.details = {
              companyName: companyInfo.CompanyName,
              companyId: qbToken.companyId,
              realmId: qbToken.realmId,
              country: companyInfo.Country,
              fiscalYearStartMonth: companyInfo.FiscalYearStartMonth
            };
          } else {
            results.quickbooks.success = false;
            results.quickbooks.message = 'Connection test failed';
          }
        } catch (error: any) {
          results.quickbooks.success = false;
          results.quickbooks.message = error.message || 'Connection test failed';
        }
      }

      // Create audit log
      await prisma.configurationAuditLog.create({
        data: {
          tenantId,
          entityType: 'INTEGRATION_CONFIG',
          entityId: tenantId,
          action: AuditAction.TEST,
          performedBy: userId,
          performedByEmail: userEmail,
          performedByName: req.user?.name,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          sessionId: req.auth?.sessionId,
          riskLevel: RiskLevel.LOW,
          metadata: {
            results,
            timestamp: new Date().toISOString()
          }
        }
      });

      const summary = {
        totalTested: Object.values(results).filter(r => r.tested).length,
        successCount: Object.values(results).filter(r => r.success).length,
        failureCount: Object.values(results).filter(r => r.tested && !r.success).length
      };

      res.json(createSuccessResponse({
        results,
        summary,
        timestamp: new Date().toISOString()
      }, 'Connection tests completed'));

    } catch (error) {
      logger.error('Failed to test connections:', error);
      res.status(500).json(createErrorResponse(
        'Failed to test connections',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  })
);

/**
 * GET /api/config/webhooks/stripe
 * Get Stripe-specific webhook configuration
 */
configRoutes.get('/webhooks/stripe',
  asyncHandler(async (req: ConfigRequest, res: Response) => {
    const tenantId = req.tenant?.id;
    
    try {
      const configManager = configurationManager(prisma);
      const webhooks = await configManager.getWebhookConfigs(tenantId, Platform.STRIPE);
      
      // Get Stripe integration config to check if it's configured
      const stripeConfig = await configManager.getActiveConfig(tenantId, Platform.STRIPE);
      
      if (!stripeConfig) {
        return res.json(createSuccessResponse({
          configured: false,
          message: 'Stripe integration not configured',
          webhooks: []
        }, 'Stripe webhook configuration status'));
      }
      
      // Mask sensitive data
      const maskedWebhooks = webhooks.map(webhook => ({
        id: webhook.id,
        endpointUrl: webhook.endpointUrl,
        httpMethod: webhook.httpMethod,
        isActive: webhook.isActive,
        authType: webhook.authType,
        hasSigningSecret: !!webhook.signingSecret,
        subscribedEvents: webhook.subscribedEvents,
        circuitBreaker: {
          enabled: webhook.circuitBreakerEnabled,
          status: webhook.circuitBreakerStatus,
          threshold: webhook.circuitBreakerThreshold,
          consecutiveFailures: webhook.consecutiveFailures
        },
        statistics: {
          totalTriggers: webhook.totalTriggerCount,
          successCount: webhook.totalSuccessCount,
          failureCount: webhook.totalFailureCount,
          lastTrigger: webhook.lastTriggerAt,
          lastSuccess: webhook.lastSuccessAt,
          lastFailure: webhook.lastFailureAt,
          lastError: webhook.lastErrorMessage
        },
        createdAt: webhook.createdAt,
        updatedAt: webhook.updatedAt
      }));

      res.json(createSuccessResponse({
        configured: true,
        webhooks: maskedWebhooks,
        summary: {
          total: maskedWebhooks.length,
          active: maskedWebhooks.filter(w => w.isActive).length,
          healthy: maskedWebhooks.filter(w => w.circuitBreaker.status === 'CLOSED').length
        }
      }, 'Stripe webhook configuration retrieved'));

    } catch (error) {
      logger.error('Failed to get Stripe webhook config:', error);
      res.status(500).json(createErrorResponse(
        'Failed to retrieve Stripe webhook configuration',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  })
);

/**
 * GET /api/config/webhooks
 * Get webhook configuration status
 */
configRoutes.get('/webhooks',
  asyncHandler(async (req: ConfigRequest, res: Response) => {
    const tenantId = req.tenant?.id;
    const { platform } = req.query;
    
    try {
      const configManager = configurationManager(prisma);
      
      let platformFilter: Platform | undefined;
      if (platform && typeof platform === 'string') {
        platformFilter = platform.toUpperCase() as Platform;
      }
      
      const webhooks = await configManager.getWebhookConfigs(tenantId, platformFilter);
      
      // Mask sensitive data
      const maskedWebhooks = webhooks.map(webhook => ({
        id: webhook.id,
        platform: webhook.platform,
        webhookType: webhook.webhookType,
        endpointUrl: webhook.endpointUrl,
        httpMethod: webhook.httpMethod,
        isActive: webhook.isActive,
        authType: webhook.authType,
        hasSigningSecret: !!webhook.signingSecret,
        subscribedEvents: webhook.subscribedEvents,
        circuitBreaker: {
          enabled: webhook.circuitBreakerEnabled,
          status: webhook.circuitBreakerStatus,
          threshold: webhook.circuitBreakerThreshold,
          consecutiveFailures: webhook.consecutiveFailures
        },
        statistics: {
          totalTriggers: webhook.totalTriggerCount,
          successCount: webhook.totalSuccessCount,
          failureCount: webhook.totalFailureCount,
          lastTrigger: webhook.lastTriggerAt,
          lastSuccess: webhook.lastSuccessAt,
          lastFailure: webhook.lastFailureAt,
          lastError: webhook.lastErrorMessage
        },
        createdAt: webhook.createdAt,
        updatedAt: webhook.updatedAt
      }));

      res.json(createSuccessResponse({
        webhooks: maskedWebhooks,
        summary: {
          total: maskedWebhooks.length,
          active: maskedWebhooks.filter(w => w.isActive).length,
          byPlatform: {
            hubspot: maskedWebhooks.filter(w => w.platform === Platform.HUBSPOT).length,
            stripe: maskedWebhooks.filter(w => w.platform === Platform.STRIPE).length,
            quickbooks: maskedWebhooks.filter(w => w.platform === Platform.QUICKBOOKS).length
          }
        }
      }, 'Webhook configurations retrieved'));

    } catch (error) {
      logger.error('Failed to get webhook configs:', error);
      res.status(500).json(createErrorResponse(
        'Failed to retrieve webhook configurations',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  })
);

/**
 * POST /api/config/webhooks
 * Configure webhook endpoints
 * Requires ADMIN or OWNER role
 */
configRoutes.post('/webhooks',
  configRateLimit as any,
  requireTenantRole(TenantRole.ADMIN, TenantRole.OWNER) as any,
  auditLog('CONFIG_WEBHOOK_UPDATE') as any,
  asyncHandler(async (req: ConfigRequest, res: Response) => {
    const tenantId = req.tenant?.id;
    const userId = req.auth?.userId;
    const userEmail = req.auth?.email;
    
    const {
      platform,
      endpointUrl,
      signingSecret,
      authType = 'SIGNATURE',
      authToken,
      subscribedEvents = [],
      webhookType = 'INBOUND',
      httpMethod = 'POST',
      circuitBreakerEnabled = true,
      circuitBreakerThreshold = 5,
      maxRetries = 3
    } = req.body;

    // Validate required fields
    if (!platform || !endpointUrl) {
      return res.status(400).json(createErrorResponse(
        'Validation error',
        'Platform and endpoint URL are required'
      ));
    }

    // Validate platform
    if (!Object.values(Platform).includes(platform.toUpperCase())) {
      return res.status(400).json(createErrorResponse(
        'Invalid platform',
        `Platform must be one of: ${Object.values(Platform).join(', ')}`
      ));
    }

    // Validate URL format
    if (!WEBHOOK_URL_PATTERN.test(endpointUrl)) {
      return res.status(400).json(createErrorResponse(
        'Invalid URL format',
        'Endpoint URL must be a valid HTTP/HTTPS URL'
      ));
    }

    // Validate events array
    if (!Array.isArray(subscribedEvents) || subscribedEvents.length === 0) {
      return res.status(400).json(createErrorResponse(
        'Validation error',
        'At least one subscribed event is required'
      ));
    }

    try {
      // Get or create integration config
      const configManager = configurationManager(prisma);
      let integrationConfig = await configManager.getActiveConfig(
        tenantId, 
        platform.toUpperCase() as Platform
      );

      if (!integrationConfig) {
        return res.status(400).json(createErrorResponse(
          'Configuration required',
          `${platform} integration must be configured before adding webhooks`
        ));
      }

      // Encrypt signing secret if provided
      let encryptedSecret = null;
      
      if (signingSecret) {
        const algorithm = 'aes-256-gcm';
        const key = crypto.scryptSync(
          process.env.ENCRYPTION_KEY || 'demo-key',
          'salt',
          32
        );
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        
        let encrypted = cipher.update(signingSecret, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = (cipher as any).getAuthTag();
        
        // Store IV in the encrypted value itself
        encryptedSecret = iv.toString('hex') + ':' + encrypted + ':' + authTag.toString('hex');
      }

      // Create webhook configuration
      const webhook = await prisma.webhookConfiguration.create({
        data: {
          tenantId,
          integrationConfigId: integrationConfig.id,
          platform: platform.toUpperCase() as Platform,
          webhookType: webhookType as any,
          endpointUrl,
          httpMethod,
          isActive: true,
          signingSecret: encryptedSecret,
          authType: authType as any,
          authToken,
          subscribedEvents,
          maxRetries,
          retryDelayMs: 1000,
          retryBackoffMultiplier: 2,
          timeoutMs: 30000,
          circuitBreakerEnabled,
          circuitBreakerThreshold,
          circuitBreakerResetAfterMs: 60000,
          circuitBreakerStatus: 'CLOSED' as any,
          consecutiveFailures: 0,
          totalTriggerCount: 0,
          totalSuccessCount: 0,
          totalFailureCount: 0,
          createdBy: userEmail || userId
        }
      });

      // Create audit log
      await prisma.configurationAuditLog.create({
        data: {
          tenantId,
          entityType: 'WEBHOOK_CONFIG',
          entityId: webhook.id,
          action: AuditAction.CREATE,
          performedBy: userId,
          performedByEmail: userEmail,
          performedByName: req.user?.name,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          sessionId: req.auth?.sessionId,
          riskLevel: RiskLevel.MEDIUM,
          platform: platform.toUpperCase() as Platform,
          metadata: {
            endpointUrl,
            subscribedEvents,
            authType,
            timestamp: new Date().toISOString()
          }
        }
      });

      res.json(createSuccessResponse({
        success: true,
        webhookId: webhook.id,
        platform: webhook.platform,
        endpointUrl: webhook.endpointUrl,
        subscribedEvents: webhook.subscribedEvents,
        isActive: webhook.isActive,
        message: 'Webhook configuration created successfully'
      }, 'Webhook configured'));

    } catch (error) {
      logger.error('Failed to configure webhook:', error);
      res.status(500).json(createErrorResponse(
        'Failed to configure webhook',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  })
);

/**
 * DELETE /api/config/:platform
 * Remove platform configuration
 * Requires OWNER role
 */
configRoutes.delete('/:platform',
  requireTenantRole(TenantRole.OWNER) as any,
  auditLog('CONFIG_DELETE') as any,
  asyncHandler(async (req: ConfigRequest, res: Response) => {
    const tenantId = req.tenant?.id;
    const userId = req.auth?.userId;
    const userEmail = req.auth?.email;
    const { platform } = req.params;
    
    // Validate platform
    const platformUpper = platform.toUpperCase();
    if (!Object.values(Platform).includes(platformUpper as Platform)) {
      return res.status(400).json(createErrorResponse(
        'Invalid platform',
        `Platform must be one of: ${Object.values(Platform).join(', ')}`
      ));
    }

    try {
      // Soft delete configuration
      const result = await prisma.integrationConfig.updateMany({
        where: {
          tenantId,
          platform: platformUpper as Platform,
          deletedAt: null
        },
        data: {
          isActive: false,
          deletedAt: new Date(),
          updatedBy: userEmail || userId
        }
      });

      if (result.count === 0) {
        return res.status(404).json(createErrorResponse(
          'Configuration not found',
          `No active ${platform} configuration found`
        ));
      }

      // Also deactivate webhooks
      await prisma.webhookConfiguration.updateMany({
        where: {
          tenantId,
          platform: platformUpper as Platform,
          deletedAt: null
        },
        data: {
          isActive: false,
          deletedAt: new Date(),
          updatedBy: userEmail || userId
        }
      });

      // Create audit log
      await prisma.configurationAuditLog.create({
        data: {
          tenantId,
          entityType: 'INTEGRATION_CONFIG',
          entityId: tenantId,
          action: AuditAction.DELETE,
          performedBy: userId,
          performedByEmail: userEmail,
          performedByName: req.user?.name,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          sessionId: req.auth?.sessionId,
          riskLevel: RiskLevel.HIGH,
          platform: platformUpper as Platform,
          metadata: {
            timestamp: new Date().toISOString(),
            configurationsDeleted: result.count
          }
        }
      });

      res.json(createSuccessResponse({
        success: true,
        platform: platformUpper,
        configurationsDeleted: result.count,
        message: `${platform} configuration removed successfully`
      }, 'Configuration deleted'));

    } catch (error) {
      logger.error(`Failed to delete ${platform} config:`, error);
      res.status(500).json(createErrorResponse(
        'Failed to delete configuration',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  })
);

/**
 * GET /api/config/audit-logs
 * Get configuration audit logs
 * Requires ADMIN or OWNER role
 */
configRoutes.get('/audit-logs',
  requireTenantRole(TenantRole.ADMIN, TenantRole.OWNER) as any,
  asyncHandler(async (req: ConfigRequest, res: Response) => {
    const tenantId = req.tenant?.id;
    const { 
      entityType, 
      action, 
      performedBy, 
      riskLevel,
      startDate,
      endDate,
      limit = 50
    } = req.query;

    try {
      const where: Prisma.ConfigurationAuditLogWhereInput = {
        tenantId
      };

      if (entityType) where.entityType = entityType as any;
      if (action) where.action = action as any;
      if (performedBy) where.performedBy = performedBy as string;
      if (riskLevel) where.riskLevel = riskLevel as any;
      
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate as string);
        if (endDate) where.createdAt.lte = new Date(endDate as string);
      }

      const logs = await prisma.configurationAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(Number(limit), 100),
        select: {
          id: true,
          entityType: true,
          entityId: true,
          action: true,
          fieldName: true,
          oldValue: true,
          newValue: true,
          changeReason: true,
          performedBy: true,
          performedByEmail: true,
          performedByName: true,
          ipAddress: true,
          riskLevel: true,
          requiresReview: true,
          reviewedBy: true,
          reviewedAt: true,
          platform: true,
          environment: true,
          metadata: true,
          createdAt: true
        }
      });

      res.json(createSuccessResponse({
        logs,
        count: logs.length,
        filters: {
          entityType,
          action,
          performedBy,
          riskLevel,
          startDate,
          endDate
        }
      }, 'Audit logs retrieved'));

    } catch (error) {
      logger.error('Failed to get audit logs:', error);
      res.status(500).json(createErrorResponse(
        'Failed to retrieve audit logs',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  })
);