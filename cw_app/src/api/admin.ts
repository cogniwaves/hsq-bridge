// Endpoints d'administration pour la gestion des utilisateurs et de la sécurité
import { Router } from 'express';
import { ApiHandler, AuthenticatedRequest } from '../types/api';
import { requirePermission } from '../middleware/auth';
import { getRateLimitStats, resetAllRateLimits, rateLimits } from '../middleware/rateLimiting';
import { logger } from '../utils/logger';

export const adminRoutes = Router();

// Endpoint pour afficher les informations d'authentification actuelles
adminRoutes.get('/auth/whoami', ((req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Not authenticated',
      timestamp: new Date().toISOString()
    });
    return;
  }

  res.json({
    success: true,
    data: {
      userId: req.user.id,
      authType: req.user.type,
      permissions: req.user.permissions || [],
      authenticated: true
    },
    timestamp: new Date().toISOString()
  });
}) as ApiHandler);

// Endpoint pour tester différents niveaux de permissions
adminRoutes.get('/auth/test-permissions', ((req: AuthenticatedRequest, res) => {
  const userPermissions = req.user?.permissions || [];
  
  res.json({
    success: true,
    data: {
      userId: req.user?.id,
      permissions: userPermissions,
      tests: {
        canRead: userPermissions.includes('read') || userPermissions.includes('admin'),
        canWrite: userPermissions.includes('write') || userPermissions.includes('admin'),
        canAdmin: userPermissions.includes('admin'),
        canWebhook: userPermissions.includes('webhook') || userPermissions.includes('admin')
      }
    },
    timestamp: new Date().toISOString()
  });
}) as ApiHandler);

// Endpoint pour obtenir les statistiques de rate limiting (admin seulement)
adminRoutes.get('/security/rate-limits', requirePermission('admin'), ((req, res) => {
  const stats = getRateLimitStats();
  
  res.json({
    success: true,
    data: {
      rateLimits: stats,
      summary: {
        totalActiveKeys: stats.totalKeys,
        topConsumers: stats.entries.slice(0, 10)
      }
    },
    timestamp: new Date().toISOString()
  });
}) as ApiHandler);

// Endpoint pour réinitialiser tous les rate limits (admin seulement)
adminRoutes.post('/security/rate-limits/reset', requirePermission('admin'), ((req: AuthenticatedRequest, res) => {
  const resetCount = resetAllRateLimits();
  
  logger.warn(`Rate limits reset by admin`, {
    adminId: req.user?.id,
    resetCount,
    ip: req.ip
  });
  
  res.json({
    success: true,
    message: 'All rate limits have been reset',
    data: {
      entriesCleared: resetCount
    },
    timestamp: new Date().toISOString()
  });
}) as ApiHandler);

