/**
 * HubSpot Settings Page
 * Configure HubSpot API integration, manage sync settings, and monitor connection health
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { UserfrontProtectedRoute } from '../../../components/auth/UserfrontProtectedRoute';
import { AuthenticatedLayout } from '../../../components/layout/AuthenticatedLayout';
import { ConfigurationForm } from '../../../components/configuration/ConfigurationForm';
import { ConnectionTester } from '../../../components/configuration/ConnectionTester';
import { APIKeyInput } from '../../../components/configuration/APIKeyInput';
import { ToastNotification } from '../../../components/common/ToastNotification';
import { useUserfrontAuth } from '../../../contexts/UserfrontAuthContext';
import { useTheme } from '../../../design-system/themes/themeProvider';
import {
  HubSpotConfig,
  ConnectionTestResult,
  ValidationResult,
} from '../../../components/configuration/types';
import {
  createAPIClient,
  validateAPIKey,
  maskAPIKey,
  createErrorToast,
  createSuccessToast,
  formatRelativeTime,
} from '../../../components/configuration/utils';
import {
  ArrowLeftIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

// Type definitions
interface HubSpotSettingsState {
  config: Partial<HubSpotConfig>;
  originalConfig: Partial<HubSpotConfig>;
  isLoading: boolean;
  isSaving: boolean;
  isTesting: boolean;
  hasChanges: boolean;
  lastTestResult: ConnectionTestResult | null;
  validationErrors: Record<string, string>;
  toast: {
    show: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  } | null;
}

interface HubSpotFeatures {
  invoices: boolean;
  contacts: boolean;
  companies: boolean;
  lineItems: boolean;
  products: boolean;
  webhooks: boolean;
}

// API client
const api = createAPIClient('/api/config');

export default function HubSpotSettingsPage() {
  const router = useRouter();
  const { user } = useUserfrontAuth();
  const { theme, resolvedMode } = useTheme();
  const isDark = resolvedMode === 'dark';

  // State management
  const [state, setState] = useState<HubSpotSettingsState>({
    config: {
      platform: 'HUBSPOT',
      apiKey: '',
      portalId: '',
      accountId: '',
      rateLimitPerMinute: 600,
      syncEnabled: true,
      syncInterval: 300,
      features: {
        invoices: true,
        contacts: true,
        companies: true,
        lineItems: true,
        products: true,
        webhooks: false,
      },
      isActive: false,
      environment: 'production',
      healthStatus: 'UNKNOWN',
    },
    originalConfig: {},
    isLoading: true,
    isSaving: false,
    isTesting: false,
    hasChanges: false,
    lastTestResult: null,
    validationErrors: {},
    toast: null,
  });

  // Fetch current configuration
  const fetchConfiguration = useCallback(async () => {
    try {
      const config = await api.get<HubSpotConfig>('/hubspot');
      setState(prev => ({
        ...prev,
        config: config,
        originalConfig: config,
        isLoading: false,
        hasChanges: false,
      }));
    } catch (error) {
      console.error('Failed to fetch HubSpot configuration:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
      }));
    }
  }, []);

  // Handle form field changes
  const handleFieldChange = useCallback((field: string, value: any) => {
    setState(prev => {
      const newConfig = { ...prev.config };
      
      // Handle nested feature fields
      if (field.startsWith('features.')) {
        const featureName = field.replace('features.', '');
        newConfig.features = {
          ...newConfig.features,
          [featureName]: value,
        };
      } else {
        newConfig[field] = value;
      }

      // Check if there are changes
      const hasChanges = JSON.stringify(newConfig) !== JSON.stringify(prev.originalConfig);

      // Validate field
      let validationErrors = { ...prev.validationErrors };
      if (field === 'apiKey') {
        const validation = validateAPIKey('HUBSPOT', value);
        if (!validation.isValid && value) {
          validationErrors.apiKey = validation.errors[0];
        } else {
          delete validationErrors.apiKey;
        }
      }

      return {
        ...prev,
        config: newConfig,
        hasChanges,
        validationErrors,
      };
    });
  }, []);

  // Handle save configuration
  const handleSave = useCallback(async () => {
    // Validate required fields
    const errors: Record<string, string> = {};
    
    if (!state.config.apiKey) {
      errors.apiKey = 'API Key is required';
    } else {
      const validation = validateAPIKey('HUBSPOT', state.config.apiKey);
      if (!validation.isValid) {
        errors.apiKey = validation.errors[0];
      }
    }

    if (Object.keys(errors).length > 0) {
      setState(prev => ({
        ...prev,
        validationErrors: errors,
        toast: createErrorToast('Please fix validation errors before saving'),
      }));
      return;
    }

    setState(prev => ({ ...prev, isSaving: true }));

    try {
      const savedConfig = await api.post<HubSpotConfig>('/hubspot', state.config);
      
      setState(prev => ({
        ...prev,
        config: savedConfig,
        originalConfig: savedConfig,
        isSaving: false,
        hasChanges: false,
        toast: createSuccessToast('HubSpot configuration saved successfully'),
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isSaving: false,
        toast: createErrorToast(error, 'Failed to save HubSpot configuration'),
      }));
    }
  }, [state.config]);

  // Handle test connection
  const handleTestConnection = useCallback(async (config: Record<string, any>) => {
    setState(prev => ({ ...prev, isTesting: true }));

    try {
      const result = await api.post<ConnectionTestResult>('/test-hubspot', {
        apiKey: config.apiKey || state.config.apiKey,
      });

      setState(prev => ({
        ...prev,
        isTesting: false,
        lastTestResult: result,
        toast: result.success
          ? createSuccessToast('HubSpot connection test successful')
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
        toast: createErrorToast(error, 'Failed to test HubSpot connection'),
      }));

      return result;
    }
  }, [state.config.apiKey]);

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

  return (
    <UserfrontProtectedRoute>
      <AuthenticatedLayout pathname="/settings/hubspot">
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
                  <span style={{ fontSize: '32px' }}>🔶</span>
                  HubSpot Settings
                </h1>
                <p
                  className="mt-2 text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Configure your HubSpot integration and manage synchronization settings
                </p>
              </div>
              
              {state.config.healthStatus === 'HEALTHY' && (
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
            </div>
          </div>

          {/* Warning for non-admin users */}
          {!isAdmin && (
            <div
              className="p-4 rounded-lg border flex items-start gap-3"
              style={{
                backgroundColor: 'var(--color-warning-container)',
                borderColor: 'var(--color-warning)',
                color: 'var(--color-on-warning-container)',
              }}
            >
              <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">View Only Access</p>
                <p className="text-sm mt-1 opacity-90">
                  You need admin permissions to modify these settings.
                </p>
              </div>
            </div>
          )}

          {/* Main Configuration Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Configuration Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* API Configuration */}
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
                  API Configuration
                </h2>
                
                <div className="space-y-4">
                  <APIKeyInput
                    platform="HUBSPOT"
                    value={state.config.apiKey || ''}
                    onChange={(value) => handleFieldChange('apiKey', value)}
                    label="Private App Token"
                    placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    description="Your HubSpot Private App access token"
                    required
                    disabled={!isAdmin || state.isSaving}
                    showStrength
                    maskInput
                    validateOnChange
                    error={state.validationErrors.apiKey}
                  />

                  <div>
                    <label
                      className="block text-sm font-medium mb-2"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Portal ID
                    </label>
                    <input
                      type="text"
                      value={state.config.portalId || ''}
                      onChange={(e) => handleFieldChange('portalId', e.target.value)}
                      disabled={!isAdmin || state.isSaving}
                      placeholder="12345678"
                      className="w-full px-3 py-2 rounded-lg border transition-colors"
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        borderColor: 'var(--color-outline-variant)',
                        color: 'var(--color-text-primary)',
                      }}
                    />
                    <p
                      className="mt-1 text-xs"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Optional: Your HubSpot portal/hub ID
                    </p>
                  </div>

                  <div>
                    <label
                      className="block text-sm font-medium mb-2"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Account ID
                    </label>
                    <input
                      type="text"
                      value={state.config.accountId || ''}
                      onChange={(e) => handleFieldChange('accountId', e.target.value)}
                      disabled={!isAdmin || state.isSaving}
                      placeholder="abc-123-def"
                      className="w-full px-3 py-2 rounded-lg border transition-colors"
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        borderColor: 'var(--color-outline-variant)',
                        color: 'var(--color-text-primary)',
                      }}
                    />
                    <p
                      className="mt-1 text-xs"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Optional: Your HubSpot account identifier
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature Toggles */}
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
                  Feature Configuration
                </h2>
                
                <div className="space-y-3">
                  {Object.entries({
                    invoices: 'Invoice Synchronization',
                    contacts: 'Contact Management',
                    companies: 'Company Management',
                    lineItems: 'Line Items & Products',
                    products: 'Product Catalog',
                    webhooks: 'Real-time Webhooks',
                  }).map(([key, label]) => (
                    <label
                      key={key}
                      className="flex items-center justify-between py-2 cursor-pointer"
                    >
                      <span
                        className="text-sm"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {label}
                      </span>
                      <input
                        type="checkbox"
                        checked={state.config.features?.[key] || false}
                        onChange={(e) => handleFieldChange(`features.${key}`, e.target.checked)}
                        disabled={!isAdmin || state.isSaving}
                        className="w-4 h-4 rounded"
                        style={{
                          accentColor: 'var(--color-primary)',
                        }}
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* Sync Settings */}
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
                        Automatically sync data between platforms
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={state.config.syncEnabled || false}
                      onChange={(e) => handleFieldChange('syncEnabled', e.target.checked)}
                      disabled={!isAdmin || state.isSaving}
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
                      value={state.config.syncInterval || 300}
                      onChange={(e) => handleFieldChange('syncInterval', parseInt(e.target.value))}
                      disabled={!isAdmin || state.isSaving || !state.config.syncEnabled}
                      min="60"
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
                      How often to sync data (60-3600 seconds)
                    </p>
                  </div>

                  <div>
                    <label
                      className="block text-sm font-medium mb-2"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Rate Limit (requests/minute)
                    </label>
                    <input
                      type="number"
                      value={state.config.rateLimitPerMinute || 600}
                      onChange={(e) => handleFieldChange('rateLimitPerMinute', parseInt(e.target.value))}
                      disabled={!isAdmin || state.isSaving}
                      min="10"
                      max="1000"
                      className="w-full px-3 py-2 rounded-lg border transition-colors"
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        borderColor: 'var(--color-outline-variant)',
                        color: 'var(--color-text-primary)',
                      }}
                    />
                    <p
                      className="mt-1 text-xs"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Maximum API requests per minute (10-1000)
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {isAdmin && (
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
                    disabled={!state.hasChanges || state.isSaving || Object.keys(state.validationErrors).length > 0}
                    className="px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
                    style={{
                      backgroundColor: 'var(--color-primary)',
                      color: 'var(--color-on-primary)',
                      opacity: !state.hasChanges || state.isSaving || Object.keys(state.validationErrors).length > 0 ? 0.5 : 1,
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
              <ConnectionTester
                platform="HUBSPOT"
                configuration={state.config}
                onTest={handleTestConnection}
                autoTest={false}
                showHistory
              />

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
                    href="https://developers.hubspot.com/docs/api/private-apps"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm hover:underline"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    <DocumentTextIcon className="w-4 h-4" />
                    Private Apps Documentation
                  </a>
                  
                  <a
                    href="https://app.hubspot.com/private-apps"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm hover:underline"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    <Cog6ToothIcon className="w-4 h-4" />
                    Manage Private Apps
                  </a>
                  
                  <a
                    href="https://developers.hubspot.com/docs/api/rate-limits"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm hover:underline"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    <ShieldCheckIcon className="w-4 h-4" />
                    API Rate Limits Guide
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
                    • commerce.read<br />
                    • crm.objects.contacts.read<br />
                    • crm.objects.companies.read<br />
                    • crm.objects.line_items.read
                  </p>
                </div>
              </div>

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