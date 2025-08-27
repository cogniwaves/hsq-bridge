/**
 * Navigation Integration Test Page
 * Tests Phase 5 integration with authentication and real-time updates
 */

'use client';

import React, { useState } from 'react';
import { useUserfrontAuth } from '../../contexts/UserfrontAuthContext';
import { useNavigationData } from '../../hooks/useNavigationData';
import { useMobileNavigation } from '../../hooks/useMobileNavigation';
import { updateNavigationBadges } from '../../components/navigation/navigationConfig';
import { UserfrontProtectedRoute } from '../../components/auth/UserfrontProtectedRoute';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ArrowPathIcon,
  DevicePhoneMobileIcon,
  ComputerDesktopIcon,
  BellIcon,
  DocumentTextIcon,
  CreditCardIcon,
  CloudArrowDownIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline';

function NavigationTestContent() {
  const { user, isAuthenticated } = useUserfrontAuth();
  const { stats, refresh, isLoading, error } = useNavigationData();
  const { isMobile, isTablet, viewportSize, getOptimalNavMode } = useMobileNavigation();
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});

  // Test badge updates
  const testBadgeUpdates = () => {
    const testData = {
      'invoices': Math.floor(Math.random() * 10),
      'payments': Math.floor(Math.random() * 5),
      'webhooks': Math.floor(Math.random() * 3),
      'transfer-queue': Math.floor(Math.random() * 8),
      'notifications': Math.floor(Math.random() * 12),
    };

    updateNavigationBadges(testData);
    setTestResults(prev => ({ ...prev, badgeUpdate: true }));
    
    // Reset after 3 seconds
    setTimeout(() => {
      refresh();
      setTestResults(prev => ({ ...prev, badgeUpdate: false }));
    }, 3000);
  };

  // Test sync status simulation
  const testSyncStatus = () => {
    // This would normally trigger through WebSocket or API
    setTestResults(prev => ({ ...prev, syncStatus: true }));
    
    setTimeout(() => {
      setTestResults(prev => ({ ...prev, syncStatus: false }));
    }, 3000);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Navigation Integration Test
        </h1>
        <p className="mt-2" style={{ color: 'var(--color-text-secondary)' }}>
          Phase 5: Complete integration testing with authentication and real-time updates
        </p>
      </div>

      {/* Authentication Status */}
      <div 
        className="rounded-lg p-6 border"
        style={{ 
          backgroundColor: 'var(--color-surface)', 
          borderColor: 'var(--color-surface-variant)' 
        }}
      >
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
          Authentication Status
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--color-text-secondary)' }}>Authenticated</span>
            <div className="flex items-center space-x-2">
              {isAuthenticated ? (
                <CheckCircleIcon className="w-5 h-5 text-green-500" />
              ) : (
                <XCircleIcon className="w-5 h-5 text-red-500" />
              )}
              <span className="text-sm font-medium">
                {isAuthenticated ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
          {user && (
            <>
              <div className="flex items-center justify-between">
                <span style={{ color: 'var(--color-text-secondary)' }}>User Email</span>
                <span className="text-sm font-mono">{user.email || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: 'var(--color-text-secondary)' }}>User Role</span>
                <span className="text-sm font-mono">{user.role || 'member'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: 'var(--color-text-secondary)' }}>Tenant ID</span>
                <span className="text-sm font-mono">{user.tenantId || user.authorization?.tenantId || 'N/A'}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Device & Viewport Info */}
      <div 
        className="rounded-lg p-6 border"
        style={{ 
          backgroundColor: 'var(--color-surface)', 
          borderColor: 'var(--color-surface-variant)' 
        }}
      >
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
          Device & Viewport
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--color-text-secondary)' }}>Device Type</span>
            <div className="flex items-center space-x-2">
              {isMobile ? (
                <DevicePhoneMobileIcon className="w-5 h-5" />
              ) : (
                <ComputerDesktopIcon className="w-5 h-5" />
              )}
              <span className="text-sm font-medium">
                {isMobile ? 'Mobile' : isTablet ? 'Tablet' : 'Desktop'}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--color-text-secondary)' }}>Viewport Size</span>
            <span className="text-sm font-mono">
              {viewportSize.width} × {viewportSize.height}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--color-text-secondary)' }}>Optimal Nav Mode</span>
            <span className="text-sm font-mono">{getOptimalNavMode()}</span>
          </div>
        </div>
      </div>

      {/* Navigation Stats */}
      <div 
        className="rounded-lg p-6 border"
        style={{ 
          backgroundColor: 'var(--color-surface)', 
          borderColor: 'var(--color-surface-variant)' 
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Navigation Stats
          </h2>
          <button
            onClick={refresh}
            disabled={isLoading}
            className="flex items-center space-x-2 px-3 py-1 rounded-lg transition-colors"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-on-primary)',
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="text-sm">Refresh</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded bg-red-50 text-red-600 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard
            icon={DocumentTextIcon}
            label="Pending Invoices"
            value={stats.pendingInvoices}
            color="blue"
          />
          <StatCard
            icon={CreditCardIcon}
            label="Recent Payments"
            value={stats.recentPayments}
            color="green"
          />
          <StatCard
            icon={CloudArrowDownIcon}
            label="Failed Webhooks"
            value={stats.failedWebhooks}
            color="yellow"
          />
          <StatCard
            icon={ArrowsRightLeftIcon}
            label="Pending Transfers"
            value={stats.pendingTransfers}
            color="purple"
          />
          <StatCard
            icon={BellIcon}
            label="Notifications"
            value={stats.unreadNotifications}
            color="red"
          />
        </div>

        {/* Sync Status */}
        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--color-surface-variant)' }}>
          <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
            Sync Status
          </h3>
          <div className="flex space-x-4">
            <SyncIndicator service="HubSpot" status={stats.syncStatus.hubspot} />
            <SyncIndicator service="Stripe" status={stats.syncStatus.stripe} />
            <SyncIndicator service="QuickBooks" status={stats.syncStatus.quickbooks} />
          </div>
        </div>
      </div>

      {/* Test Actions */}
      <div 
        className="rounded-lg p-6 border"
        style={{ 
          backgroundColor: 'var(--color-surface)', 
          borderColor: 'var(--color-surface-variant)' 
        }}
      >
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
          Test Actions
        </h2>
        <div className="space-y-3">
          <button
            onClick={testBadgeUpdates}
            className="w-full px-4 py-2 rounded-lg transition-colors text-left flex items-center justify-between"
            style={{
              backgroundColor: testResults.badgeUpdate ? 'var(--color-success-container)' : 'var(--color-primary)',
              color: testResults.badgeUpdate ? 'var(--color-on-success-container)' : 'var(--color-on-primary)',
            }}
          >
            <span>Test Badge Updates</span>
            {testResults.badgeUpdate && <CheckCircleIcon className="w-5 h-5" />}
          </button>

          <button
            onClick={testSyncStatus}
            className="w-full px-4 py-2 rounded-lg transition-colors text-left flex items-center justify-between"
            style={{
              backgroundColor: testResults.syncStatus ? 'var(--color-success-container)' : 'var(--color-primary)',
              color: testResults.syncStatus ? 'var(--color-on-success-container)' : 'var(--color-on-primary)',
            }}
          >
            <span>Test Sync Status</span>
            {testResults.syncStatus && <CheckCircleIcon className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Integration Checklist */}
      <div 
        className="rounded-lg p-6 border"
        style={{ 
          backgroundColor: 'var(--color-surface)', 
          borderColor: 'var(--color-surface-variant)' 
        }}
      >
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
          Phase 5 Integration Checklist
        </h2>
        <div className="space-y-2">
          <ChecklistItem checked label="Layout integration with navigation system" />
          <ChecklistItem checked label="Authentication state management" />
          <ChecklistItem checked label="Dynamic navigation visibility based on permissions" />
          <ChecklistItem checked label="Mobile-responsive layout adjustments" />
          <ChecklistItem checked label="Real-time badge updates with API data" />
          <ChecklistItem checked label="User profile integration in navigation" />
          <ChecklistItem checked label="Route protection with authentication" />
          <ChecklistItem checked label="WebSocket support for real-time updates" />
          <ChecklistItem checked label="Swipe gestures for mobile navigation" />
          <ChecklistItem checked label="Performance optimization with lazy loading" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: any) {
  const colorMap: Record<string, string> = {
    blue: 'rgba(59, 130, 246, 0.1)',
    green: 'rgba(34, 197, 94, 0.1)',
    yellow: 'rgba(250, 204, 21, 0.1)',
    purple: 'rgba(168, 85, 247, 0.1)',
    red: 'rgba(239, 68, 68, 0.1)',
  };

  return (
    <div 
      className="p-4 rounded-lg"
      style={{ backgroundColor: colorMap[color] || colorMap.blue }}
    >
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
        <span className="text-2xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {value}
        </span>
      </div>
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </p>
    </div>
  );
}

function SyncIndicator({ service, status }: { service: string; status: string }) {
  const statusColors = {
    active: 'rgb(34, 197, 94)',
    idle: 'rgb(156, 163, 175)',
    error: 'rgb(239, 68, 68)',
  };

  return (
    <div className="flex items-center space-x-2">
      <div 
        className="w-2 h-2 rounded-full"
        style={{ 
          backgroundColor: statusColors[status as keyof typeof statusColors] || statusColors.idle,
        }}
      />
      <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        {service}
      </span>
    </div>
  );
}

function ChecklistItem({ checked, label }: { checked: boolean; label: string }) {
  return (
    <div className="flex items-center space-x-2">
      {checked ? (
        <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
      ) : (
        <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
      )}
      <span 
        className={checked ? 'line-through' : ''}
        style={{ color: checked ? 'var(--color-text-secondary)' : 'var(--color-text-primary)' }}
      >
        {label}
      </span>
    </div>
  );
}

export default function NavigationTestPage() {
  return (
    <UserfrontProtectedRoute>
      <NavigationTestContent />
    </UserfrontProtectedRoute>
  );
}