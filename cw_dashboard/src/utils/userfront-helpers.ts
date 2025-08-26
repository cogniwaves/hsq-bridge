/**
 * Userfront Helper Utilities
 * Utilities for working with Userfront authentication in multi-tenant scenarios
 */

import Userfront from '@userfront/core';

/**
 * Extract tenant ID from various sources
 * Priority: JWT claims > User object > URL subdomain > Default
 */
export function extractTenantId(
  user?: any,
  hostname?: string,
  defaultTenantId?: string
): string | null {
  // 1. Check JWT claims for tenant ID
  if (user?.authorization?.tenantId) {
    return user.authorization.tenantId;
  }

  // 2. Check user object for tenant ID
  if (user?.tenantId) {
    return user.tenantId;
  }

  // 3. Extract from subdomain (e.g., tenant1.app.com)
  if (hostname) {
    const subdomain = hostname.split('.')[0];
    if (subdomain && subdomain !== 'www' && subdomain !== 'app') {
      return subdomain;
    }
  }

  // 4. Return default if provided
  return defaultTenantId || null;
}

/**
 * Validate tenant access for a user
 * Ensures user has permission to access the requested tenant
 */
export function validateTenantAccess(
  user: any,
  requestedTenantId: string
): boolean {
  if (!user || !requestedTenantId) {
    return false;
  }

  // Check if user belongs to the tenant
  const userTenantId = extractTenantId(user);
  if (userTenantId === requestedTenantId) {
    return true;
  }

  // Check if user has multi-tenant access (admin role)
  if (user.authorization?.roles?.includes('admin')) {
    return true;
  }

  // Check tenant-specific roles
  const tenantRoles = user.authorization?.[`tenant_${requestedTenantId}`]?.roles;
  if (tenantRoles && tenantRoles.length > 0) {
    return true;
  }

  return false;
}

/**
 * Get user's accessible tenants
 * Returns list of tenant IDs the user can access
 */
export function getUserTenants(user: any): string[] {
  if (!user) {
    return [];
  }

  const tenants: Set<string> = new Set();

  // Add primary tenant
  const primaryTenant = extractTenantId(user);
  if (primaryTenant) {
    tenants.add(primaryTenant);
  }

  // Add tenants from authorization object
  if (user.authorization) {
    Object.keys(user.authorization).forEach(key => {
      if (key.startsWith('tenant_')) {
        const tenantId = key.replace('tenant_', '');
        tenants.add(tenantId);
      }
    });
  }

  // Add tenants from user metadata
  if (user.data?.tenants && Array.isArray(user.data.tenants)) {
    user.data.tenants.forEach((tenantId: string) => tenants.add(tenantId));
  }

  return Array.from(tenants);
}

/**
 * Check if user has a specific role in a tenant
 */
export function hasRoleInTenant(
  user: any,
  role: string,
  tenantId?: string
): boolean {
  if (!user) {
    return false;
  }

  // If no tenant specified, check global roles
  if (!tenantId) {
    return user.authorization?.roles?.includes(role) || false;
  }

  // Check tenant-specific roles
  const tenantAuth = user.authorization?.[`tenant_${tenantId}`];
  return tenantAuth?.roles?.includes(role) || false;
}

/**
 * Get user's roles for a specific tenant
 */
export function getTenantRoles(user: any, tenantId: string): string[] {
  if (!user || !tenantId) {
    return [];
  }

  const tenantAuth = user.authorization?.[`tenant_${tenantId}`];
  return tenantAuth?.roles || [];
}

/**
 * Format user display name with tenant context
 */
export function formatUserDisplay(user: any, includeTenant = false): string {
  if (!user) {
    return 'Guest';
  }

  let display = user.name || user.email || 'User';

  if (includeTenant) {
    const tenantId = extractTenantId(user);
    if (tenantId) {
      display += ` (${tenantId})`;
    }
  }

  return display;
}

/**
 * Build tenant-aware redirect URL
 */
