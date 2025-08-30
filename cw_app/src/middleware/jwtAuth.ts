import { Request, Response, NextFunction } from 'express';
import { User, Tenant, TenantMembership, TenantRole } from '@prisma/client';
import { logger } from '../utils/logger';
import { createError } from '../utils/errorHandler';
import { extractTokenFromHeader, verifyAccessToken } from '../utils/auth/jwtUtils';
import { sessionService } from '../services/auth/sessionService';

/**
 * Enhanced authentication middleware for JWT tokens
 * Provides tenant context and role-based authorization
 */

// Extend Express Request interface with auth context
export interface JWTAuthenticatedRequest extends Request {
  auth?: {
    userId: string;
    email: string;
    sessionId?: string;
    isSuperAdmin?: boolean;
    type: 'jwt';
  };
  user?: User;
  tenant?: Tenant;
  membership?: TenantMembership;
}

/**
 * JWT authentication middleware
 * Validates JWT tokens and adds user/tenant context to request
 */
export async function jwtAuth(
  req: JWTAuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.header('Authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'Provide Bearer token in Authorization header',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Debug: Log the received token to understand what's coming from frontend
    console.log('🔍 [DEBUG] JWT Auth - Token received:', {
      token: token ? `${token.substring(0, 20)}...` : 'null',
      length: token?.length,
      exact: token === 'dev-token-authenticated-user',
      path: req.path,
      method: req.method,
    });

    // Development mode: Allow mock authentication for dev tokens
    if (token === 'dev-token-authenticated-user') {
      logger.info('Development mode: Using mock authentication', {
        path: req.path,
        method: req.method,
      });
      
      // Create mock user context for development
      req.auth = {
        userId: 'dev-user-1',
        email: 'dev@example.com',
        sessionId: 'dev-session-1',
        isSuperAdmin: true,
        type: 'jwt',
      };

      // Create mock tenant and membership for development
      req.tenant = {
        id: 'dev-tenant-1',
        name: 'Development Tenant',
        slug: 'dev-tenant',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;
      
      req.membership = {
        id: 'dev-membership-1',
        userId: 'dev-user-1',
        tenantId: 'dev-tenant-1',
        role: 'OWNER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      req.user = {
        id: 'dev-user-1',
        email: 'dev@example.com',
        isActive: true,
        isSuperAdmin: true,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      logger.debug('Development JWT authenticated request', {
        userId: req.auth.userId,
        tenantId: req.tenant?.id,
        role: req.membership?.role,
        path: req.path,
        method: req.method,
      });

      next();
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

    req.user = sessionInfo.user;
    req.tenant = sessionInfo.tenant;
    req.membership = sessionInfo.membership;

    // Log authenticated request
    logger.debug('JWT authenticated request', {
      userId: req.auth.userId,
      tenantId: req.tenant?.id,
      role: req.membership?.role,
      path: req.path,
      method: req.method,
    });

    next();
  } catch (error) {
    logger.warn('JWT authentication failed', {
      error: error.message,
      path: req.path,
      ip: req.ip,
    });

    // Determine appropriate error code
    let statusCode = 401;
    let errorMessage = 'Authentication failed';

    if (error.message.includes('expired')) {
      errorMessage = 'Token expired';
    } else if (error.message.includes('invalid')) {
      errorMessage = 'Invalid token';
    } else if (error.message.includes('disabled') || error.message.includes('inactive')) {
      statusCode = 403;
      errorMessage = error.message;
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Optional JWT authentication middleware
 * Adds auth context if token is present but doesn't require it
 */
export async function optionalJwtAuth(
  req: JWTAuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.header('Authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      next();
      return;
    }

    // Try to validate session
    const sessionInfo = await sessionService.validateSession(token);

    req.auth = {
      userId: sessionInfo.user.id,
      email: sessionInfo.user.email,
      sessionId: sessionInfo.session.id,
      isSuperAdmin: sessionInfo.user.isSuperAdmin,
      type: 'jwt',
    };

    req.user = sessionInfo.user;
    req.tenant = sessionInfo.tenant;
    req.membership = sessionInfo.membership;
  } catch (error) {
    // Silent failure for optional auth
    logger.debug('Optional JWT auth failed', { error: error.message });
  }

  next();
}

/**
 * Require specific tenant role middleware
 */
export function requireTenantRole(...allowedRoles: TenantRole[]) {
  return (req: JWTAuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!req.tenant || !req.membership) {
      res.status(403).json({
        success: false,
        error: 'Tenant context required',
        message: 'You must be a member of a tenant to access this resource',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Super admins bypass role checks
    if (req.auth.isSuperAdmin) {
      next();
      return;
    }

    if (!allowedRoles.includes(req.membership.role)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        required: allowedRoles,
        provided: req.membership.role,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}

/**
 * Require tenant context middleware
 */
export function requireTenant(
  req: JWTAuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.auth) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (!req.tenant) {
    res.status(403).json({
      success: false,
      error: 'Tenant context required',
      message: 'Select a tenant to access this resource',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  next();
}

/**
 * Require super admin middleware
 */
export function requireSuperAdmin(
  req: JWTAuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.auth || !req.auth.isSuperAdmin) {
    res.status(403).json({
      success: false,
      error: 'Super admin access required',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  next();
}

/**
 * Tenant isolation middleware
 * Ensures all database queries are scoped to the current tenant
 */
export function tenantIsolation(
  req: JWTAuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.tenant) {
    next();
    return;
  }

  // Add tenant context to locals for database queries
  res.locals.tenantId = req.tenant.id;
  res.locals.tenantSlug = req.tenant.slug;

  // Log tenant-scoped request
  logger.debug('Tenant-scoped request', {
    tenantId: req.tenant.id,
    tenantSlug: req.tenant.slug,
    userId: req.auth?.userId,
    path: req.path,
  });

  next();
}

/**
 * Rate limiting by user/tenant
 */
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export function perUserRateLimit(
  maxRequests: number = 100,
  windowMinutes: number = 1
) {
  return (req: JWTAuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next();
      return;
    }

    const key = `${req.auth.userId}:${req.tenant?.id || 'no-tenant'}`;
    const now = Date.now();
    const window = windowMinutes * 60 * 1000;

    const record = requestCounts.get(key);

    if (!record || record.resetTime < now) {
      // Start new window
      requestCounts.set(key, {
        count: 1,
        resetTime: now + window,
      });
      next();
      return;
    }

    if (record.count >= maxRequests) {
      const remainingTime = Math.ceil((record.resetTime - now) / 1000);
      
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        message: `Try again in ${remainingTime} seconds`,
        limit: maxRequests,
        window: windowMinutes * 60,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    record.count++;
    next();
  };
}

/**
 * Audit logging middleware for sensitive operations
 */
export function auditLog(action: string) {
  return (req: JWTAuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next();
      return;
    }

    logger.info('Audit log', {
      action,
      userId: req.auth.userId,
      email: req.auth.email,
      tenantId: req.tenant?.id,
      tenantSlug: req.tenant?.slug,
      role: req.membership?.role,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      timestamp: new Date().toISOString(),
    });

    next();
  };
}