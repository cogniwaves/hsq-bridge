/**
 * QuickBooks Settings Page
 * Configure QuickBooks OAuth integration, manage token health, and sync preferences
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { UserfrontProtectedRoute } from '../../../components/auth/UserfrontProtectedRoute';
import { AuthenticatedLayout } from '../../../components/layout/AuthenticatedLayout';
import { ConfigurationWizard } from '../../../components/configuration/ConfigurationWizard';
import { ConnectionTester } from '../../../components/configuration/ConnectionTester';
import { ToastNotification } from '../../../components/common/ToastNotification';
import { useUserfrontAuth } from '../../../contexts/UserfrontAuthContext';
import { useTheme } from '../../../design-system/themes/themeProvider';
import {
  BaseConfiguration,
  ConnectionTestResult,
  QuickBooksOAuthState,
  WizardStep,
} from '../../../components/configuration/types';
import {
  createAPIClient,
  createErrorToast,
  createSuccessToast,
  formatRelativeTime,
  formatDate,
} from '../../../components/configuration/utils';
import {
  ArrowLeftIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  KeyIcon,
  BuildingOfficeIcon,
  ClockIcon,
  LockClosedIcon,
  ArrowTopRightOnSquareIcon,
  ChartBarIcon,
  CreditCardIcon,
} from '@heroicons/react/24/outline';

// Type definitions
interface QuickBooksConfig extends BaseConfiguration {
  companyId: string;
  companyName: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  lastTokenRefresh?: Date;
  syncEnabled: boolean;
  syncInterval: number;
  features: {
    invoices: boolean;
    customers: boolean;
    payments: boolean;
    items: boolean;
    accounts: boolean;
    taxRates: boolean;
  };
  chartOfAccounts?: {
    salesAccount?: string;
    taxAccount?: string;
    discountAccount?: string;
    shippingAccount?: string;
  };
}

interface QuickBooksSettingsState {
  config: Partial<QuickBooksConfig>;
  oauthState: QuickBooksOAuthState;
  originalConfig: Partial<QuickBooksConfig>;
  isLoading: boolean;
  isSaving: boolean;
  isTesting: boolean;
  isRefreshing: boolean;
  hasChanges: boolean;
  showOAuthWizard: boolean;
  lastTestResult: ConnectionTestResult | null;
  tokenHealth: {
    status: 'healthy' | 'expiring' | 'expired' | 'invalid';
    message: string;
    expiresIn?: string;
  };
  validationErrors: Record<string, string>;
  toast: {
    show: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  } | null;
}

// API client
const api = createAPIClient('/api/config');

export default function QuickBooksSettingsPage() {
  const router = useRouter();
  const { user } = useUserfrontAuth();
  const { theme, resolvedMode } = useTheme();
  const isDark = resolvedMode === 'dark';

  // State management
  const [state, setState] = useState<QuickBooksSettingsState>({
    config: {
      platform: 'QUICKBOOKS',
      companyId: '',
      companyName: '',
      syncEnabled: true,
      syncInterval: 600,
      features: {
        invoices: true,
        customers: true,
        payments: true,
        items: true,
        accounts: true,
        taxRates: true,
      },
      chartOfAccounts: {},
      isActive: false,
      environment: 'production',
      healthStatus: 'UNKNOWN',
    },
    oauthState: {
      step: 'initiate',
    },
    originalConfig: {},
    isLoading: true,
    isSaving: false,
    isTesting: false,
    isRefreshing: false,
    hasChanges: false,
    showOAuthWizard: false,
    lastTestResult: null,
    tokenHealth: {
      status: 'invalid',
      message: 'Not connected',
    },
    validationErrors: {},
    toast: null,
  });

  // Calculate token health
  const calculateTokenHealth = useCallback((config: Partial<QuickBooksConfig>) => {
    if (!config.accessToken) {
      return {
        status: 'invalid' as const,
        message: 'Not connected to QuickBooks',
      };
    }

    if (!config.tokenExpiresAt) {
      return {
        status: 'invalid' as const,
        message: 'Token expiration unknown',
      };
    }

    const expiresAt = new Date(config.tokenExpiresAt);
    const now = new Date();
    const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilExpiry <= 0) {
      return {
        status: 'expired' as const,
        message: 'Token has expired',
        expiresIn: 'Expired',
      };
    } else if (hoursUntilExpiry <= 24) {
      return {
        status: 'expiring' as const,
        message: `Token expires in ${Math.floor(hoursUntilExpiry)} hours`,
        expiresIn: `${Math.floor(hoursUntilExpiry)}h`,
      };
    } else {
      const daysUntilExpiry = Math.floor(hoursUntilExpiry / 24);
      return {
        status: 'healthy' as const,
        message: `Token valid for ${daysUntilExpiry} days`,
        expiresIn: `${daysUntilExpiry}d`,
      };
    }
  }, []);

  // Fetch current configuration
  const fetchConfiguration = useCallback(async () => {
    try {
      const config = await api.get<QuickBooksConfig>('/quickbooks');
      const tokenHealth = calculateTokenHealth(config);
      
      setState(prev => ({
        ...prev,
        config: config,
        originalConfig: config,
        tokenHealth,
        isLoading: false,
        hasChanges: false,
      }));
    } catch (error) {
      console.error('Failed to fetch QuickBooks configuration:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
      }));
    }
  }, [calculateTokenHealth]);

  // Handle OAuth initiation
  const handleStartOAuth = useCallback(async () => {
    try {
      const { authUrl, state: oauthStateParam } = await api.post<{ authUrl: string; state: string }>(
        '/quickbooks/oauth/initiate',
        {}
      );

      setState(prev => ({
        ...prev,
        oauthState: {
          step: 'authorize',
          authUrl,
          state: oauthStateParam,
        },
        showOAuthWizard: true,
      }));

      // Open authorization URL in new window
      const authWindow = window.open(authUrl, 'QuickBooks Authorization', 'width=600,height=700');
      
      // Poll for completion
      const pollInterval = setInterval(async () => {
        if (authWindow?.closed) {
          clearInterval(pollInterval);
          
          // Check if authorization was successful
          try {
            const status = await api.get<{ connected: boolean; companyInfo?: any }>('/quickbooks/oauth/status');
            
            if (status.connected) {
              setState(prev => ({
                ...prev,
                oauthState: {
                  step: 'complete',
                  companyInfo: status.companyInfo,
                },
                toast: createSuccessToast('Successfully connected to QuickBooks'),
              }));
              
              // Refresh configuration
              await fetchConfiguration();
            } else {
              setState(prev => ({
                ...prev,
                showOAuthWizard: false,
                toast: createErrorToast('Authorization was cancelled or failed'),
              }));
            }
          } catch (error) {
            setState(prev => ({
              ...prev,
              showOAuthWizard: false,
              toast: createErrorToast(error, 'Failed to verify authorization'),
            }));
          }
        }
      }, 1000);
    } catch (error) {
      setState(prev => ({
        ...prev,
        toast: createErrorToast(error, 'Failed to initiate OAuth flow'),
      }));
    }
  }, [fetchConfiguration]);

  // Handle token refresh
  const handleRefreshToken = useCallback(async () => {
    setState(prev => ({ ...prev, isRefreshing: true }));

    try {
      const result = await api.post('/quickbooks/oauth/refresh', {});
      
      setState(prev => ({
        ...prev,
        isRefreshing: false,
        toast: createSuccessToast('Token refreshed successfully'),
      }));

      // Refresh configuration to get new token info
      await fetchConfiguration();
    } catch (error) {
      setState(prev => ({
        ...prev,
        isRefreshing: false,
        toast: createErrorToast(error, 'Failed to refresh token'),
      }));
    }
  }, [fetchConfiguration]);

  // Handle disconnect
  const handleDisconnect = useCallback(async () => {
    if (!confirm('Are you sure you want to disconnect from QuickBooks? This will remove all authentication tokens.')) {
      return;
    }

    try {
      await api.delete('/quickbooks/oauth');
      
      setState(prev => ({
        ...prev,
        config: {
          ...prev.config,
          accessToken: undefined,
          refreshToken: undefined,
          tokenExpiresAt: undefined,
          companyId: '',
          companyName: '',
        },
        tokenHealth: {
          status: 'invalid',
          message: 'Not connected',
        },
        toast: createSuccessToast('Disconnected from QuickBooks'),
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        toast: createErrorToast(error, 'Failed to disconnect'),
      }));
    }
  }, []);

  // Handle form field changes
  const handleFieldChange = useCallback((field: string, value: any) => {
    setState(prev => {
      const newConfig = { ...prev.config };
      
      // Handle nested fields
      if (field.startsWith('features.')) {
        const featureName = field.replace('features.', '');
        newConfig.features = {
          ...newConfig.features,
          [featureName]: value,
        };
      } else if (field.startsWith('chartOfAccounts.')) {
        const accountField = field.replace('chartOfAccounts.', '');
        newConfig.chartOfAccounts = {
          ...newConfig.chartOfAccounts,
          [accountField]: value,
        };
      } else {
        newConfig[field] = value;
      }

      // Check if there are changes
      const hasChanges = JSON.stringify(newConfig) !== JSON.stringify(prev.originalConfig);

      return {
        ...prev,
        config: newConfig,
        hasChanges,
      };
    });
  }, []);

  // Handle save configuration
  const handleSave = useCallback(async () => {
    setState(prev => ({ ...prev, isSaving: true }));

    try {
      const savedConfig = await api.post<QuickBooksConfig>('/quickbooks', state.config);
      
      setState(prev => ({
        ...prev,
        config: savedConfig,
        originalConfig: savedConfig,
        isSaving: false,
        hasChanges: false,
        toast: createSuccessToast('QuickBooks configuration saved successfully'),
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isSaving: false,
        toast: createErrorToast(error, 'Failed to save QuickBooks configuration'),
      }));
    }
  }, [state.config]);

  // Handle test connection
  const handleTestConnection = useCallback(async (config: Record<string, any>) => {
    setState(prev => ({ ...prev, isTesting: true }));

    try {
      const result = await api.post<ConnectionTestResult>('/test-quickbooks', {});

      setState(prev => ({
        ...prev,
        isTesting: false,
        lastTestResult: result,
        toast: result.success
          ? createSuccessToast('QuickBooks connection test successful')
          : createErrorToast(result.message),
      }));

      return result;
    } catch (error) {
      const result: ConnectionTestResult = {
        success: false,
        message: 'Connection test failed',
      };

      setState(prev => ({
        ...prev,
        isTesting: false,
        lastTestResult: result,
        toast: createErrorToast(error, 'Failed to test QuickBooks connection'),
      }));

      return result;
    }
  }, []);

  // Handle reset
  const handleReset = useCallback(() => {
    setState(prev => ({
      ...prev,
      config: prev.originalConfig,
      hasChanges: false,
      validationErrors: {},
    }));
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchConfiguration();
  }, [fetchConfiguration]);

  // Clear toast after duration
  useEffect(() => {
    if (state.toast) {
      const timer = setTimeout(() => {
        setState(prev => ({ ...prev, toast: null }));
      }, state.toast.type === 'error' ? 5000 : 3000);
      return () => clearTimeout(timer);
    }
  }, [state.toast]);

  // Check for admin permissions
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  const isConnected = !!state.config.accessToken;

  // OAuth Wizard Steps
  const oauthWizardSteps: WizardStep[] = [
    {
      id: 'prepare',
      title: 'Prepare Connection',
      description: 'Get ready to connect to QuickBooks',
      component: () => (
        <div className="space-y-4">
          <p style={{ color: 'var(--color-text-primary)' }}>
            You will be redirected to QuickBooks to authorize this application.
          </p>
          <ul className="list-disc list-inside space-y-2" style={{ color: 'var(--color-text-secondary)' }}>
            <li>Make sure you have QuickBooks admin access</li>
            <li>Select the correct company during authorization</li>
            <li>Review the permissions being requested</li>
          </ul>
        </div>
      ),
    },
    {
      id: 'authorize',
      title: 'Authorize Access',
      description: 'Connect to your QuickBooks account',
      component: () => (
        <div className="space-y-4">
          <p style={{ color: 'var(--color-text-primary)' }}>
            Click the button below to open QuickBooks authorization.
          </p>
          <button
            onClick={() => window.open(state.oauthState.authUrl, '_blank')}
            className="w-full px-4 py-3 rounded-lg flex items-center justify-center gap-2"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-on-primary)',
            }}
          >
            <ArrowTopRightOnSquareIcon className="w-5 h-5" />
            Open QuickBooks Authorization
          </button>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Complete the authorization in the new window, then return here.
          </p>
        </div>
      ),
    },
    {
      id: 'complete',
      title: 'Connection Complete',
      description: 'Successfully connected to QuickBooks',
      component: () => (
        <div className="space-y-4">
          <div className="flex items-center justify-center">
            <CheckCircleIcon className="w-16 h-16" style={{ color: '#10b981' }} />
          </div>
          <p className="text-center" style={{ color: 'var(--color-text-primary)' }}>
            Successfully connected to QuickBooks!
          </p>
          {state.oauthState.companyInfo && (
            <div
              className="p-4 rounded-lg border"
              style={{
                backgroundColor: 'var(--color-surface-variant)',
                borderColor: 'var(--color-outline-variant)',
              }}
            >
              <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                Company: {state.oauthState.companyInfo.name}
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                ID: {state.oauthState.companyInfo.id}
              </p>
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <UserfrontProtectedRoute>
      <AuthenticatedLayout pathname="/settings/quickbooks">
        <div className="space-y-6">
          {/* Page Header with Breadcrumb */}
          <div>
            <button
              onClick={() => router.push('/settings')}
              className="flex items-center gap-2 text-sm hover:underline mb-4"
              style={{ color: 'var(--color-primary)' }}
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Back to Settings
            </button>
            
            <div className="flex justify-between items-start">
              <div>
                <h1
                  className="text-3xl font-bold flex items-center gap-3"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  <span style={{ fontSize: '32px' }}>📊</span>
                  QuickBooks Settings
                </h1>
                <p
                  className="mt-2 text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Manage your QuickBooks OAuth connection and synchronization settings
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                {state.tokenHealth.status === 'healthy' && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" 
                    style={{ 
                      backgroundColor: '#ecfdf5',
                      color: '#10b981',
                    }}
                  >
                    <CheckCircleIcon className="w-4 h-4" />
                    <span className="text-sm font-medium">Connected</span>
                  </div>
                )}
                
                {state.tokenHealth.status === 'expiring' && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" 
                    style={{ 
                      backgroundColor: '#fefce8',
                      color: '#eab308',
                    }}
                  >
                    <ClockIcon className="w-4 h-4" />
                    <span className="text-sm font-medium">Token Expiring</span>
                  </div>
                )}
                
                {state.tokenHealth.status === 'expired' && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" 
                    style={{ 
                      backgroundColor: '#fef2f2',
                      color: '#ef4444',
                    }}
                  >
                    <ExclamationTriangleIcon className="w-4 h-4" />
                    <span className="text-sm font-medium">Token Expired</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Configuration Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Configuration Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* OAuth Connection Status */}
              <div
                className="p-6 rounded-lg border"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-outline-variant)',
                }}
              >
                <h2
                  className="text-lg font-semibold mb-4"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  OAuth Connection
                </h2>
                
                {isConnected ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          Company
                        </p>
                        <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                          {state.config.companyName || 'Unknown'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          Company ID
                        </p>
                        <p className="font-mono text-sm" style={{ color: 'var(--color-text-primary)' }}>
                          {state.config.companyId || 'Unknown'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          Token Status
                        </p>
                        <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                          {state.tokenHealth.message}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          Last Refresh
                        </p>
                        <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                          {state.config.lastTokenRefresh 
                            ? formatRelativeTime(state.config.lastTokenRefresh)
                            : 'Never'}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      {(state.tokenHealth.status === 'expiring' || state.tokenHealth.status === 'expired') && (
                        <button
                          onClick={handleRefreshToken}
                          disabled={state.isRefreshing || !isAdmin}
                          className="px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
                          style={{
                            backgroundColor: 'var(--color-warning-container)',
                            color: 'var(--color-on-warning-container)',
                            opacity: state.isRefreshing || !isAdmin ? 0.5 : 1,
                          }}
                        >
                          {state.isRefreshing && (
                            <ArrowPathIcon className="w-4 h-4 animate-spin" />
                          )}
                          Refresh Token
                        </button>
                      )}
                      
                      <button
                        onClick={handleDisconnect}
                        disabled={!isAdmin}
                        className="px-4 py-2 rounded-lg transition-all"
                        style={{
                          backgroundColor: 'transparent',
                          border: `1px solid var(--color-error)`,
                          color: 'var(--color-error)',
                          opacity: !isAdmin ? 0.5 : 1,
                        }}
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <LockClosedIcon 
                      className="w-12 h-12 mx-auto mb-4" 
                      style={{ color: 'var(--color-text-secondary)' }}
                    />
                    <p
                      className="mb-4"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Not connected to QuickBooks
                    </p>
                    <button
                      onClick={handleStartOAuth}
                      disabled={!isAdmin}
                      className="px-6 py-3 rounded-lg flex items-center gap-2 mx-auto transition-all"
                      style={{
                        backgroundColor: 'var(--color-primary)',
                        color: 'var(--color-on-primary)',
                        opacity: !isAdmin ? 0.5 : 1,
                      }}
                    >
                      <KeyIcon className="w-5 h-5" />
                      Connect to QuickBooks
                    </button>
                  </div>
                )}
              </div>

              {/* Sync Settings */}
              <div
                className="p-6 rounded-lg border"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-outline-variant)',
                  opacity: !isConnected ? 0.6 : 1,
                  pointerEvents: !isConnected ? 'none' : 'auto',
                }}
              >
                <h2
                  className="text-lg font-semibold mb-4"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Synchronization Settings
                </h2>
                
                <div className="space-y-4">
                  <label className="flex items-center justify-between">
                    <div>
                      <span
                        className="text-sm font-medium"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        Enable Automatic Sync
                      </span>
                      <p
                        className="text-xs mt-1"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        Automatically sync data with QuickBooks
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={state.config.syncEnabled || false}
                      onChange={(e) => handleFieldChange('syncEnabled', e.target.checked)}
                      disabled={!isAdmin || state.isSaving || !isConnected}
                      className="w-4 h-4 rounded"
                      style={{
                        accentColor: 'var(--color-primary)',
                      }}
                    />
                  </label>

                  <div>
                    <label
                      className="block text-sm font-medium mb-2"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Sync Interval (seconds)
                    </label>
                    <input
                      type="number"
                      value={state.config.syncInterval || 600}
                      onChange={(e) => handleFieldChange('syncInterval', parseInt(e.target.value))}
                      disabled={!isAdmin || state.isSaving || !state.config.syncEnabled || !isConnected}
                      min="300"
                      max="3600"
                      className="w-full px-3 py-2 rounded-lg border transition-colors"
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        borderColor: 'var(--color-outline-variant)',
                        color: 'var(--color-text-primary)',
                        opacity: state.config.syncEnabled ? 1 : 0.5,
                      }}
                    />
                    <p
                      className="mt-1 text-xs"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      How often to sync data (300-3600 seconds)
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature Configuration */}
              <div
                className="p-6 rounded-lg border"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-outline-variant)',
                  opacity: !isConnected ? 0.6 : 1,
                  pointerEvents: !isConnected ? 'none' : 'auto',
                }}
              >
                <h2
                  className="text-lg font-semibold mb-4"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Feature Configuration
                </h2>
                
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries({
                    invoices: { label: 'Invoice Sync', icon: <DocumentTextIcon className="w-4 h-4" /> },
                    customers: { label: 'Customer Sync', icon: <BuildingOfficeIcon className="w-4 h-4" /> },
                    payments: { label: 'Payment Sync', icon: <CreditCardIcon className="w-4 h-4" /> },
                    items: { label: 'Item/Product Sync', icon: <ChartBarIcon className="w-4 h-4" /> },
                    accounts: { label: 'Chart of Accounts', icon: <ChartBarIcon className="w-4 h-4" /> },
                    taxRates: { label: 'Tax Rate Sync', icon: <DocumentTextIcon className="w-4 h-4" /> },
                  }).map(([key, { label, icon }]) => (
                    <label
                      key={key}
                      className="flex items-center justify-between py-2 px-3 rounded-lg border cursor-pointer hover:bg-opacity-50 transition-colors"
                      style={{
                        borderColor: 'var(--color-outline-variant)',
                        backgroundColor: state.config.features?.[key] 
                          ? 'var(--color-primary-container)' 
                          : 'transparent',
                      }}
                    >
                      <span
                        className="text-sm flex items-center gap-2"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {icon}
                        {label}
                      </span>
                      <input
                        type="checkbox"
                        checked={state.config.features?.[key] || false}
                        onChange={(e) => handleFieldChange(`features.${key}`, e.target.checked)}
                        disabled={!isAdmin || state.isSaving || !isConnected}
                        className="w-4 h-4 rounded"
                        style={{
                          accentColor: 'var(--color-primary)',
                        }}
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              {isAdmin && isConnected && (
                <div className="flex justify-end gap-3">
                  <button
                    onClick={handleReset}
                    disabled={!state.hasChanges || state.isSaving}
                    className="px-4 py-2 rounded-lg transition-all"
                    style={{
                      backgroundColor: 'transparent',
                      border: `1px solid var(--color-outline-variant)`,
                      color: 'var(--color-text-secondary)',
                      opacity: !state.hasChanges || state.isSaving ? 0.5 : 1,
                    }}
                  >
                    Reset Changes
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!state.hasChanges || state.isSaving}
                    className="px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
                    style={{
                      backgroundColor: 'var(--color-primary)',
                      color: 'var(--color-on-primary)',
                      opacity: !state.hasChanges || state.isSaving ? 0.5 : 1,
                    }}
                  >
                    {state.isSaving && (
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    )}
                    Save Configuration
                  </button>
                </div>
              )}
            </div>

            {/* Right Column - Connection Status & Info */}
            <div className="space-y-6">
              {/* Connection Tester */}
              {isConnected && (
                <ConnectionTester
                  platform="QUICKBOOKS"
                  configuration={state.config}
                  onTest={handleTestConnection}
                  autoTest={false}
                  showHistory
                />
              )}

              {/* Help & Documentation */}
              <div
                className="p-6 rounded-lg border"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-outline-variant)',
                }}
              >
                <h3
                  className="text-lg font-semibold mb-4 flex items-center gap-2"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  <InformationCircleIcon className="w-5 h-5" />
                  Help & Resources
                </h3>
                
                <div className="space-y-3">
                  <a
                    href="https://developer.intuit.com/app/developer/qbo/docs/get-started"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm hover:underline"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    <DocumentTextIcon className="w-4 h-4" />
                    QuickBooks API Documentation
                  </a>
                  
                  <a
                    href="https://app.quickbooks.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm hover:underline"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    <BuildingOfficeIcon className="w-4 h-4" />
                    QuickBooks Online
                  </a>
                  
                  <a
                    href="https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm hover:underline"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    <KeyIcon className="w-4 h-4" />
                    OAuth 2.0 Guide
                  </a>
                </div>

                <div
                  className="mt-4 pt-4 border-t"
                  style={{ borderColor: 'var(--color-outline-variant)' }}
                >
                  <p
                    className="text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    <strong>Required Scopes:</strong><br />
                    • com.intuit.quickbooks.accounting
                  </p>
                </div>
              </div>

              {/* Token Expiration Warning */}
              {isConnected && state.tokenHealth.status !== 'healthy' && (
                <div
                  className="p-4 rounded-lg border"
                  style={{
                    backgroundColor: state.tokenHealth.status === 'expired'
                      ? 'var(--color-error-container)'
                      : 'var(--color-warning-container)',
                    borderColor: state.tokenHealth.status === 'expired'
                      ? 'var(--color-error)'
                      : 'var(--color-warning)',
                  }}
                >
                  <h4
                    className="font-medium mb-2 flex items-center gap-2"
                    style={{ 
                      color: state.tokenHealth.status === 'expired'
                        ? 'var(--color-on-error-container)'
                        : 'var(--color-on-warning-container)',
                    }}
                  >
                    <ClockIcon className="w-5 h-5" />
                    Token {state.tokenHealth.status === 'expired' ? 'Expired' : 'Expiring Soon'}
                  </h4>
                  <p
                    className="text-sm mb-3"
                    style={{ 
                      color: state.tokenHealth.status === 'expired'
                        ? 'var(--color-on-error-container)'
                        : 'var(--color-on-warning-container)',
                      opacity: 0.9,
                    }}
                  >
                    {state.tokenHealth.message}
                  </p>
                  {isAdmin && (
                    <button
                      onClick={handleRefreshToken}
                      disabled={state.isRefreshing}
                      className="w-full px-3 py-2 rounded-lg flex items-center justify-center gap-2 transition-all"
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-text-primary)',
                        opacity: state.isRefreshing ? 0.5 : 1,
                      }}
                    >
                      {state.isRefreshing && (
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      )}
                      Refresh Token Now
                    </button>
                  )}
                </div>
              )}

              {/* Last Update Info */}
              {state.config.updatedAt && (
                <div
                  className="p-4 rounded-lg border text-sm"
                  style={{
                    backgroundColor: 'var(--color-surface-variant)',
                    borderColor: 'var(--color-outline-variant)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  Last updated {formatRelativeTime(state.config.updatedAt)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* OAuth Wizard Modal */}
        {state.showOAuthWizard && (
          <ConfigurationWizard
            platform="QUICKBOOKS"
            steps={oauthWizardSteps}
            onComplete={async () => {
              setState(prev => ({ ...prev, showOAuthWizard: false }));
              await fetchConfiguration();
            }}
            onCancel={() => setState(prev => ({ ...prev, showOAuthWizard: false }))}
            initialData={state.oauthState}
            showProgress
          />
        )}

        {/* Toast Notification */}
        {state.toast && (
          <ToastNotification
            type={state.toast.type}
            title={state.toast.title}
            message={state.toast.message}
            onClose={() => setState(prev => ({ ...prev, toast: null }))}
          />
        )}
      </AuthenticatedLayout>
    </UserfrontProtectedRoute>
  );
}