// Endpoint pour obtenir des métriques système (admin seulement)
adminRoutes.get('/system/metrics', requirePermission('admin'), ((req, res) => {
  const memoryUsage = process.memoryUsage();
  
  res.json({
    success: true,
    data: {
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: Math.floor(process.uptime()),
        environment: process.env.NODE_ENV || 'development'
      },
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`
      },
      process: {
        pid: process.pid,
        ppid: process.ppid,
        uid: process.getuid?.(),
        gid: process.getgid?.()
      }
    },
    timestamp: new Date().toISOString()
  });
}) as ApiHandler);

// Endpoint pour tester différents types d'authentification
adminRoutes.get('/auth/test-modes', rateLimits.admin, ((req, res) => {
  const authHeader = req.header('Authorization');
  const apiKey = req.header('X-API-Key') || req.query.api_key;
  
  res.json({
    success: true,
    data: {
      detectedAuthMethods: {
        hasBasicAuth: !!authHeader?.startsWith('Basic '),
        hasApiKey: !!apiKey,
        authHeaderPresent: !!authHeader,
        apiKeyPresent: !!apiKey
      },
      recommendations: {
        apiKey: {
          method: 'Add X-API-Key header',
          example: 'X-API-Key: your-api-key-here'
        },
        basicAuth: {
          method: 'Add Authorization header',
          example: 'Authorization: Basic ' + Buffer.from('username:password').toString('base64')
        }
      },
      testCredentials: {
        basic: {
          admin: 'admin:admin123',
          readonly: 'readonly:readonly123'
        },
        note: 'Use these credentials only in development'
      }
    },
    timestamp: new Date().toISOString()
  });
}) as ApiHandler);

// Endpoint pour la validation des variables d'environnement (admin seulement)
adminRoutes.get('/system/env-validation', requirePermission('admin'), ((req, res) => {
  const requiredEnvVars = [
    'HUBSPOT_PRIVATE_APP_TOKEN',
    'DATABASE_URL',
    'API_KEY_ADMIN',
    'API_KEY_READ_ONLY'
  ];
  
  const optionalEnvVars = [
    'API_KEY_WEBHOOK',
    'WEBHOOK_SECRET',
    'ADMIN_PASSWORD',
    'READONLY_PASSWORD',
    'STRIPE_WEBHOOK_SECRET',
    'QUICKBOOKS_CLIENT_ID'
  ];
  
  const envStatus = {
    required: {} as Record<string, boolean>,
    optional: {} as Record<string, boolean>
  };
  
  requiredEnvVars.forEach(envVar => {
    envStatus.required[envVar] = !!process.env[envVar];
  });
  
  optionalEnvVars.forEach(envVar => {
    envStatus.optional[envVar] = !!process.env[envVar];
  });
  
  const missingRequired = Object.entries(envStatus.required)
    .filter(([, present]) => !present)
    .map(([name]) => name);
  
  res.json({
    success: true,
    data: {
      environment: process.env.NODE_ENV || 'development',
      status: {
        allRequiredPresent: missingRequired.length === 0,
        missingRequired,
        requiredVars: envStatus.required,
        optionalVars: envStatus.optional
      },
      recommendations: missingRequired.length > 0 ? [
        'Set missing required environment variables',
        'Check .env file or system environment',
        'Restart application after setting variables'
      ] : [
        'All required environment variables are set',
        'Consider setting optional variables for full functionality'
      ]
    },
    timestamp: new Date().toISOString()
  });
}) as ApiHandler);

// Endpoint de documentation sur l'authentification
adminRoutes.get('/auth/docs', rateLimits.public, ((req, res) => {
  res.json({
    success: true,
    documentation: {
      title: 'API Authentication Guide',
      version: '1.0.0',
      methods: {
        apiKey: {
          description: 'Use X-API-Key header with your API key',
          header: 'X-API-Key',
          example: 'X-API-Key: your-api-key-here',
          permissions: {
            'API_KEY_ADMIN': ['read', 'write', 'admin'],
            'API_KEY_READ_ONLY': ['read'],
            'API_KEY_WEBHOOK': ['webhook']
          }
        },
        basicAuth: {
          description: 'Use Basic Authentication with username:password',
          header: 'Authorization',
          example: 'Authorization: Basic ' + Buffer.from('admin:admin123').toString('base64'),
          users: {
            admin: ['read', 'write', 'admin'],
            readonly: ['read']
          }
        }
      },
      permissions: {
        read: 'Access to read-only endpoints (invoices, dashboard, metrics)',
        write: 'Access to write operations (extraction, sync)',
        admin: 'Full administrative access including system management',
        webhook: 'Access to webhook endpoints'
      },
      rateLimits: {
        public: '50 requests per 15 minutes',
        api: '200 requests per 10 minutes',
        admin: '500 requests per 5 minutes',
        webhook: '1000 requests per minute',
        write: '100 requests per 15 minutes'
      },
      examples: {
        curl: {
          apiKey: 'curl -H "X-API-Key: your-key" http://localhost:3000/api/invoices',
          basicAuth: 'curl -u admin:admin123 http://localhost:3000/api/invoices'
        }
      }
    },
    timestamp: new Date().toISOString()
  });
}) as ApiHandler);