export function buildTenantRedirectUrl(
  baseUrl: string,
  tenantId?: string,
  useSub domain = false
): string {
  if (!tenantId) {
    return baseUrl;
  }

  if (useSubdomain) {
    // Convert to subdomain format: tenant1.app.com
    const url = new URL(baseUrl);
    url.hostname = `${tenantId}.${url.hostname}`;
    return url.toString();
  } else {
    // Add as query parameter: app.com?tenant=tenant1
    const url = new URL(baseUrl);
    url.searchParams.set('tenant', tenantId);
    return url.toString();
  }
}

/**
 * Parse tenant from current URL
 */
export function parseTenantFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    
    // Check query parameter
    const tenantParam = urlObj.searchParams.get('tenant');
    if (tenantParam) {
      return tenantParam;
    }

    // Check subdomain
    const hostname = urlObj.hostname;
    const subdomain = hostname.split('.')[0];
    if (subdomain && subdomain !== 'www' && subdomain !== 'app' && subdomain !== 'localhost') {
      return subdomain;
    }

    // Check path segment (e.g., /tenant/tenant1/...)
    const pathMatch = urlObj.pathname.match(/^\/tenant\/([^\/]+)/);
    if (pathMatch) {
      return pathMatch[1];
    }
  } catch (error) {
    console.error('Error parsing tenant from URL:', error);
  }

  return null;
}

/**
 * Create tenant-scoped storage key
 * Useful for localStorage/sessionStorage in multi-tenant apps
 */
export function createTenantStorageKey(key: string, tenantId?: string): string {
  if (!tenantId) {
    return key;
  }
  return `tenant_${tenantId}_${key}`;
}

/**
 * Verify Userfront JWT token
 * Note: This is a client-side check. Always verify on the server as well.
 */
export function isTokenValid(): boolean {
  try {
    const accessToken = Userfront.tokens.accessToken;
    if (!accessToken) {
      return false;
    }

    // Decode token (base64)
    const tokenParts = accessToken.split('.');
    if (tokenParts.length !== 3) {
      return false;
    }

    const payload = JSON.parse(atob(tokenParts[1]));
    
    // Check expiration
    const now = Date.now() / 1000;
    if (payload.exp && payload.exp < now) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error validating token:', error);
    return false;
  }
}

/**
 * Get token expiration time
 */
export function getTokenExpiration(): Date | null {
  try {
    const accessToken = Userfront.tokens.accessToken;
    if (!accessToken) {
      return null;
    }

    const tokenParts = accessToken.split('.');
    if (tokenParts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(atob(tokenParts[1]));
    if (payload.exp) {
      return new Date(payload.exp * 1000);
    }
  } catch (error) {
    console.error('Error getting token expiration:', error);
  }

  return null;
}

/**
 * Refresh token if needed
 * Returns true if token was refreshed or is still valid
 */
export async function ensureValidToken(): Promise<boolean> {
  try {
    if (!isTokenValid()) {
      // Token is invalid or expired, try to refresh
      await Userfront.refresh();
      return isTokenValid();
    }
    return true;
  } catch (error) {
    console.error('Error ensuring valid token:', error);
    return false;
  }
}

/**
 * Multi-tenant API request helper
 * Automatically adds authentication and tenant headers
 */
export async function tenantApiRequest(
  url: string,
  options: RequestInit = {},
  tenantId?: string
): Promise<Response> {
  // Ensure we have a valid token
  const isValid = await ensureValidToken();
  if (!isValid) {
    throw new Error('Authentication required');
  }

  // Get the access token
  const accessToken = Userfront.tokens.accessToken;

  // Build headers
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  
  if (tenantId) {
    headers.set('X-Tenant-ID', tenantId);
  }

  // Make the request
  return fetch(url, {
    ...options,
    headers
  });
}

/**
 * Export all helpers as a namespace for convenience
 */
export const UserfrontHelpers = {
  extractTenantId,
  validateTenantAccess,
  getUserTenants,
  hasRoleInTenant,
  getTenantRoles,
  formatUserDisplay,
  buildTenantRedirectUrl,
  parseTenantFromUrl,
  createTenantStorageKey,
  isTokenValid,
  getTokenExpiration,
  ensureValidToken,
  tenantApiRequest
};