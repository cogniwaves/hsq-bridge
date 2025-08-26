import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { JWTAuthenticatedRequest } from './jwtAuth';
import { AuthenticatedRequest } from './auth';

/**
 * Enhanced tenant-aware middleware for existing API routes
 * Provides tenant context and data isolation for multi-tenant operations
 */

// Combined request type that supports both auth systems
export interface TenantAwareRequest extends AuthenticatedRequest, JWTAuthenticatedRequest {
  tenantContext?: {
    tenantId?: string;
    tenantSlug?: string;
    enforceIsolation: boolean;
    source: 'jwt' | 'api_key' | 'none';
  };
}

/**
 * Tenant context middleware - extracts tenant information from JWT or API key context
 */
export function addTenantContext(req: TenantAwareRequest, res: Response, next: NextFunction): void {
  try {
    // Initialize tenant context
    req.tenantContext = {
      enforceIsolation: false,
      source: 'none',
    };

    // Check for JWT authentication with tenant context
    if (req.auth?.type === 'jwt' && req.tenant) {
      req.tenantContext = {
        tenantId: req.tenant.id,
        tenantSlug: req.tenant.slug,
        enforceIsolation: true,
        source: 'jwt',
      };
      
      logger.debug('JWT tenant context added', {
        userId: req.auth.userId,
        tenantId: req.tenant.id,
        tenantSlug: req.tenant.slug,
        path: req.path,
      });
    }
    // Check for API key authentication (no tenant isolation by default)
    else if (req.user?.type === 'api_key') {
      // API keys bypass tenant isolation for backward compatibility
      req.tenantContext = {
        enforceIsolation: false,
        source: 'api_key',
      };
      
      logger.debug('API key context added (no tenant isolation)', {
        userId: req.user.id,
        path: req.path,
      });
    }
    // Basic auth or no auth
    else if (req.user?.type === 'basic_auth') {
      req.tenantContext = {
        enforceIsolation: false,
        source: 'api_key', // Treat basic auth like API key
      };
    }

    // Add tenant context to response locals for database operations
    if (req.tenantContext.tenantId) {
      res.locals.tenantId = req.tenantContext.tenantId;
      res.locals.tenantSlug = req.tenantContext.tenantSlug;
      res.locals.enforceTenantIsolation = req.tenantContext.enforceIsolation;
    }

    next();
  } catch (error) {
    logger.error('Failed to add tenant context', {
      error: error.message,
      path: req.path,
      userId: req.auth?.userId || req.user?.id,
    });
    next(); // Continue without tenant context rather than failing
  }
}

/**
 * Tenant isolation filter for database queries
 * Helps modify Prisma queries to include tenant filtering
 */
export class TenantQueryFilter {
  static addTenantFilter(baseWhere: any, tenantId?: string): any {
    if (!tenantId) {
      return baseWhere;
    }

    // Add tenant filtering to the base where clause
    return {
      ...baseWhere,
      // Assuming tenant relationships exist on relevant models
      tenant: {
        id: tenantId,
      },
    };
  }

  static addTenantFilterToInvoices(baseWhere: any, tenantId?: string): any {
    if (!tenantId) {
      return baseWhere;
    }

    return {
      ...baseWhere,
      tenantId: tenantId,
    };
  }

  static addTenantFilterToPayments(baseWhere: any, tenantId?: string): any {
    if (!tenantId) {
      return baseWhere;
    }

    return {
      ...baseWhere,
      tenantId: tenantId,
    };
  }
}

/**
 * Middleware that requires tenant context for JWT users
 */
export function requireTenantForJWT(req: TenantAwareRequest, res: Response, next: NextFunction): void {
  // If using JWT auth, tenant context is required
  if (req.auth?.type === 'jwt' && !req.tenantContext?.tenantId) {
    res.status(403).json({
      success: false,
      error: 'Tenant context required',
      message: 'JWT users must select a tenant to access this resource',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  next();
}

/**
 * Helper function to get tenant-aware Prisma query options
 */
export function getTenantAwareQueryOptions(req: TenantAwareRequest, baseOptions: any = {}) {
  const options = { ...baseOptions };

  if (req.tenantContext?.enforceIsolation && req.tenantContext.tenantId) {
    // Add tenant filtering to where clause
    options.where = TenantQueryFilter.addTenantFilter(options.where || {}, req.tenantContext.tenantId);
  }

  return options;
}

/**
 * Middleware to log tenant-aware operations
 */
export function logTenantOperation(operation: string) {
  return (req: TenantAwareRequest, res: Response, next: NextFunction): void => {
    logger.info('Tenant-aware operation', {
      operation,
      userId: req.auth?.userId || req.user?.id,
      tenantId: req.tenantContext?.tenantId,
      tenantSlug: req.tenantContext?.tenantSlug,
      enforceIsolation: req.tenantContext?.enforceIsolation,
      authSource: req.tenantContext?.source,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    next();
  };
}

/**
 * Response middleware that removes tenant information from responses for API key users
 * (for security and backward compatibility)
 */
export function sanitizeTenantResponse(req: TenantAwareRequest, res: Response, next: NextFunction): void {
  const originalJson = res.json;

  res.json = function(body: any) {
    // If using API key auth, remove tenant-specific fields from response
    if (req.tenantContext?.source === 'api_key' && body && typeof body === 'object') {
      // Remove tenant fields that shouldn't be exposed to API key users
      if (Array.isArray(body.data)) {
        body.data = body.data.map((item: any) => {
          const { tenantId, tenantSlug, ...sanitizedItem } = item;
          return sanitizedItem;
        });
      } else if (body.data && typeof body.data === 'object') {
        const { tenantId, tenantSlug, ...sanitizedData } = body.data;
        body.data = sanitizedData;
      }
    }

    return originalJson.call(this, body);
  };

  next();
}

/**
 * Utility function to check if current request has tenant access to a resource
 */
export function checkTenantAccess(req: TenantAwareRequest, resourceTenantId?: string): boolean {
  // API key users have access to all resources (backward compatibility)
  if (req.tenantContext?.source === 'api_key') {
    return true;
  }

  // JWT users must have matching tenant ID
  if (req.tenantContext?.source === 'jwt') {
    return req.tenantContext.tenantId === resourceTenantId;
  }

  // No authentication or unknown auth type
  return false;
}

/**
 * Express middleware to validate tenant access to a specific resource
 */
export function validateTenantAccess(getResourceTenantId: (req: TenantAwareRequest) => Promise<string | null>) {
  return async (req: TenantAwareRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const resourceTenantId = await getResourceTenantId(req);
      
      if (resourceTenantId && !checkTenantAccess(req, resourceTenantId)) {
        res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'You do not have access to this resource in the specified tenant',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Failed to validate tenant access', {
        error: error.message,
        userId: req.auth?.userId || req.user?.id,
        path: req.path,
      });

      res.status(500).json({
        success: false,
        error: 'Access validation failed',
        message: 'Unable to validate resource access',
        timestamp: new Date().toISOString(),
      });
    }
  };
}