/**
 * Main Settings Page
 * Dashboard overview of all integration statuses with navigation to platform-specific settings
 * Provides real-time health monitoring and configuration management
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { UserfrontProtectedRoute } from '../../components/auth/UserfrontProtectedRoute';
import { AuthenticatedLayout } from '../../components/layout/AuthenticatedLayout';
import { ConfigurationCard } from '../../components/configuration/ConfigurationCard';
import { ToastNotification } from '../../components/common/ToastNotification';
import { useUserfrontAuth } from '../../contexts/UserfrontAuthContext';
import { useTheme } from '../../design-system/themes/themeProvider';
import {
  Platform,
  ConnectionStatus,
  ConfigurationOverview,
  AuditLogEntry,
} from '../../components/configuration/types';
import {
  createAPIClient,
  formatRelativeTime,
  createErrorToast,
  createSuccessToast,
} from '../../components/configuration/utils';
import {
  ChartBarIcon,
  ClockIcon,
  ShieldCheckIcon,
  ServerStackIcon,
  ArrowPathIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

// Type definitions
interface SettingsPageState {
  overview: ConfigurationOverview | null;
  connectionStatuses: Record<Platform, ConnectionStatus>;
  recentAuditLogs: AuditLogEntry[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  toast: {
    show: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  } | null;
}

// API client - use full API URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:13000';
const api = createAPIClient(`${API_BASE_URL}/api/config`);

export default function SettingsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useUserfrontAuth();
  const { theme, resolvedMode } = useTheme();
  const isDark = resolvedMode === 'dark';

  // State management
  const [state, setState] = useState<SettingsPageState>({
    overview: null,
    connectionStatuses: {
      HUBSPOT: {
        platform: 'HUBSPOT',
        configured: false,
        connected: false,
        healthy: false,
        message: 'Not configured',
        healthStatus: 'UNKNOWN',
      },
      STRIPE: {
        platform: 'STRIPE',
        configured: false,
        connected: false,
        healthy: false,
        message: 'Not configured',
        healthStatus: 'UNKNOWN',
      },
      QUICKBOOKS: {
        platform: 'QUICKBOOKS',
        configured: false,
        connected: false,
        healthy: false,
        message: 'Not configured',
        healthStatus: 'UNKNOWN',
      },
    },
    recentAuditLogs: [],
    isLoading: true,
    isRefreshing: false,
    error: null,
    toast: null,
  });

  // Fetch configuration overview
  const fetchOverview = useCallback(async () => {
    try {
      const [overview, statuses, logs] = await Promise.all([
        api.get<ConfigurationOverview>('/overview'),
        api.get<Record<Platform, ConnectionStatus>>('/status'),
        api.get<AuditLogEntry[]>('/audit-logs?limit=5'),
      ]);

      setState(prev => ({
        ...prev,
        overview,
        connectionStatuses: statuses,
        recentAuditLogs: logs,
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      console.error('Failed to fetch configuration overview:', error);
      
      // Set mock data for development
      setState(prev => ({
        ...prev,
        overview: {
          totalPlatforms: 3,
          configuredCount: 0,
          healthyCount: 0,
          unhealthyCount: 0,
          lastUpdated: new Date(),
          platforms: {
            HUBSPOT: {
              configured: false,
              healthy: false,
              errorCount: 0,
              webhookCount: 0,
            },
            STRIPE: {
              configured: false,
              healthy: false,
              errorCount: 0,
              webhookCount: 0,
            },
            QUICKBOOKS: {
              configured: false,
              healthy: false,
              errorCount: 0,
              webhookCount: 0,
            },
          },
        },
        isLoading: false,
        error: 'Failed to load configuration data',
      }));
    }
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setState(prev => ({ ...prev, isRefreshing: true }));
    await fetchOverview();
    setState(prev => ({
      ...prev,
      isRefreshing: false,
      toast: createSuccessToast('Configuration data refreshed'),
    }));
  }, [fetchOverview]);

  // Handle platform configuration navigation
  const handleConfigurePlatform = useCallback((platform: Platform) => {
    router.push(`/settings/${platform.toLowerCase()}`);
  }, [router]);

  // Handle connection test
  const handleTestConnection = useCallback(async (platform: Platform) => {
    try {
      const result = await api.post(`/test-${platform.toLowerCase()}`, {});
      
      setState(prev => ({
        ...prev,
        toast: result.success
          ? createSuccessToast(`${platform} connection test successful`)
          : createErrorToast(result.message),
      }));

      // Refresh status after test
      await fetchOverview();
    } catch (error) {
      setState(prev => ({
        ...prev,
        toast: createErrorToast(error, `Failed to test ${platform} connection`),
      }));
    }
  }, [fetchOverview]);

  // Initial data fetch
  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // Clear toast after duration
  useEffect(() => {
    if (state.toast) {
      const timer = setTimeout(() => {
        setState(prev => ({ ...prev, toast: null }));
      }, state.toast.type === 'error' ? 5000 : 3000);
      return () => clearTimeout(timer);
    }
  }, [state.toast]);

  // Render loading state
  if (state.isLoading) {
    return (
      <UserfrontProtectedRoute>
        <AuthenticatedLayout pathname="/settings">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div
                className="inline-block animate-spin rounded-full h-12 w-12 border-b-2"
                style={{ borderColor: 'var(--color-primary)' }}
              />
              <p className="mt-4" style={{ color: 'var(--color-text-secondary)' }}>
                Loading configuration settings...
              </p>
            </div>
          </div>
        </AuthenticatedLayout>
      </UserfrontProtectedRoute>
    );
  }

  return (
    <UserfrontProtectedRoute>
      <AuthenticatedLayout pathname="/settings">
        <div className="space-y-6">
          {/* Page Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1
                className="text-3xl font-bold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Integration Settings
              </h1>
              <p
                className="mt-2 text-sm"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Configure and monitor your platform integrations
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={state.isRefreshing}
              className="px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
              style={{
                backgroundColor: 'var(--color-primary-container)',
                color: 'var(--color-on-primary-container)',
                opacity: state.isRefreshing ? 0.5 : 1,
              }}
            >
              <ArrowPathIcon
                className={`w-5 h-5 ${state.isRefreshing ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>
          </div>

          {/* Error Alert */}
          {state.error && (
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
                <p className="font-medium">Configuration Error</p>
                <p className="text-sm mt-1 opacity-90">{state.error}</p>
              </div>
            </div>
          )}

          {/* Overview Stats */}
          {state.overview && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div
                className="p-6 rounded-lg border"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-outline-variant)',
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p
                      className="text-sm font-medium"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Total Platforms
                    </p>
                    <p
                      className="text-2xl font-bold mt-1"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {state.overview.totalPlatforms}
                    </p>
                  </div>
                  <ServerStackIcon
                    className="w-8 h-8"
                    style={{ color: 'var(--color-primary)' }}
                  />
                </div>
              </div>

              <div
                className="p-6 rounded-lg border"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-outline-variant)',
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p
                      className="text-sm font-medium"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Configured
                    </p>
                    <p
                      className="text-2xl font-bold mt-1"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {state.overview.configuredCount}
                    </p>
                  </div>
                  <Cog6ToothIcon
                    className="w-8 h-8"
                    style={{ color: 'var(--color-secondary)' }}
                  />
                </div>
              </div>

              <div
                className="p-6 rounded-lg border"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-outline-variant)',
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p
                      className="text-sm font-medium"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Healthy
                    </p>
                    <p
                      className="text-2xl font-bold mt-1"
                      style={{ color: '#10b981' }}
                    >
                      {state.overview.healthyCount}
                    </p>
                  </div>
                  <CheckCircleIcon className="w-8 h-8" style={{ color: '#10b981' }} />
                </div>
              </div>

              <div
                className="p-6 rounded-lg border"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-outline-variant)',
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p
                      className="text-sm font-medium"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Issues
                    </p>
                    <p
                      className="text-2xl font-bold mt-1"
                      style={{ color: state.overview.unhealthyCount > 0 ? '#ef4444' : 'var(--color-text-primary)' }}
                    >
                      {state.overview.unhealthyCount}
                    </p>
                  </div>
                  <ExclamationTriangleIcon
                    className="w-8 h-8"
                    style={{ color: state.overview.unhealthyCount > 0 ? '#ef4444' : 'var(--color-text-secondary)' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Platform Configuration Cards */}
          <div>
            <h2
              className="text-xl font-semibold mb-4"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Platform Configurations
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* HubSpot Card */}
              <ConfigurationCard
                platform="HUBSPOT"
                title="HubSpot"
                description="CRM and marketing automation platform"
                status={state.connectionStatuses.HUBSPOT}
                onConfigure={() => handleConfigurePlatform('HUBSPOT')}
                onTest={() => handleTestConnection('HUBSPOT')}
                onEdit={() => handleConfigurePlatform('HUBSPOT')}
              />

              {/* Stripe Card */}
              <ConfigurationCard
                platform="STRIPE"
                title="Stripe"
                description="Payment processing and billing"
                status={state.connectionStatuses.STRIPE}
                onConfigure={() => handleConfigurePlatform('STRIPE')}
                onTest={() => handleTestConnection('STRIPE')}
                onEdit={() => handleConfigurePlatform('STRIPE')}
              />

              {/* QuickBooks Card */}
              <ConfigurationCard
                platform="QUICKBOOKS"
                title="QuickBooks"
                description="Accounting and financial management"
                status={state.connectionStatuses.QUICKBOOKS}
                onConfigure={() => handleConfigurePlatform('QUICKBOOKS')}
                onTest={() => handleTestConnection('QUICKBOOKS')}
                onEdit={() => handleConfigurePlatform('QUICKBOOKS')}
              />
            </div>
          </div>

          {/* Recent Configuration Changes */}
          {state.recentAuditLogs.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2
                  className="text-xl font-semibold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Recent Configuration Changes
                </h2>
                <button
                  onClick={() => router.push('/settings/audit-logs')}
                  className="text-sm hover:underline"
                  style={{ color: 'var(--color-primary)' }}
                >
                  View all logs →
                </button>
              </div>
              <div
                className="rounded-lg border overflow-hidden"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-outline-variant)',
                }}
              >
                <table className="w-full">
                  <thead>
                    <tr
                      style={{
                        backgroundColor: 'var(--color-surface-variant)',
                        borderBottom: `1px solid var(--color-outline-variant)`,
                      }}
                    >
                      <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                        Action
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                        Platform
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                        User
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                        Time
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.recentAuditLogs.map((log, index) => (
                      <tr
                        key={log.id}
                        style={{
                          borderBottom: index < state.recentAuditLogs.length - 1
                            ? `1px solid var(--color-outline-variant)`
                            : undefined,
                        }}
                      >
                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-primary)' }}>
                          {log.action}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-primary)' }}>
                          {log.platform || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          {log.performedByEmail || log.performedBy}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          {formatRelativeTime(log.timestamp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div
            className="p-6 rounded-lg border"
            style={{
              backgroundColor: 'var(--color-surface-variant)',
              borderColor: 'var(--color-outline-variant)',
            }}
          >
            <h3
              className="text-lg font-semibold mb-4"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Quick Actions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                onClick={() => router.push('/settings/webhooks')}
                className="p-4 rounded-lg text-left hover:scale-105 transition-transform"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: `1px solid var(--color-outline-variant)`,
                }}
              >
                <ShieldCheckIcon className="w-6 h-6 mb-2" style={{ color: 'var(--color-primary)' }} />
                <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  Webhook Settings
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Configure webhook endpoints
                </p>
              </button>

              <button
                onClick={() => router.push('/settings/backup')}
                className="p-4 rounded-lg text-left hover:scale-105 transition-transform"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: `1px solid var(--color-outline-variant)`,
                }}
              >
                <ServerStackIcon className="w-6 h-6 mb-2" style={{ color: 'var(--color-secondary)' }} />
                <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  Backup & Restore
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Manage configuration backups
                </p>
              </button>

              <button
                onClick={() => router.push('/settings/api-keys')}
                className="p-4 rounded-lg text-left hover:scale-105 transition-transform"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: `1px solid var(--color-outline-variant)`,
                }}
              >
                <ChartBarIcon className="w-6 h-6 mb-2" style={{ color: 'var(--color-tertiary)' }} />
                <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  API Keys
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                  Manage API access keys
                </p>
              </button>

              <button
                onClick={() => router.push('/settings/logs')}
                className="p-4 rounded-lg text-left hover:scale-105 transition-transform"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  border: `1px solid var(--color-outline-variant)`,
                }}
              >
                <ClockIcon className="w-6 h-6 mb-2" style={{ color: 'var(--color-error)' }} />
                <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  System Logs
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                  View system activity logs
                </p>
              </button>
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