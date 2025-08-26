// Middleware d'authentification basique pour l'API
import { Request, Response, NextFunction } from 'express';
import { User, Tenant, TenantMembership } from '@prisma/client';
import { logger } from '../utils/logger';
import { extractTokenFromHeader, verifyAccessToken } from '../utils/auth/jwtUtils';
import { sessionService } from '../services/auth/sessionService';

// Interface pour le request avec utilisateur authentifié
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    type: 'api_key' | 'basic_auth' | 'jwt';
    permissions?: string[];
  };
  // JWT-specific auth context
  auth?: {
    userId: string;
    email: string;
    sessionId?: string;
    isSuperAdmin?: boolean;
    type: 'jwt';
  };
  userDetails?: User;
  tenant?: Tenant;
  membership?: TenantMembership;
}

// Configuration des clés API (en production, utiliser des variables d'environnement)
const API_KEYS = new Set([
  process.env.API_KEY_ADMIN,
  process.env.API_KEY_READ_ONLY,
  process.env.API_KEY_WEBHOOK
].filter(Boolean));

// Configuration d'authentification basique
const BASIC_AUTH_USERS = new Map([
  ['admin', process.env.ADMIN_PASSWORD || 'admin123'],
  ['readonly', process.env.READONLY_PASSWORD || 'readonly123']
]);

// Middleware d'authentification par clé API
export function apiKeyAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const apiKey = req.header('X-API-Key') || req.query.api_key as string;
  
  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: 'API key required',
      message: 'Provide API key in X-API-Key header or api_key query parameter',
      timestamp: new Date().toISOString()
    });
    return;
  }
  
  if (!API_KEYS.has(apiKey)) {
    logger.warn(`Invalid API key attempt: ${req.ip}`);
    res.status(401).json({
      success: false,
      error: 'Invalid API key',
      timestamp: new Date().toISOString()
    });
    return;
  }
  
  // Déterminer les permissions selon la clé
  let permissions: string[] = [];
  if (apiKey === process.env.API_KEY_ADMIN) {
    permissions = ['read', 'write', 'admin'];
  } else if (apiKey === process.env.API_KEY_READ_ONLY) {
    permissions = ['read'];
  } else if (apiKey === process.env.API_KEY_WEBHOOK) {
    permissions = ['webhook'];
  }
  
  req.user = {
    id: `api_key_${apiKey.substring(0, 8)}`,
    type: 'api_key',
    permissions
  };
  
  next();
}

// Middleware d'authentification basique
export function basicAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.status(401).json({
      success: false,
      error: 'Basic authentication required',
      message: 'Provide Authorization: Basic <credentials> header',
      timestamp: new Date().toISOString()
    });
    return;
  }
  
  try {
    const credentials = Buffer.from(authHeader.substring(6), 'base64').toString();
    const [username, password] = credentials.split(':');
    
    if (!username || !password) {
      throw new Error('Invalid credentials format');
    }
    
    const validPassword = BASIC_AUTH_USERS.get(username);
    if (!validPassword || validPassword !== password) {
      logger.warn(`Invalid basic auth attempt for user: ${username} from IP: ${req.ip}`);
      res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    // Déterminer les permissions selon l'utilisateur
    let permissions: string[] = [];
    if (username === 'admin') {
      permissions = ['read', 'write', 'admin'];
    } else if (username === 'readonly') {
      permissions = ['read'];
    }
    
    req.user = {
      id: username,
      type: 'basic_auth',
      permissions
    };
    
    next();
  } catch (error) {
    logger.error('Basic auth error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid authorization header',
      timestamp: new Date().toISOString()
    });
  }
}

