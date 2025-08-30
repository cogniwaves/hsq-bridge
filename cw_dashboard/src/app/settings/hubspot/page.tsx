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

// API client - use full API URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:13000';
const api = createAPIClient(`${API_BASE_URL}/api/config`);

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
      const response = await api.get('/hubspot');
      const config = response.data || response;
      
      // Transform the API response to match our local state structure
      const transformedConfig = {
        platform: 'HUBSPOT' as const,
        apiKey: '', // Don't expose the actual API key in the form
        portalId: config.portalId || '',
        accountId: config.accountId || '',
        rateLimitPerMinute: config.rateLimitPerMinute || 600,
        syncEnabled: config.syncEnabled ?? true,
        syncInterval: config.syncInterval || 300,
        features: {
          invoices: config.features?.invoices ?? true,
          contacts: config.features?.contacts ?? true,
          companies: config.features?.companies ?? true,
          lineItems: config.features?.lineItems ?? true,
          products: config.features?.products ?? true,
          webhooks: config.features?.webhooks ?? false,
        },
        isActive: config.isActive ?? false,
        environment: config.environment || 'production',
        healthStatus: config.healthStatus || 'UNKNOWN',
        // Enhanced metadata from the new API
        portalInfo: config.portalInfo || {},
        scopeValidation: config.scopeValidation || {},
        hasApiKey: config.hasApiKey ?? false,
        apiKeyMasked: config.apiKeyMasked || '',
        lastConnectionTest: config.lastConnectionTest,
        updatedAt: config.updatedAt,
      };
      
      setState(prev => ({
        ...prev,
        config: transformedConfig,
        originalConfig: transformedConfig,
        isLoading: false,
        hasChanges: false,
      }));
    } catch (error) {
      console.error('Failed to fetch HubSpot configuration:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        config: {
          ...prev.config,
          isActive: false,
          healthStatus: 'UNKNOWN',
        },
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
      // Send only the necessary fields to the API
      const configData = {
        apiKey: state.config.apiKey,
        portalId: state.config.portalId,
        accountId: state.config.accountId,
        environment: state.config.environment,
        syncEnabled: state.config.syncEnabled,
        syncInterval: state.config.syncInterval * 1000, // Convert to milliseconds
        features: state.config.features,
        rateLimitPerMinute: state.config.rateLimitPerMinute,
      };
      
      const response = await api.post('/hubspot', configData);
      const savedData = response.data || response;
      
      setState(prev => ({
        ...prev,
        config: {
          ...prev.config,
          isActive: true,
          healthStatus: 'HEALTHY',
          hasApiKey: true,
          apiKeyMasked: savedData.apiKeyMasked || `${state.config.apiKey.substring(0, 10)}...`,
          portalId: savedData.detectedPortalId || savedData.portalId || state.config.portalId,
          portalInfo: {
            detectedPortalId: savedData.detectedPortalId,
            autoDetected: savedData.autoDetected,
            scopes: savedData.scopes || [],
            missingScopes: savedData.missingScopes || [],
            apiUsage: savedData.apiUsage,
          },
          scopeValidation: savedData.features?._scopeValidation || {},
        },
        originalConfig: {
          ...prev.config,
          isActive: true,
          healthStatus: 'HEALTHY',
        },
        isSaving: false,
        hasChanges: false,
        toast: createSuccessToast(
          savedData.scopeWarnings 
            ? `Configuration saved with warnings: ${savedData.scopeWarnings}`
            : 'HubSpot configuration saved successfully'
        ),
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
    console.log('🔍 [DEBUG] handleTestConnection called with config:', {
      hasApiKey: !!(config.apiKey || state.config.apiKey),
      apiKeyLength: (config.apiKey || state.config.apiKey)?.length,
      timestamp: new Date().toISOString()
    });

    setState(prev => ({ ...prev, isTesting: true }));

    try {
      const requestPayload = {
        apiKey: config.apiKey || state.config.apiKey,
      };
      
      console.log('🚀 [DEBUG] Making API request to /test-hubspot:', {
        hasApiKey: !!requestPayload.apiKey,
        apiKeyLength: requestPayload.apiKey?.length,
        timestamp: new Date().toISOString()
      });

      const response = await api.post('/test-hubspot', requestPayload);
      
      console.log('📡 [DEBUG] Raw API response:', {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        timestamp: new Date().toISOString()
      });
      
      const result = response.data || response;

      // Enhanced result with portal information
      const testResult: ConnectionTestResult = {
        success: result.success,
        message: result.message || (result.success ? 'Connection successful' : 'Connection failed'),
        details: result.details,
      };

      setState(prev => ({
        ...prev,
        isTesting: false,
        lastTestResult: testResult,
        // Update portal info if detected
        config: result.success && result.details ? {
          ...prev.config,
          portalId: result.details.portalId || prev.config.portalId,
          portalInfo: {
            detectedPortalId: result.details.portalId,
            scopes: result.details.scopes || [],
            scopeValidation: result.details.scopeValidation || {},
            apiUsage: result.details.apiUsage,
            autoDetected: true,
          }
        } : prev.config,
        toast: result.success
          ? createSuccessToast(
              result.details?.portalId 
                ? `Connection successful! Portal ${result.details.portalId} detected.`
                : 'HubSpot connection test successful'
            )
          : createErrorToast(result.message),
      }));

      return testResult;
    } catch (error) {
      console.error('❌ [DEBUG] handleTestConnection error:', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorResponse: (error as any)?.response?.data,
        errorStatus: (error as any)?.response?.status,
        timestamp: new Date().toISOString()
      });

      // Extract detailed error information
      const errorMessage = (error as any)?.response?.data?.message || 
                          (error as any)?.response?.data?.error || 
                          (error instanceof Error ? error.message : String(error));
      
      const errorDetails = (error as any)?.response?.data?.details;

      const result: ConnectionTestResult = {
        success: false,
        message: errorMessage || 'Connection test failed',
        details: errorDetails || {
          apiReachable: false,
          authValid: false,
          errorCount: 1,
        }
      };

      console.log('🏷️ [DEBUG] Final error result:', result);

      const errorToast = createErrorToast(errorMessage || error, 'Failed to test HubSpot connection');
      console.log('📢 [DEBUG] Creating error toast:', errorToast);

      setState(prev => ({
        ...prev,
        isTesting: false,
        lastTestResult: result,
        toast: errorToast,
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
      console.log('🍞 [DEBUG] Toast displayed:', {
        type: state.toast.type,
        title: state.toast.title,
        message: state.toast.message,
        duration: state.toast.type === 'error' ? 5000 : 3000,
        timestamp: new Date().toISOString()
      });

      const timer = setTimeout(() => {
        console.log('🍞 [DEBUG] Toast cleared automatically after timeout');
        setState(prev => ({ ...prev, toast: null }));
      }, state.toast.type === 'error' ? 5000 : 3000);
      return () => clearTimeout(timer);
    }
  }, [state.toast]);

  // Check for admin permissions - for now, allow all authenticated users
  // TODO: Implement proper role-based access control when user roles are properly configured
  const isAdmin = true; // Temporarily allow all users to configure HubSpot
  // const isAdmin = user?.role === 'admin' || user?.role === 'owner';

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
                  <span className="text-sm font-medium">
                    Connected
                    {state.config.portalInfo?.detectedPortalId && 
                      ` - Portal ${state.config.portalInfo.detectedPortalId}`
                    }
                  </span>
                </div>
              )}
              
              {state.config.portalInfo?.missingScopes?.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" 
                  style={{ 
                    backgroundColor: 'var(--color-warning-container)',
                    color: 'var(--color-on-warning-container)',
                  }}
                >
                  <ExclamationTriangleIcon className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    Limited Scopes ({state.config.portalInfo.missingScopes.length} missing)
                  </span>
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
                      className="block text-sm font-medium mb-2 flex items-center gap-2"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Portal ID
                      {state.config.portalInfo?.autoDetected && state.config.portalInfo.detectedPortalId && (
                        <span
                          className="text-xs px-2 py-1 rounded-full"
                          style={{
                            backgroundColor: 'var(--color-success-container)',
                            color: 'var(--color-on-success-container)',
                          }}
                        >
                          Auto-detected
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={state.config.portalId || ''}
                      onChange={(e) => handleFieldChange('portalId', e.target.value)}
                      disabled={!isAdmin || state.isSaving || (state.config.portalInfo?.autoDetected && state.config.portalInfo.detectedPortalId)}
                      placeholder="12345678"
                      className="w-full px-3 py-2 rounded-lg border transition-colors"
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        borderColor: 'var(--color-outline-variant)',
                        color: 'var(--color-text-primary)',
                        opacity: (state.config.portalInfo?.autoDetected && state.config.portalInfo.detectedPortalId) ? 0.7 : 1,
                      }}
                    />
                    <p
                      className="mt-1 text-xs"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {state.config.portalInfo?.autoDetected && state.config.portalInfo.detectedPortalId
                        ? 'Automatically detected from your API key'
                        : 'Optional: Your HubSpot portal/hub ID'
                      }
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

              {/* Portal Information Display */}
              {state.config.portalInfo && (state.config.portalInfo.detectedPortalId || state.config.portalId) && (
                <div
                  className="p-6 rounded-lg border"
                  style={{
                    backgroundColor: 'var(--color-surface-container)',
                    borderColor: 'var(--color-outline-variant)',
                  }}
                >
                  <h2
                    className="text-lg font-semibold mb-4 flex items-center gap-2"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    <InformationCircleIcon className="w-5 h-5" />
                    Portal Information
                    {state.config.portalInfo.autoDetected && (
                      <span
                        className="text-xs px-2 py-1 rounded-full"
                        style={{
                          backgroundColor: 'var(--color-primary-container)',
                          color: 'var(--color-on-primary-container)',
                        }}
                      >
                        Auto-detected
                      </span>
                    )}
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span
                        className="block text-sm font-medium"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        Portal ID
                      </span>
                      <span
                        className="text-lg font-mono"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {state.config.portalInfo.detectedPortalId || state.config.portalId}
                      </span>
                    </div>
                    
                    {state.config.portalInfo.apiUsage && (
                      <div>
                        <span
                          className="block text-sm font-medium"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          API Usage
                        </span>
                        <span
                          className="text-lg"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {state.config.portalInfo.apiUsage.used} / {state.config.portalInfo.apiUsage.limit}
                        </span>
                        <div
                          className="w-full bg-gray-200 rounded-full h-2 mt-1"
                        >
                          <div
                            className="h-2 rounded-full"
                            style={{
                              backgroundColor: 'var(--color-primary)',
                              width: `${(state.config.portalInfo.apiUsage.used / state.config.portalInfo.apiUsage.limit) * 100}%`
                            }}
                          />
                        </div>
                      </div>
                    )}
                    
                    {state.config.portalInfo.scopes && state.config.portalInfo.scopes.length > 0 && (
                      <div className="md:col-span-2">
                        <span
                          className="block text-sm font-medium mb-2"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          Available Scopes ({state.config.portalInfo.scopes.length})
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {state.config.portalInfo.scopes.map((scope, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 text-xs rounded-full"
                              style={{
                                backgroundColor: 'var(--color-success-container)',
                                color: 'var(--color-on-success-container)',
                              }}
                            >
                              {scope}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {state.config.portalInfo.missingScopes && state.config.portalInfo.missingScopes.length > 0 && (
                      <div className="md:col-span-2">
                        <span
                          className="block text-sm font-medium mb-2"
                          style={{ color: 'var(--color-error)' }}
                        >
                          Missing Scopes ({state.config.portalInfo.missingScopes.length})
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {state.config.portalInfo.missingScopes.map((scope, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 text-xs rounded-full"
                              style={{
                                backgroundColor: 'var(--color-error-container)',
                                color: 'var(--color-on-error-container)',
                              }}
                            >
                              {scope}
                            </span>
                          ))}
                        </div>
                        <p
                          className="text-sm mt-2"
                          style={{ color: 'var(--color-error)' }}
                        >
                          Some features may be limited due to missing scopes. Please update your Private App permissions in HubSpot.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

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
                  }).map(([key, label]) => {
                    const isValidated = state.config.scopeValidation?.[key];
                    const isEnabled = state.config.features?.[key] || false;
                    const showWarning = isEnabled && isValidated === false;
                    
                    return (
                      <label
                        key={key}
                        className="flex items-center justify-between py-2 cursor-pointer"
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <span
                            className="text-sm"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            {label}
                          </span>
                          {showWarning && (
                            <ExclamationTriangleIcon 
                              className="w-4 h-4"
                              style={{ color: 'var(--color-warning)' }}
                              title="Missing required scopes for this feature"
                            />
                          )}
                          {isValidated === true && isEnabled && (
                            <CheckCircleIcon 
                              className="w-4 h-4"
                              style={{ color: 'var(--color-success)' }}
                              title="Feature fully supported"
                            />
                          )}
                        </div>
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={(e) => handleFieldChange(`features.${key}`, e.target.checked)}
                          disabled={!isAdmin || state.isSaving}
                          className="w-4 h-4 rounded"
                          style={{
                            accentColor: 'var(--color-primary)',
                          }}
                        />
                      </label>
                    );
                  })}
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
            onClose={() => {
              console.log('🍞 [DEBUG] Toast closed by user');
              setState(prev => ({ ...prev, toast: null }));
            }}
          />
        )}
      </AuthenticatedLayout>
    </UserfrontProtectedRoute>
  );
}