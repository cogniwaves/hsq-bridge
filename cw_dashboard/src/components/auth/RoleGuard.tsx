'use client';

/**
 * Role Guard Component
 * Ensures user has the required role in the current tenant
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTenant } from '../../hooks/useTenant';
import { TenantRole } from '../../types/auth';

interface RoleGuardProps {
  children: React.ReactNode;
  requiredRole: TenantRole;
  fallbackUrl?: string;
}

export function RoleGuard({
  children,
  requiredRole,
  fallbackUrl = '/unauthorized'
}: RoleGuardProps) {
  const router = useRouter();
  const { hasRole } = useTenant();

  useEffect(() => {
    if (!hasRole(requiredRole)) {
      router.push(fallbackUrl);
    }
  }, [hasRole, requiredRole, router, fallbackUrl]);

  // Don't render if role requirement is not met
  if (!hasRole(requiredRole)) {
    return null;
  }

  return <>{children}</>;
}