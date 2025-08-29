'use client';

/**
 * Tenant Selection Page
 * Allows users to select or create a tenant
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthLayout } from '../../../components/auth/AuthLayout';
import { authApi } from '../../../utils/auth';
import { TenantRole, TenantMembership, Tenant } from '../../../types/auth';

export default function SelectTenantPage() {
  const router = useRouter();
  const [memberships, setMemberships] = useState<TenantMembership[]>([]);
  const [isLoadingMemberships, setIsLoadingMemberships] = useState(true);
  
  const [isCreating, setIsCreating] = useState(false);
  const [newTenantName, setNewTenantName] = useState('');
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  // Load user's memberships on mount
  useEffect(() => {
    const loadMemberships = async () => {
      try {
        const response = await authApi.get('/user/memberships');
        if (response.data.success && response.data.data) {
          setMemberships(response.data.data);
        }
      } catch (err: any) {
        setError('Failed to load organizations');
      } finally {
        setIsLoadingMemberships(false);
      }
    };
    
    loadMemberships();
  }, []);

  const handleSelectTenant = async (tenantId: string) => {
    setError(null);
    setSelectedTenantId(tenantId);
    setIsSwitching(true);

    try {
      const response = await authApi.post('/auth/switch-tenant', { tenantId });
      if (response.data.success) {
        router.push('/');
      } else {
        throw new Error(response.data.error || 'Failed to switch tenant');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to switch tenant');
      setSelectedTenantId(null);
    } finally {
      setIsSwitching(false);
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsCreating(true);

    try {
      const response = await authApi.post('/tenants', { name: newTenantName });
      if (response.data.success && response.data.data) {
        const newTenant = response.data.data;
        await handleSelectTenant(newTenant.id);
      } else {
        throw new Error(response.data.error || 'Failed to create tenant');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to create tenant');
    } finally {
      setIsCreating(false);
    }
  };

  const getRoleBadgeColor = (role: TenantRole) => {
    switch (role) {
      case TenantRole.OWNER:
        return 'bg-purple-100 text-purple-800';
      case TenantRole.ADMIN:
        return 'bg-blue-100 text-blue-800';
      case TenantRole.MEMBER:
        return 'bg-green-100 text-green-800';
      case TenantRole.VIEWER:
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoadingMemberships) {
    return (
      <AuthLayout
        title="Loading Organizations"
        subtitle="Please wait..."
      >
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Select Organization"
      subtitle="Choose an organization to continue"
    >
      <div className="space-y-6">
        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Existing Tenants */}
        {memberships.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Your Organizations</h3>
            <div className="space-y-2">
              {memberships.map((membership) => (
                <button
                  key={membership.id}
                  onClick={() => handleSelectTenant(membership.tenant.id)}
                  disabled={isSwitching}
                  className={`w-full text-left p-4 rounded-lg border ${
                    selectedTenantId === membership.tenant.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  } transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{membership.tenant.name}</p>
                      <p className="text-sm text-gray-500">{membership.tenant.slug}</p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(membership.role)}`}>
                      {membership.role}
                    </span>
                  </div>
                  {selectedTenantId === membership.tenant.id && isSwitching && (
                    <div className="mt-2 flex items-center text-sm text-indigo-600">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600 mr-2"></div>
                      Switching...
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Divider */}
        {memberships.length > 0 && (
          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-gray-500">Or</span>
            </div>
          </div>
        )}

        {/* Create New Tenant */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">Create New Organization</h3>
          <form onSubmit={handleCreateTenant}>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTenantName}
                onChange={(e) => setNewTenantName(e.target.value)}
                placeholder="Organization name"
                required
                className="flex-1 appearance-none block px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                disabled={isCreating}
              />
              <button
                type="submit"
                disabled={isCreating || !newTenantName.trim()}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </div>

        {/* Help Text */}
        <div className="rounded-md bg-blue-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Need help?</h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>If you&apos;re expecting to be part of an organization but don&apos;t see it here, contact your organization administrator to request an invitation.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sign Out Option */}
        <div className="text-center">
          <Link
            href="/auth/signin"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Sign out and use a different account
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}