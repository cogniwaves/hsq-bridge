'use client';

/**
 * Tenant Guard Component
 * Ensures user has access to the current tenant
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { TenantRole } from '../../types/auth';

interface TenantGuardProps {
  children: React.ReactNode;
  tenantId: string;
  requiredRole?: TenantRole;
  fallbackUrl?: string;
}

export function TenantGuard({
  children,
  tenantId,
  requiredRole,
  fallbackUrl = '/unauthorized'
}: TenantGuardProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading, canAccessTenant, hasRole, tenant } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    // Check authentication first
    if (!isAuthenticated) {
      router.push('/auth/signin');
      return;
    }

    // Check tenant access
    if (!canAccessTenant(tenantId)) {
      router.push(fallbackUrl);
      return;
    }

    // Check if it's the current tenant
    if (tenant?.id !== tenantId) {
      // Optionally switch to the tenant or redirect
      router.push('/tenants/select');
      return;
    }

    // Check role if required
    if (requiredRole && !hasRole(requiredRole)) {
      router.push(fallbackUrl);
      return;
    }
  }, [isAuthenticated, isLoading, tenantId, requiredRole, canAccessTenant, hasRole, tenant, router, fallbackUrl]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Don't render if checks fail
  if (!isAuthenticated || !canAccessTenant(tenantId)) {
    return null;
  }

  if (tenant?.id !== tenantId) {
    return null;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return null;
  }

  return <>{children}</>;
}