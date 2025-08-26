'use client';

/**
 * Protected Route Component
 * Wraps components that require authentication
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { ProtectedRouteProps } from '../../types/auth';

export function ProtectedRoute({
  children,
  requiredRole,
  requireTenant = false,
  fallbackUrl = '/auth/signin'
}: ProtectedRouteProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading, tenant, hasRole } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    // Check authentication
    if (!isAuthenticated) {
      router.push(fallbackUrl);
      return;
    }

    // Check tenant requirement
    if (requireTenant && !tenant) {
      router.push('/tenants/select');
      return;
    }

    // Check role requirement
    if (requiredRole && !hasRole(requiredRole)) {
      router.push('/unauthorized');
      return;
    }
  }, [isAuthenticated, isLoading, tenant, requiredRole, requireTenant, hasRole, router, fallbackUrl]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-2 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render children until all checks pass
  if (!isAuthenticated) return null;
  if (requireTenant && !tenant) return null;
  if (requiredRole && !hasRole(requiredRole)) return null;

  return <>{children}</>;
}