'use client';

/**
 * Tenant Management Hook
 * Provides tenant-specific operations and state
 */

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from './useAuth';
import { Tenant, TenantMembership, TenantRole, ApiResponse } from '../types/auth';
import { authApi } from '../utils/auth';

interface UseTenantReturn {
  currentTenant: Tenant | null;
  memberships: TenantMembership[];
  isLoading: boolean;
  error: string | null;
  switchTenant: (tenantId: string) => Promise<void>;
  createTenant: (name: string) => Promise<Tenant>;
  updateTenant: (tenantId: string, data: Partial<Tenant>) => Promise<void>;
  inviteUser: (email: string, role: TenantRole) => Promise<void>;
  removeUser: (userId: string) => Promise<void>;
  updateUserRole: (userId: string, role: TenantRole) => Promise<void>;
  leaveTenant: (tenantId: string) => Promise<void>;
}

export function useTenant(): UseTenantReturn {
  const { tenant: currentTenant, memberships, switchTenant: authSwitchTenant } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Switch to a different tenant
  const switchTenant = useCallback(async (tenantId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await authSwitchTenant(tenantId);
    } catch (err: any) {
      setError(err.message || 'Failed to switch tenant');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [authSwitchTenant]);

  // Create a new tenant
  const createTenant = useCallback(async (name: string): Promise<Tenant> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authApi.post<ApiResponse<Tenant>>('/tenants', { name });
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Failed to create tenant');
      }
      return response.data.data;
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to create tenant';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update tenant information
  const updateTenant = useCallback(async (tenantId: string, data: Partial<Tenant>) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authApi.patch<ApiResponse>(`/tenants/${tenantId}`, data);
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to update tenant');
      }
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to update tenant';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Invite a user to the current tenant
  const inviteUser = useCallback(async (email: string, role: TenantRole) => {
    if (!currentTenant) {
      throw new Error('No tenant selected');
    }
    
    setIsLoading(true);
    setError(null);
    try {
      const response = await authApi.post<ApiResponse>(
        `/tenants/${currentTenant.id}/invitations`,
        { email, role }
      );
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to send invitation');
      }
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to send invitation';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant]);

  // Remove a user from the current tenant
  const removeUser = useCallback(async (userId: string) => {
    if (!currentTenant) {
      throw new Error('No tenant selected');
    }
    
    setIsLoading(true);
    setError(null);
    try {
      const response = await authApi.delete<ApiResponse>(
        `/tenants/${currentTenant.id}/members/${userId}`
      );
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to remove user');
      }
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to remove user';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant]);

  // Update a user's role in the current tenant
  const updateUserRole = useCallback(async (userId: string, role: TenantRole) => {
    if (!currentTenant) {
      throw new Error('No tenant selected');
    }
    
    setIsLoading(true);
    setError(null);
    try {
      const response = await authApi.patch<ApiResponse>(
        `/tenants/${currentTenant.id}/members/${userId}`,
        { role }
      );
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to update user role');
      }
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to update user role';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant]);

  // Leave a tenant
  const leaveTenant = useCallback(async (tenantId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authApi.post<ApiResponse>(
        `/tenants/${tenantId}/leave`
      );
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to leave tenant');
      }
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Failed to leave tenant';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    currentTenant,
    memberships,
    isLoading,
    error,
    switchTenant,
    createTenant,
    updateTenant,
    inviteUser,
    removeUser,
    updateUserRole,
    leaveTenant
  };
}