// JWT authentication middleware
export async function jwtAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.header('Authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'JWT token required',
        message: 'Provide Bearer token in Authorization header',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Verify token and get session info
    const sessionInfo = await sessionService.validateSession(token);

    // Add auth context to request
    req.auth = {
      userId: sessionInfo.user.id,
      email: sessionInfo.user.email,
      sessionId: sessionInfo.session.id,
      isSuperAdmin: sessionInfo.user.isSuperAdmin,
      type: 'jwt',
    };

    req.user = {
      id: sessionInfo.user.id,
      type: 'jwt',
      permissions: determinePermissionsFromRole(sessionInfo.membership?.role),
    };

    req.userDetails = sessionInfo.user;
    req.tenant = sessionInfo.tenant;
    req.membership = sessionInfo.membership;

    next();
  } catch (error) {
    logger.warn('JWT authentication failed', { error: error.message, ip: req.ip });
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
      timestamp: new Date().toISOString(),
    });
  }
}

// Middleware combiné (JWT, API Key OU Basic Auth)
export function flexibleAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.header('Authorization');
  const hasApiKey = req.header('X-API-Key') || req.query.api_key;
  const hasBasicAuth = authHeader?.startsWith('Basic ');
  const hasBearerToken = authHeader?.startsWith('Bearer ');
  
  // Prefer JWT if Bearer token is present
  if (hasBearerToken) {
    return jwtAuth(req, res, next) as any;
  } else if (hasApiKey) {
    return apiKeyAuth(req, res, next);
  } else if (hasBasicAuth) {
    return basicAuth(req, res, next);
  } else {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'Provide Bearer token, API key, or Basic authentication',
      options: {
        jwt: 'Add Authorization: Bearer <token> header',
        apiKey: 'Add X-API-Key header with your API key',
        basicAuth: 'Add Authorization: Basic <base64(username:password)> header'
      },
      timestamp: new Date().toISOString()
    });
  }
}

// Middleware de vérification des permissions
export function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    if (!req.user.permissions?.includes(permission) && !req.user.permissions?.includes('admin')) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        required: permission,
        provided: req.user.permissions,
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    next();
  };
}

// Middleware pour les webhooks (plus permissif)
export function webhookAuth(req: Request, res: Response, next: NextFunction): void {
  // Les webhooks peuvent utiliser une clé spéciale ou être sans auth selon la configuration
  const webhookKey = req.header('X-Webhook-Key') || process.env.WEBHOOK_SECRET;
  
  if (process.env.NODE_ENV === 'production' && webhookKey !== process.env.WEBHOOK_SECRET) {
    logger.warn(`Invalid webhook key from IP: ${req.ip}`);
    res.status(401).json({
      success: false,
      error: 'Invalid webhook key',
      timestamp: new Date().toISOString()
    });
    return;
  }
  
  next();
}

// Helper function to determine permissions from role
function determinePermissionsFromRole(role?: string): string[] {
  switch (role) {
    case 'OWNER':
      return ['read', 'write', 'admin', 'delete'];
    case 'ADMIN':
      return ['read', 'write', 'admin'];
    case 'MEMBER':
      return ['read', 'write'];
    case 'VIEWER':
      return ['read'];
    default:
      return [];
  }
}

// Middleware de logging des requêtes authentifiées
export function logAuthenticatedRequest(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (req.user) {
    logger.info(`Authenticated request: ${req.method} ${req.path}`, {
      userId: req.user.id,
      authType: req.user.type,
      permissions: req.user.permissions,
      tenantId: req.tenant?.id,
      ip: req.ip,
      userAgent: req.header('User-Agent')
    });
  }
  next();
}

// Enhanced permission checking with tenant context
export function requireTenantPermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    // Super admin bypass
    if (req.auth?.isSuperAdmin) {
      next();
      return;
    }

    // Check if user has required permission
    if (!req.user.permissions?.includes(permission) && !req.user.permissions?.includes('admin')) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        required: permission,
        provided: req.user.permissions,
        tenantRole: req.membership?.role,
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    next();
  };
}

// Export JWT-specific middleware from jwtAuth module
export { 
  requireTenantRole,
  requireTenant,
  requireSuperAdmin,
  tenantIsolation,
  perUserRateLimit,
  auditLog 
} from './jwtAuth';