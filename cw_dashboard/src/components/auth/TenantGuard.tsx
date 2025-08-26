'use client';

/**
 * Tenant Guard Component
 * Ensures user has access to the current tenant
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTenant } from '../../hooks/useTenant';

interface TenantGuardProps {
  children: React.ReactNode;
  requiredTenantId?: string;
  requiredTenantSlug?: string;
}

export function TenantGuard({
  children,
  requiredTenantId,
  requiredTenantSlug
}: TenantGuardProps) {
  const router = useRouter();
  const { tenant, availableTenants } = useTenant();

  useEffect(() => {
    if (requiredTenantId && tenant?.id !== requiredTenantId) {
      // Check if user has access to the required tenant
      const hasAccess = availableTenants.some(t => t.id === requiredTenantId);
      
      if (!hasAccess) {
        router.push('/unauthorized');
      }
    }

    if (requiredTenantSlug && tenant?.slug !== requiredTenantSlug) {
      // Check if user has access to the required tenant
      const hasAccess = availableTenants.some(t => t.slug === requiredTenantSlug);
      
      if (!hasAccess) {
        router.push('/unauthorized');
      }
    }
  }, [tenant, requiredTenantId, requiredTenantSlug, availableTenants, router]);

  // Don't render if tenant requirements are not met
  if (requiredTenantId && tenant?.id !== requiredTenantId) {
    return null;
  }

  if (requiredTenantSlug && tenant?.slug !== requiredTenantSlug) {
    return null;
  }

  return <>{children}</>;
}