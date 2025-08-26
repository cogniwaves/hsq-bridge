'use client';

/**
 * Protected Route Component
 * Ensures only authenticated users can access protected pages
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { ProtectedRouteProps } from '../../types/auth';
import { redirectManager } from '../../utils/auth';

export function ProtectedRoute({
  children,
  requiredRole,
  requireTenant = false,
  fallbackUrl = '/auth/signin'
}: ProtectedRouteProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading, tenant, hasRole } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      // Check authentication
      if (!isAuthenticated) {
        // Save current URL for redirect after login
        if (typeof window !== 'undefined') {
          redirectManager.saveRedirectUrl(window.location.pathname);
        }
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
    }
  }, [isAuthenticated, isLoading, tenant, requiredRole, requireTenant, hasRole, router, fallbackUrl]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Don't render children until authentication is verified
  if (!isAuthenticated) {
    return null;
  }

  // Don't render if tenant is required but not selected
  if (requireTenant && !tenant) {
    return null;
  }

  // Don't render if role requirement is not met
  if (requiredRole && !hasRole(requiredRole)) {
    return null;
  }

  return <>{children}</>;
}