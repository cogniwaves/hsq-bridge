/**
 * Configuration Components Demo Page
 * Showcases all Material Design 3 configuration components
 * for the HubSpot-Stripe-QuickBooks bridge system
 */

'use client';

import React, { useState } from 'react';
import { useTheme } from '../../design-system/themes/themeProvider';
import {
  ConfigurationCard,
  ConnectionTester,
  APIKeyInput,
  HubSpotConfigForm,
  ConfigurationWizard,
} from '../../components/configuration';
import {
  Platform,
  ConnectionStatus,
  ConnectionTestResult,
  HubSpotConfig,
  WizardStep,
} from '../../components/configuration/types';

export default function ConfigurationDemoPage() {
  const { theme, resolvedMode } = useTheme();
  const [activeDemo, setActiveDemo] = useState<string>('cards');
  const [apiKeyValue, setApiKeyValue] = useState('');

  const colors = theme.colors;

  // Demo data
  const platformStatuses: Record<Platform, ConnectionStatus> = {
    HUBSPOT: {
      platform: 'HUBSPOT',
      configured: true,
      connected: true,
      healthy: true,
      lastCheck: new Date(Date.now() - 300000), // 5 minutes ago
      message: 'All systems operational',
      details: {
        portalId: '12345678',
        apiCalls: 847,
        rateLimit: '95/100',
      },
    },
    STRIPE: {
      platform: 'STRIPE',
      configured: true,
      connected: false,
      healthy: false,
      lastCheck: new Date(Date.now() - 600000), // 10 minutes ago
      message: 'Connection timeout - please check your API keys',
    },
    QUICKBOOKS: {
      platform: 'QUICKBOOKS',
      configured: false,
      connected: false,
      healthy: false,
      message: 'OAuth configuration required',
    },
  };

  // Demo handlers
  const handleCardConfigure = (platform: Platform) => {
    console.log(`Configure ${platform}`);
  };

  const handleCardTest = (platform: Platform) => {
    console.log(`Test ${platform} connection`);
  };

  const handleConnectionTest = async (config: Record<string, any>): Promise<ConnectionTestResult> => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      success: Math.random() > 0.3, // 70% success rate for demo
      message: Math.random() > 0.3 ? 'Connection successful' : 'Invalid API key',
      details: {
        apiReachable: true,
        authValid: Math.random() > 0.3,
        responseTime: Math.floor(Math.random() * 500) + 100,
      },
    };
  };

  const handleHubSpotSubmit = async (config: HubSpotConfig) => {
    console.log('HubSpot config submitted:', config);
    // Simulate save
    await new Promise(resolve => setTimeout(resolve, 1500));
    alert('HubSpot configuration saved successfully!');
  };

  // Wizard demo
  const wizardSteps: WizardStep[] = [
    {
      id: 'api-key',
      title: 'API Configuration',
      description: 'Enter your HubSpot API key',
      component: ({ data, onChange }) => (
        <APIKeyInput
          value={data.apiKey || ''}
          onChange={(value) => onChange({ apiKey: value })}
          platform="HUBSPOT"
          label="HubSpot API Key"
          required
          showStrength
        />
      ),
      isValid: (data) => !!data.apiKey && data.apiKey.length > 10,
    },
    {
      id: 'features',
      title: 'Feature Selection',
      description: 'Choose which features to enable',
      component: ({ data, onChange }) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {['Invoice Sync', 'Contact Sync', 'Webhook Events'].map(feature => (
            <label key={feature} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="checkbox"
                checked={data.features?.[feature] || false}
                onChange={(e) => onChange({
                  features: {
                    ...data.features,
                    [feature]: e.target.checked,
                  },
                })}
              />
              <span>{feature}</span>
            </label>
          ))}
        </div>
      ),
    },
    {
      id: 'review',
      title: 'Review & Test',
      description: 'Review your configuration and test the connection',
      component: ({ data }) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <strong>API Key:</strong> {data.apiKey ? '••••••••' : 'Not provided'}
          </div>
          <div>
            <strong>Features:</strong> {
              data.features ? Object.keys(data.features).filter(k => data.features[k]).join(', ') : 'None'
            }
          </div>
        </div>
      ),
    },
  ];

  const handleWizardComplete = async (data: Record<string, any>) => {
    console.log('Wizard completed:', data);
    await new Promise(resolve => setTimeout(resolve, 1500));
    alert('Configuration wizard completed!');
  };

  // Page styles
  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    backgroundColor: colors.background,
    padding: theme.spacing?.container?.lg || '32px',
  };

  const containerStyle: React.CSSProperties = {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing?.component?.xl || '32px',
  };

  const headerStyle: React.CSSProperties = {
    textAlign: 'center',
    marginBottom: theme.spacing?.component?.xl || '32px',
  };

  const titleStyle: React.CSSProperties = {
    ...theme.typography?.displayMedium,
    color: colors.onBackground,
    margin: 0,
    marginBottom: '16px',
    fontWeight: 600,
  };

  const subtitleStyle: React.CSSProperties = {
    ...theme.typography?.headlineSmall,
    color: colors.onSurfaceVariant,
    margin: 0,
    opacity: 0.8,
  };

  const navStyle: React.CSSProperties = {
    display: 'flex',
    gap: theme.spacing?.component?.md || '16px',
    marginBottom: theme.spacing?.component?.xl || '32px',
    flexWrap: 'wrap',
    justifyContent: 'center',
  };

  const navButtonStyle = (active: boolean): React.CSSProperties => ({
    padding: '12px 24px',
    backgroundColor: active ? colors.primary : 'transparent',
    color: active ? colors.onPrimary : colors.primary,
    border: `1px solid ${colors.primary}`,
    borderRadius: '8px',
    cursor: 'pointer',
    ...theme.typography?.labelLarge,
    fontWeight: 600,
    transition: `all ${theme.motion?.duration?.short2 || '150ms'} ease`,
    ':hover': {
      backgroundColor: active ? colors.primary : colors.primaryContainer,
    },
  });

  const sectionStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing?.component?.lg || '24px',
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: theme.spacing?.component?.lg || '24px',
  };

  // Render active demo
  const renderDemo = () => {
    switch (activeDemo) {
      case 'cards':
        return (
          <div style={gridStyle}>
            {Object.entries(platformStatuses).map(([platform, status]) => (
              <ConfigurationCard
                key={platform}
                platform={platform as Platform}
                title={platform === 'HUBSPOT' ? 'HubSpot CRM' : platform === 'STRIPE' ? 'Stripe Payments' : 'QuickBooks'}
                description={
                  platform === 'HUBSPOT' ? 'Customer relationship management' :
                  platform === 'STRIPE' ? 'Payment processing platform' : 'Accounting software'
                }
                status={status}
                onConfigure={() => handleCardConfigure(platform as Platform)}
                onTest={() => handleCardTest(platform as Platform)}
                showActions
              />
            ))}
          </div>
        );

      case 'api-input':
        return (
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <APIKeyInput
              value={apiKeyValue}
              onChange={setApiKeyValue}
              platform="HUBSPOT"
              label="HubSpot API Key"
              description="Enter your HubSpot private app token"
              required
              showStrength
              validateOnChange
            />
          </div>
        );

      case 'connection-test':
        return (
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <ConnectionTester
              platform="HUBSPOT"
              configuration={{ apiKey: 'pat-na1-demo-key-12345' }}
              onTest={handleConnectionTest}
              showHistory
            />
          </div>
        );

      case 'form':
        return (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <HubSpotConfigForm
              onSubmit={handleHubSpotSubmit}
              onCancel={() => console.log('Cancelled')}
              onTest={handleConnectionTest}
            />
          </div>
        );

      case 'wizard':
        return (
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <ConfigurationWizard
              platform="HUBSPOT"
              steps={wizardSteps}
              onComplete={handleWizardComplete}
              onCancel={() => console.log('Wizard cancelled')}
              showProgress
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <h1 style={titleStyle}>Configuration Components Demo</h1>
          <p style={subtitleStyle}>
            Material Design 3 configuration components for the HubSpot-Stripe-QuickBooks bridge
          </p>
        </div>

        {/* Navigation */}
        <div style={navStyle}>
          {[
            { key: 'cards', label: 'Configuration Cards' },
            { key: 'api-input', label: 'API Key Input' },
            { key: 'connection-test', label: 'Connection Tester' },
            { key: 'form', label: 'HubSpot Form' },
            { key: 'wizard', label: 'Configuration Wizard' },
          ].map(item => (
            <button
              key={item.key}
              onClick={() => setActiveDemo(item.key)}
              style={navButtonStyle(activeDemo === item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Demo Content */}
        <div style={sectionStyle}>
          {renderDemo()}
        </div>
      </div>

      {/* Global styles for hover effects */}
      <style jsx>{`
        button:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
      `}</style>
    </div>
  );
}