'use client';

/**
 * Tenant Selection Page
 * Allows users to select which tenant to access when they belong to multiple
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { useTenant } from '../../../hooks/useTenant';
import { BuildingOfficeIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

export default function TenantSelectPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { availableTenants, switchTenant } = useTenant();
  
  useEffect(() => {
    // If user only has one tenant, automatically select it
    if (availableTenants.length === 1) {
      handleTenantSelect(availableTenants[0].id);
    }
    
    // If not authenticated, redirect to sign in
    if (!isAuthenticated) {
      router.push('/auth/signin');
    }
  }, [availableTenants, isAuthenticated]);
  
  const handleTenantSelect = async (tenantId: string) => {
    try {
      await switchTenant(tenantId);
      router.push('/');
    } catch (error) {
      console.error('Failed to switch tenant:', error);
    }
  };
  
  if (!isAuthenticated || availableTenants.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2"
             style={{ borderBottomColor: 'var(--color-primary)' }}></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8"
         style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="text-center text-3xl font-bold"
            style={{ color: 'var(--color-text-primary)' }}>
          Select Organization
        </h2>
        <p className="mt-2 text-center text-sm"
           style={{ color: 'var(--color-text-secondary)' }}>
          Welcome back, {user?.firstName}! Choose an organization to continue.
        </p>
      </div>
      
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="py-8 px-4 shadow-lg sm:rounded-lg sm:px-10"
             style={{ 
               backgroundColor: 'var(--color-surface)',
               boxShadow: 'var(--elevation-medium)'
             }}>
          <div className="space-y-4">
            {availableTenants.map((tenant) => (
              <button
                key={tenant.id}
                onClick={() => handleTenantSelect(tenant.id)}
                className="w-full flex items-center justify-between p-4 rounded-lg border transition-all duration-200 hover:shadow-md"
                style={{
                  backgroundColor: 'var(--color-surface-variant)',
                  borderColor: 'var(--color-outline)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-outline)';
                }}
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    {tenant.logoUrl ? (
                      <img
                        src={tenant.logoUrl}
                        alt={tenant.name}
                        className="h-10 w-10 rounded-full"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full flex items-center justify-center"
                           style={{ backgroundColor: 'var(--color-primary-container)' }}>
                        <BuildingOfficeIcon className="h-6 w-6"
                                          style={{ color: 'var(--color-primary)' }} />
                      </div>
                    )}
                  </div>
                  <div className="ml-4 text-left">
                    <p className="text-sm font-medium"
                       style={{ color: 'var(--color-text-primary)' }}>
                      {tenant.name}
                    </p>
                    {tenant.domain && (
                      <p className="text-xs"
                         style={{ color: 'var(--color-text-secondary)' }}>
                        {tenant.domain}
                      </p>
                    )}
                  </div>
                </div>
                <ArrowRightIcon className="h-5 w-5"
                               style={{ color: 'var(--color-text-secondary)' }} />
              </button>
            ))}
          </div>
          
          <div className="mt-6 pt-6 border-t"
               style={{ borderColor: 'var(--color-outline-variant)' }}>
            <button
              onClick={() => router.push('/tenants/create')}
              className="w-full flex justify-center py-2 px-4 border rounded-md shadow-sm text-sm font-medium transition-colors duration-200"
              style={{
                borderColor: 'var(--color-outline)',
                color: 'var(--color-primary)',
                backgroundColor: 'transparent'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-primary-container)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              Create New Organization
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}