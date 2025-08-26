'use client';

/**
 * Tenant Management Hook
 * Provides tenant-specific operations and state
 */

import { useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import { TenantRole } from '../types/auth';

export function useTenant() {
  const { tenant, memberships, switchTenant, hasRole } = useAuth();

  // Get current tenant membership
  const currentMembership = useMemo(() => {
    if (!tenant) return null;
    return memberships.find(m => m.tenantId === tenant.id);
  }, [tenant, memberships]);

  // Get available tenants
  const availableTenants = useMemo(() => {
    return memberships.map(m => m.tenant);
  }, [memberships]);

  // Check if user is tenant owner
  const isOwner = useMemo(() => {
    return hasRole(TenantRole.OWNER);
  }, [hasRole]);

  // Check if user is tenant admin
  const isAdmin = useMemo(() => {
    return hasRole(TenantRole.ADMIN);
  }, [hasRole]);

  // Check if user can manage tenant (owner or admin)
  const canManageTenant = useMemo(() => {
    return isOwner || isAdmin;
  }, [isOwner, isAdmin]);

  // Switch to tenant by slug
  const switchToTenantBySlug = useCallback(async (slug: string) => {
    const targetTenant = memberships.find(m => m.tenant.slug === slug);
    if (targetTenant) {
      await switchTenant(targetTenant.tenantId);
    } else {
      throw new Error(`No access to tenant with slug: ${slug}`);
    }
  }, [memberships, switchTenant]);

  return {
    // Current tenant info
    tenant,
    currentMembership,
    currentRole: currentMembership?.role,
    
    // Available tenants
    availableTenants,
    hasMulitpleTenants: memberships.length > 1,
    
    // Permissions
    isOwner,
    isAdmin,
    canManageTenant,
    hasRole,
    
    // Actions
    switchTenant,
    switchToTenantBySlug
  };
}