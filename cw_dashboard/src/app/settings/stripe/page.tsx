/**
 * Stripe Settings Page
 * Configure Stripe API integration, webhook endpoints, and payment settings
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { UserfrontProtectedRoute } from '../../../components/auth/UserfrontProtectedRoute';
import { AuthenticatedLayout } from '../../../components/layout/AuthenticatedLayout';
import { ConnectionTester } from '../../../components/configuration/ConnectionTester';
import { APIKeyInput } from '../../../components/configuration/APIKeyInput';
import { ToastNotification } from '../../../components/common/ToastNotification';
import { useUserfrontAuth } from '../../../contexts/UserfrontAuthContext';
import { useTheme } from '../../../design-system/themes/themeProvider';
import {
  StripeConfig,
  ConnectionTestResult,
  WebhookConfig,
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
  GlobeAltIcon,
  ArrowPathIcon,
  ClipboardDocumentIcon,
  BoltIcon,
  CreditCardIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';

// Type definitions
interface StripeSettingsState {
  config: Partial<StripeConfig>;
  webhookConfig: Partial<WebhookConfig>;
  originalConfig: Partial<StripeConfig>;
  isLoading: boolean;
  isSaving: boolean;
  isTesting: boolean;
  hasChanges: boolean;
  lastTestResult: ConnectionTestResult | null;
  validationErrors: Record<string, string>;
  webhookUrl: string;
  toast: {
    show: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  } | null;
}

interface StripeCurrencies {
  usd: boolean;
  cad: boolean;
  eur: boolean;
  gbp: boolean;
  aud: boolean;
  jpy: boolean;
}

// API client - use full API URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:13000';
const api = createAPIClient(`${API_BASE_URL}/api/config`);

export default function StripeSettingsPage() {
  const router = useRouter();
  const { user } = useUserfrontAuth();
  const { theme, resolvedMode } = useTheme();
  const isDark = resolvedMode === 'dark';

  // State management
  const [state, setState] = useState<StripeSettingsState>({
    config: {
      platform: 'STRIPE',
      secretKey: '',
      publishableKey: '',
      webhookSecret: '',
      accountId: '',
      liveMode: false,
      syncEnabled: true,
      features: {
        payments: true,
        invoices: true,
        customers: true,
        subscriptions: true,
        refunds: true,
        disputes: false,
      },
      isActive: false,
      environment: 'test',
      healthStatus: 'UNKNOWN',
    },
    webhookConfig: {
      platform: 'STRIPE',
      endpointUrl: '',
      signingSecret: '',
      subscribedEvents: [
        'invoice.payment_succeeded',
        'invoice.payment_failed',
        'payment_intent.succeeded',
        'charge.refunded',
        'customer.created',
        'customer.updated',
      ],
      isActive: false,
      authType: 'SIGNATURE',
      maxRetries: 3,
      timeoutMs: 30000,
    },
    originalConfig: {},
    isLoading: true,
    isSaving: false,
    isTesting: false,
    hasChanges: false,
    lastTestResult: null,
    validationErrors: {},
    webhookUrl: '',
    toast: null,
  });

  // Generate webhook URL based on environment
  useEffect(() => {
    const baseUrl = typeof window !== 'undefined' 
      ? window.location.origin.replace(':13001', ':13000') // API port
      : 'http://localhost:13000';
    setState(prev => ({
      ...prev,
      webhookUrl: `${baseUrl}/api/webhooks/stripe`,
    }));
  }, []);

  // Fetch current configuration
  const fetchConfiguration = useCallback(async () => {
    try {
      const [config, webhook] = await Promise.all([
        api.get<StripeConfig>('/stripe'),
        api.get<WebhookConfig>('/webhooks/stripe'),
      ]);
      
      setState(prev => ({
        ...prev,
        config: config,
        webhookConfig: webhook,
        originalConfig: config,
        isLoading: false,
        hasChanges: false,
      }));
    } catch (error) {
      console.error('Failed to fetch Stripe configuration:', error);
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
      } else if (field.startsWith('webhook.')) {
        const webhookField = field.replace('webhook.', '');
        return {
          ...prev,
          webhookConfig: {
            ...prev.webhookConfig,
            [webhookField]: value,
          },
          hasChanges: true,
        };
      } else {
        newConfig[field] = value;
      }

      // Update environment based on key
      if (field === 'secretKey' && value) {
        newConfig.environment = value.startsWith('sk_test_') ? 'test' : 'production';
        newConfig.liveMode = value.startsWith('sk_live_');
      }

      // Check if there are changes
      const hasChanges = JSON.stringify(newConfig) !== JSON.stringify(prev.originalConfig);

      // Validate field
      let validationErrors = { ...prev.validationErrors };
      if (field === 'secretKey') {
        const validation = validateAPIKey('STRIPE', value);
        if (!validation.isValid && value) {
          validationErrors.secretKey = validation.errors[0];
        } else {
          delete validationErrors.secretKey;
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
    
    if (!state.config.secretKey) {
      errors.secretKey = 'Secret Key is required';
    } else {
      const validation = validateAPIKey('STRIPE', state.config.secretKey);
      if (!validation.isValid) {
        errors.secretKey = validation.errors[0];
      }
    }

    if (state.webhookConfig.isActive && !state.webhookConfig.signingSecret) {
      errors.webhookSecret = 'Webhook secret is required when webhooks are enabled';
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
      const [savedConfig, savedWebhook] = await Promise.all([
        api.post<StripeConfig>('/stripe', state.config),
        api.post<WebhookConfig>('/webhooks/stripe', state.webhookConfig),
      ]);
      
      setState(prev => ({
        ...prev,
        config: savedConfig,
        webhookConfig: savedWebhook,
        originalConfig: savedConfig,
        isSaving: false,
        hasChanges: false,
        toast: createSuccessToast('Stripe configuration saved successfully'),
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isSaving: false,
        toast: createErrorToast(error, 'Failed to save Stripe configuration'),
      }));
    }
  }, [state.config, state.webhookConfig]);

  // Handle test connection
  const handleTestConnection = useCallback(async (config: Record<string, any>) => {
    setState(prev => ({ ...prev, isTesting: true }));

    try {
      const result = await api.post<ConnectionTestResult>('/test-stripe', {
        secretKey: config.secretKey || state.config.secretKey,
      });

      setState(prev => ({
        ...prev,
        isTesting: false,
        lastTestResult: result,
        toast: result.success
          ? createSuccessToast('Stripe connection test successful')
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
        toast: createErrorToast(error, 'Failed to test Stripe connection'),
      }));

      return result;
    }
  }, [state.config.secretKey]);

  // Handle copy webhook URL
  const handleCopyWebhookUrl = useCallback(() => {
    navigator.clipboard.writeText(state.webhookUrl);
    setState(prev => ({
      ...prev,
      toast: createSuccessToast('Webhook URL copied to clipboard'),
    }));
  }, [state.webhookUrl]);

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
      <AuthenticatedLayout pathname="/settings/stripe">
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
                  <span style={{ fontSize: '32px' }}>💳</span>
                  Stripe Settings
                </h1>
                <p
                  className="mt-2 text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Configure your Stripe payment processing and webhook integration
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                {state.config.liveMode ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" 
                    style={{ 
                      backgroundColor: '#fef2f2',
                      color: '#ef4444',
                    }}
                  >
                    <BoltIcon className="w-4 h-4" />
                    <span className="text-sm font-medium">Live Mode</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" 
                    style={{ 
                      backgroundColor: '#fefce8',
                      color: '#eab308',
                    }}
                  >
                    <ExclamationTriangleIcon className="w-4 h-4" />
                    <span className="text-sm font-medium">Test Mode</span>
                  </div>
                )}
                
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
          </div>

          {/* Live Mode Warning */}
          {state.config.liveMode && (
            <div
              className="p-4 rounded-lg border flex items-start gap-3"
              style={{
                backgroundColor: 'var(--color-error-container)',
                borderColor: 'var(--color-error)',
                color: 'var(--color-on-error-container)',
              }}
            >
              <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Live Mode Active</p>
                <p className="text-sm mt-1 opacity-90">
                  You are using live API keys. Real payments will be processed. Please ensure all configurations are correct.
                </p>
              </div>
            </div>
          )}

          {/* Main Configuration Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Configuration Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* API Keys Configuration */}
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
                  API Keys Configuration
                </h2>
                
                <div className="space-y-4">
                  <APIKeyInput
                    platform="STRIPE"
                    value={state.config.secretKey || ''}
                    onChange={(value) => handleFieldChange('secretKey', value)}
                    label="Secret Key"
                    placeholder="sk_test_... or sk_live_..."
                    description="Your Stripe secret API key"
                    required
                    disabled={!isAdmin || state.isSaving}
                    showStrength
                    maskInput
                    validateOnChange
                    error={state.validationErrors.secretKey}
                  />

                  <div>
                    <label
                      className="block text-sm font-medium mb-2"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Publishable Key
                    </label>
                    <input
                      type="text"
                      value={state.config.publishableKey || ''}
                      onChange={(e) => handleFieldChange('publishableKey', e.target.value)}
                      disabled={!isAdmin || state.isSaving}
                      placeholder="pk_test_... or pk_live_..."
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
                      Optional: Your Stripe publishable key for client-side operations
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
                      placeholder="acct_..."
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
                      Optional: Your Stripe account identifier
                    </p>
                  </div>
                </div>
              </div>

              {/* Webhook Configuration */}
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
                  Webhook Configuration
                </h2>
                
                <div className="space-y-4">
                  <div>
                    <label
                      className="block text-sm font-medium mb-2"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Webhook Endpoint URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={state.webhookUrl}
                        readOnly
                        className="flex-1 px-3 py-2 rounded-lg border transition-colors"
                        style={{
                          backgroundColor: 'var(--color-surface-variant)',
                          borderColor: 'var(--color-outline-variant)',
                          color: 'var(--color-text-secondary)',
                        }}
                      />
                      <button
                        onClick={handleCopyWebhookUrl}
                        className="px-3 py-2 rounded-lg border hover:scale-105 transition-transform"
                        style={{
                          backgroundColor: 'var(--color-surface)',
                          borderColor: 'var(--color-outline-variant)',
                          color: 'var(--color-text-primary)',
                        }}
                        title="Copy to clipboard"
                      >
                        <ClipboardDocumentIcon className="w-5 h-5" />
                      </button>
                    </div>
                    <p
                      className="mt-1 text-xs"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Add this URL to your Stripe webhook endpoints
                    </p>
                  </div>

                  <div>
                    <label
                      className="block text-sm font-medium mb-2"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Webhook Signing Secret
                    </label>
                    <input
                      type="text"
                      value={state.webhookConfig.signingSecret || ''}
                      onChange={(e) => handleFieldChange('webhook.signingSecret', e.target.value)}
                      disabled={!isAdmin || state.isSaving}
                      placeholder="whsec_..."
                      className="w-full px-3 py-2 rounded-lg border transition-colors font-mono text-sm"
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        borderColor: state.validationErrors.webhookSecret 
                          ? 'var(--color-error)' 
                          : 'var(--color-outline-variant)',
                        color: 'var(--color-text-primary)',
                      }}
                    />
                    {state.validationErrors.webhookSecret && (
                      <p className="mt-1 text-xs" style={{ color: 'var(--color-error)' }}>
                        {state.validationErrors.webhookSecret}
                      </p>
                    )}
                    <p
                      className="mt-1 text-xs"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Get this from your Stripe webhook endpoint settings
                    </p>
                  </div>

                  <label className="flex items-center justify-between">
                    <div>
                      <span
                        className="text-sm font-medium"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        Enable Webhooks
                      </span>
                      <p
                        className="text-xs mt-1"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        Receive real-time updates from Stripe
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={state.webhookConfig.isActive || false}
                      onChange={(e) => handleFieldChange('webhook.isActive', e.target.checked)}
                      disabled={!isAdmin || state.isSaving}
                      className="w-4 h-4 rounded"
                      style={{
                        accentColor: 'var(--color-primary)',
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Feature Configuration */}
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
                
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries({
                    payments: { label: 'Payment Processing', icon: <CreditCardIcon className="w-4 h-4" /> },
                    invoices: { label: 'Invoice Management', icon: <DocumentTextIcon className="w-4 h-4" /> },
                    customers: { label: 'Customer Sync', icon: <GlobeAltIcon className="w-4 h-4" /> },
                    subscriptions: { label: 'Subscriptions', icon: <ArrowPathIcon className="w-4 h-4" /> },
                    refunds: { label: 'Refund Processing', icon: <BanknotesIcon className="w-4 h-4" /> },
                    disputes: { label: 'Dispute Handling', icon: <ExclamationTriangleIcon className="w-4 h-4" /> },
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
                platform="STRIPE"
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
                    href="https://stripe.com/docs/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm hover:underline"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    <DocumentTextIcon className="w-4 h-4" />
                    API Keys Documentation
                  </a>
                  
                  <a
                    href="https://dashboard.stripe.com/webhooks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm hover:underline"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    <BoltIcon className="w-4 h-4" />
                    Webhook Endpoints
                  </a>
                  
                  <a
                    href="https://stripe.com/docs/webhooks/signatures"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm hover:underline"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    <ExclamationTriangleIcon className="w-4 h-4" />
                    Webhook Security Guide
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
                    <strong>Webhook Events:</strong><br />
                    • invoice.payment_succeeded<br />
                    • payment_intent.succeeded<br />
                    • charge.refunded<br />
                    • customer.created/updated
                  </p>
                </div>
              </div>

              {/* Environment Info */}
              <div
                className="p-4 rounded-lg border"
                style={{
                  backgroundColor: state.config.liveMode 
                    ? 'var(--color-error-container)' 
                    : 'var(--color-warning-container)',
                  borderColor: state.config.liveMode 
                    ? 'var(--color-error)' 
                    : 'var(--color-warning)',
                }}
              >
                <h4
                  className="font-medium mb-2"
                  style={{ 
                    color: state.config.liveMode 
                      ? 'var(--color-on-error-container)' 
                      : 'var(--color-on-warning-container)' 
                  }}
                >
                  Environment: {state.config.liveMode ? 'Production' : 'Test'}
                </h4>
                <p
                  className="text-sm"
                  style={{ 
                    color: state.config.liveMode 
                      ? 'var(--color-on-error-container)' 
                      : 'var(--color-on-warning-container)',
                    opacity: 0.9,
                  }}
                >
                  {state.config.liveMode 
                    ? 'Real payments will be processed' 
                    : 'Test mode - no real charges'}
                </p>
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