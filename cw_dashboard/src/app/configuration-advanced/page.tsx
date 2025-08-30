/**
 * Advanced Configuration Demo Page
 * Showcases enhanced OAuth wizard and real-time connection testing
 */

'use client';

import React, { useState, useCallback } from 'react';
import { useTheme } from '@/design-system/themes/themeProvider';
import {
  QuickBooksOAuthWizard,
  TokenHealthMonitor,
  LiveConnectionTester,
  ConnectionRecovery,
  HealthDashboard,
  Platform,
  ConnectionTestResult,
} from '@/components/configuration';
import {
  Cog6ToothIcon,
  SparklesIcon,
  BeakerIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

// Mock data for demonstration
const mockTokens = [
  {
    platform: 'QUICKBOOKS' as Platform,
    accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    refreshToken: 'rt_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
    issuedAt: new Date(),
    scopes: ['com.intuit.quickbooks.accounting', 'com.intuit.quickbooks.payment'],
    companyName: 'Acme Corporation',
    realmId: '123456789',
  },
  {
    platform: 'HUBSPOT' as Platform,
    accessToken: 'pat-na1-1234567890abcdef',
    expiresAt: new Date(Date.now() + 7200000), // 2 hours from now
    issuedAt: new Date(),
    scopes: ['crm.objects.contacts.read', 'crm.objects.companies.read'],
    companyName: 'HubSpot Portal',
  },
  {
    platform: 'STRIPE' as Platform,
    accessToken: 'sk_test_1234567890abcdef',
    expiresAt: new Date(Date.now() + 86400000), // 24 hours from now
    issuedAt: new Date(),
    scopes: ['read', 'write'],
    companyName: 'Stripe Account',
  },
];

const mockPlatformConfigs = [
  {
    platform: 'QUICKBOOKS' as Platform,
    config: { accessToken: 'mock_token', realmId: '123' },
    enabled: true,
  },
  {
    platform: 'HUBSPOT' as Platform,
    config: { apiKey: 'mock_key' },
    enabled: true,
  },
  {
    platform: 'STRIPE' as Platform,
    config: { secretKey: 'mock_secret' },
    enabled: true,
  },
];

export default function AdvancedConfigurationDemo() {
  const { theme } = useTheme();
  const colors = theme.colors;

  const [activeDemo, setActiveDemo] = useState<string>('oauth');
  const [lastConnectionError, setLastConnectionError] = useState<ConnectionTestResult | undefined>();

  // Handle OAuth completion
  const handleOAuthComplete = useCallback(async (tokens: Record<string, any>) => {
    console.log('OAuth completed with tokens:', tokens);
    // In production, save tokens to backend
  }, []);

  // Handle token refresh
  const handleTokenRefresh = useCallback(async (platform: Platform): Promise<boolean> => {
    console.log('Refreshing token for platform:', platform);
    // In production, call refresh endpoint
    return new Promise((resolve) => {
      setTimeout(() => resolve(true), 2000);
    });
  }, []);

  // Handle connection test
  const handleConnectionTest = useCallback(async (): Promise<ConnectionTestResult> => {
    // Simulate connection test
    const success = Math.random() > 0.3;
    const result: ConnectionTestResult = {
      success,
      message: success ? 'Connection successful' : 'Connection failed - Authentication error',
      details: {
        apiReachable: Math.random() > 0.2,
        authValid: success,
        rateLimitOk: Math.random() > 0.1,
        errorCount: success ? 0 : Math.floor(Math.random() * 5),
        responseTime: Math.floor(Math.random() * 500),
      },
    };

    if (!success) {
      setLastConnectionError(result);
    }

    return result;
  }, []);

  // Component styles
  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    backgroundColor: colors.background,
    padding: theme.spacing?.container?.xl || '32px',
  };

  const headerStyle: React.CSSProperties = {
    marginBottom: '32px',
    paddingBottom: '24px',
    borderBottom: `1px solid ${colors.outlineVariant}`,
  };

  const navStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    marginBottom: '32px',
    padding: '8px',
    backgroundColor: colors.surface,
    borderRadius: '12px',
    border: `1px solid ${colors.outlineVariant}`,
  };

  const contentStyle: React.CSSProperties = {
    maxWidth: '1400px',
    margin: '0 auto',
  };

  const demos = [
    {
      id: 'oauth',
      label: 'OAuth Wizard',
      icon: <SparklesIcon />,
      description: 'Enhanced OAuth flow with PKCE',
    },
    {
      id: 'health',
      label: 'Token Health',
      icon: <BeakerIcon />,
      description: 'Real-time token monitoring',
    },
    {
      id: 'testing',
      label: 'Live Testing',
      icon: <Cog6ToothIcon />,
      description: 'Connection health monitoring',
    },
    {
      id: 'recovery',
      label: 'Recovery',
      icon: <ChartBarIcon />,
      description: 'Connection troubleshooting',
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <ChartBarIcon />,
      description: 'System health overview',
    },
  ];

  return (
    <div style={pageStyle}>
      <div style={contentStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <h1
            style={{
              ...theme.typography?.displaySmall,
              color: colors.onBackground,
              margin: 0,
              marginBottom: '8px',
            }}
          >
            Advanced Configuration Features
          </h1>
          <p
            style={{
              ...theme.typography?.bodyLarge,
              color: colors.onSurfaceVariant,
              margin: 0,
            }}
          >
            Enhanced OAuth wizard functionality and real-time connection testing
          </p>
        </div>

        {/* Navigation */}
        <div style={navStyle}>
          {demos.map((demo) => (
            <button
              key={demo.id}
              onClick={() => setActiveDemo(demo.id)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                padding: '16px',
                backgroundColor: activeDemo === demo.id ? colors.primaryContainer : 'transparent',
                color: activeDemo === demo.id ? colors.onPrimaryContainer : colors.onSurface,
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: `all ${theme.motion?.duration?.short2 || '150ms'} ${theme.motion?.easing?.standard || 'ease'}`,
              }}
            >
              <div style={{ width: '24px', height: '24px' }}>
                {React.cloneElement(demo.icon, { style: { width: '24px', height: '24px' } })}
              </div>
              <div
                style={{
                  ...theme.typography?.labelLarge,
                  fontWeight: 600,
                }}
              >
                {demo.label}
              </div>
              <div
                style={{
                  ...theme.typography?.bodySmall,
                  opacity: 0.8,
                }}
              >
                {demo.description}
              </div>
            </button>
          ))}
        </div>

        {/* Demo Content */}
        <div style={{ marginTop: '32px' }}>
          {activeDemo === 'oauth' && (
            <div>
              <h2
                style={{
                  ...theme.typography?.headlineMedium,
                  color: colors.onBackground,
                  marginBottom: '24px',
                }}
              >
                QuickBooks OAuth Wizard with PKCE
              </h2>
              <p
                style={{
                  ...theme.typography?.bodyLarge,
                  color: colors.onSurfaceVariant,
                  marginBottom: '32px',
                }}
              >
                Step-by-step OAuth authorization with enhanced security, state validation, and automatic token refresh.
              </p>
              <QuickBooksOAuthWizard
                onComplete={handleOAuthComplete}
                environment="sandbox"
              />
            </div>
          )}

          {activeDemo === 'health' && (
            <div>
              <h2
                style={{
                  ...theme.typography?.headlineMedium,
                  color: colors.onBackground,
                  marginBottom: '24px',
                }}
              >
                Token Health Monitor
              </h2>
              <p
                style={{
                  ...theme.typography?.bodyLarge,
                  color: colors.onSurfaceVariant,
                  marginBottom: '32px',
                }}
              >
                Real-time monitoring of OAuth token health with automatic refresh detection and expiration warnings.
              </p>
              <TokenHealthMonitor
                tokens={mockTokens}
                checkInterval={30}
                onRefreshRequired={handleTokenRefresh}
                autoRefresh={true}
              />
            </div>
          )}

          {activeDemo === 'testing' && (
            <div>
              <h2
                style={{
                  ...theme.typography?.headlineMedium,
                  color: colors.onBackground,
                  marginBottom: '24px',
                }}
              >
                Live Connection Tester
              </h2>
              <p
                style={{
                  ...theme.typography?.bodyLarge,
                  color: colors.onSurfaceVariant,
                  marginBottom: '32px',
                }}
              >
                Real-time connection monitoring with automatic health checks and detailed metrics.
              </p>
              <LiveConnectionTester
                platforms={mockPlatformConfigs}
                interval={30}
                autoStart={true}
                showHistory={true}
                showMetrics={true}
              />
            </div>
          )}

          {activeDemo === 'recovery' && (
            <div>
              <h2
                style={{
                  ...theme.typography?.headlineMedium,
                  color: colors.onBackground,
                  marginBottom: '24px',
                }}
              >
                Connection Recovery Assistant
              </h2>
              <p
                style={{
                  ...theme.typography?.bodyLarge,
                  color: colors.onSurfaceVariant,
                  marginBottom: '32px',
                }}
              >
                Guided troubleshooting and recovery for failed connections with context-aware solutions.
              </p>
              <ConnectionRecovery
                platform="QUICKBOOKS"
                lastError={lastConnectionError || {
                  success: false,
                  message: 'Authentication failed - Invalid or expired token',
                  details: {
                    apiReachable: true,
                    authValid: false,
                    rateLimitOk: true,
                    errorCount: 3,
                    responseTime: 250,
                  },
                }}
                onRetry={handleConnectionTest}
                onReconfigure={() => console.log('Reconfigure clicked')}
                showDiagnostics={true}
              />
            </div>
          )}

          {activeDemo === 'dashboard' && (
            <div>
              <h2
                style={{
                  ...theme.typography?.headlineMedium,
                  color: colors.onBackground,
                  marginBottom: '24px',
                }}
              >
                System Health Dashboard
              </h2>
              <p
                style={{
                  ...theme.typography?.bodyLarge,
                  color: colors.onSurfaceVariant,
                  marginBottom: '32px',
                }}
              >
                Comprehensive overview of all platform connections with real-time health metrics and trends.
              </p>
              <HealthDashboard
                platforms={['QUICKBOOKS', 'HUBSPOT', 'STRIPE'] as Platform[]}
                refreshInterval={60}
                showMetrics={true}
                showTrends={true}
                onPlatformClick={(platform) => console.log('Platform clicked:', platform)}
              />
            </div>
          )}
        </div>

        {/* Features Summary */}
        <div
          style={{
            marginTop: '64px',
            padding: '32px',
            backgroundColor: colors.surfaceVariant,
            borderRadius: '16px',
          }}
        >
          <h3
            style={{
              ...theme.typography?.headlineSmall,
              color: colors.onSurfaceVariant,
              marginBottom: '24px',
            }}
          >
            Key Features Implemented
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '16px',
            }}
          >
            <FeatureCard
              title="Enhanced OAuth Flow"
              description="PKCE security, state validation, automatic token refresh"
              color={colors.primary}
            />
            <FeatureCard
              title="Real-time Monitoring"
              description="Live connection status, health checks, performance metrics"
              color="#10b981"
            />
            <FeatureCard
              title="Smart Recovery"
              description="Context-aware troubleshooting, guided solutions, retry logic"
              color={colors.tertiary}
            />
            <FeatureCard
              title="Comprehensive Dashboard"
              description="System-wide health overview, trend analysis, incident tracking"
              color={colors.secondary}
            />
            <FeatureCard
              title="Security First"
              description="CSRF protection, secure state management, token encryption"
              color={colors.error}
            />
            <FeatureCard
              title="User Experience"
              description="Step-by-step wizards, visual feedback, accessibility support"
              color={colors.warning}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper component for feature cards
function FeatureCard({ title, description, color }: any) {
  const { theme } = useTheme();
  const colors = theme.colors;

  return (
    <div
      style={{
        padding: '20px',
        backgroundColor: colors.surface,
        borderRadius: '12px',
        borderLeft: `4px solid ${color}`,
      }}
    >
      <h4
        style={{
          ...theme.typography?.labelLarge,
          color: colors.onSurface,
          marginBottom: '8px',
        }}
      >
        {title}
      </h4>
      <p
        style={{
          ...theme.typography?.bodyMedium,
          color: colors.onSurfaceVariant,
          margin: 0,
        }}
      >
        {description}
      </p>
    </div>
  );
}