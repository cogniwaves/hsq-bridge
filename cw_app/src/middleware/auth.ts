// Middleware d'authentification basique pour l'API
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Interface pour le request avec utilisateur authentifié
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    type: 'api_key' | 'basic_auth';
    permissions?: string[];
  };
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

// Middleware combiné (API Key OU Basic Auth)
export function flexibleAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const hasApiKey = req.header('X-API-Key') || req.query.api_key;
  const hasBasicAuth = req.header('Authorization')?.startsWith('Basic ');
  
  if (hasApiKey) {
    return apiKeyAuth(req, res, next);
  } else if (hasBasicAuth) {
    return basicAuth(req, res, next);
  } else {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'Provide either X-API-Key header or Basic authentication',
      options: {
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

// Middleware de logging des requêtes authentifiées
export function logAuthenticatedRequest(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (req.user) {
    logger.info(`Authenticated request: ${req.method} ${req.path}`, {
      userId: req.user.id,
      authType: req.user.type,
      permissions: req.user.permissions,
      ip: req.ip,
      userAgent: req.header('User-Agent')
    });
  }
  next();
}