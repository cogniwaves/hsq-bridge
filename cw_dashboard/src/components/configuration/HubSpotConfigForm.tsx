/**
 * HubSpot Configuration Form Component
 * Specialized form for HubSpot API key configuration with portal ID detection
 * Material Design 3 styling with platform-specific validation and testing
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../design-system/themes/themeProvider';
import { HubSpotConfigFormProps, HubSpotConfig, ValidationError } from './types';
import { validateAPIKey, configAPI, debounce } from './utils';
import ConfigurationForm, { FormField } from './ConfigurationForm';
import APIKeyInput from './APIKeyInput';
import ConnectionTester from './ConnectionTester';
import {
  BuildingOfficeIcon,
  GlobeAltIcon,
  ClockIcon,
  Cog6ToothIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

export function HubSpotConfigForm({
  initialConfig,
  onSubmit,
  onCancel,
  onTest,
  isLoading = false,
  className = '',
}: HubSpotConfigFormProps) {
  const { theme, resolvedMode } = useTheme();
  const [formData, setFormData] = useState<Partial<HubSpotConfig>>({
    platform: 'HUBSPOT',
    environment: 'production',
    syncEnabled: true,
    syncInterval: 300000, // 5 minutes
    rateLimitPerMinute: 100,
    features: {
      invoiceSync: true,
      contactSync: true,
      companySync: true,
      webhooks: true,
    },
    ...initialConfig,
  });

  const [portalInfo, setPortalInfo] = useState<{
    id: string;
    name: string;
    domain: string;
    timeZone: string;
  } | null>(null);
  
  const [isDetectingPortal, setIsDetectingPortal] = useState(false);
  const [detectionError, setDetectionError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const colors = theme.colors;

  // Debounced portal detection
  const debouncedPortalDetection = useCallback(
    debounce(async (apiKey: string) => {
      if (!apiKey || !validateAPIKey('HUBSPOT', apiKey).isValid) {
        setPortalInfo(null);
        setDetectionError(null);
        return;
      }

      setIsDetectingPortal(true);
      setDetectionError(null);

      try {
        // Test the API key and get portal information
        const response = await configAPI.post('/test-hubspot', { apiKey });
        
        if (response.success && response.details) {
          setPortalInfo({
            id: response.details.portalId || 'Unknown',
            name: response.details.accountName || 'Unknown Portal',
            domain: response.details.domain || 'Unknown',
            timeZone: response.details.timeZone || 'Unknown',
          });

          // Auto-fill portal ID if detected
          if (response.details.portalId) {
            setFormData(prev => ({
              ...prev,
              portalId: response.details.portalId,
            }));
          }
        }
      } catch (error) {
        setDetectionError(error instanceof Error ? error.message : 'Failed to detect portal information');
        setPortalInfo(null);
      } finally {
        setIsDetectingPortal(false);
      }
    }, 500),
    []
  );

  // Effect to trigger portal detection when API key changes
  useEffect(() => {
    if (formData.apiKey) {
      debouncedPortalDetection(formData.apiKey);
    } else {
      setPortalInfo(null);
      setDetectionError(null);
    }
  }, [formData.apiKey, debouncedPortalDetection]);

  // Form data handlers
  const handleFieldChange = useCallback((name: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  const handleFeatureToggle = useCallback((featureName: string, enabled: boolean) => {
    setFormData(prev => ({
      ...prev,
      features: {
        ...prev.features,
        [featureName]: enabled,
      },
    }));
  }, []);

  // Form validation
  const validateForm = useCallback(async (data: Record<string, any>) => {
    const errors: ValidationError[] = [];

    // API Key validation
    if (!data.apiKey) {
      errors.push({
        field: 'apiKey',
        message: 'HubSpot API key is required',
      });
    } else {
      const apiKeyValidation = validateAPIKey('HUBSPOT', data.apiKey);
      if (!apiKeyValidation.isValid) {
        errors.push({
          field: 'apiKey',
          message: apiKeyValidation.errors[0] || 'Invalid HubSpot API key format',
        });
      }
    }

    // Sync interval validation
    if (data.syncEnabled && data.syncInterval) {
      if (data.syncInterval < 60000) {
        errors.push({
          field: 'syncInterval',
          message: 'Sync interval must be at least 1 minute (60000ms)',
        });
      }
    }

    // Rate limit validation
    if (data.rateLimitPerMinute && (data.rateLimitPerMinute < 1 || data.rateLimitPerMinute > 200)) {
      errors.push({
        field: 'rateLimitPerMinute',
        message: 'Rate limit must be between 1 and 200 requests per minute',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }, []);

  // Test connection handler
  const handleTestConnection = useCallback(async (config: Record<string, any>) => {
    if (!config.apiKey) {
      return {
        success: false,
        message: 'API key is required for testing',
      };
    }

    try {
      const response = await configAPI.post('/test-hubspot', {
        apiKey: config.apiKey,
      });

      return {
        success: response.success,
        message: response.message || (response.success ? 'Connection successful' : 'Connection failed'),
        details: response.details,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }, []);

  // Form submission handler
  const handleSubmit = async (data: Record<string, any>) => {
    const hubspotConfig: HubSpotConfig = {
      ...data as HubSpotConfig,
      platform: 'HUBSPOT',
    };

    await onSubmit(hubspotConfig);
  };

  // Portal information component
  const PortalInformation = () => {
    if (!formData.apiKey) return null;

    return (
      <div
        style={{
          padding: theme.spacing?.component?.lg || '20px',
          backgroundColor: colors.surfaceContainer,
          borderRadius: '8px',
          border: `1px solid ${colors.outlineVariant}`,
        }}
      >
        <h4
          style={{
            ...theme.typography?.headlineSmall,
            color: colors.onSurface,
            margin: 0,
            marginBottom: theme.spacing?.component?.md || '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <BuildingOfficeIcon style={{ width: '20px', height: '20px' }} />
          Portal Information
        </h4>

        {isDetectingPortal && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing?.component?.sm || '12px',
              ...theme.typography?.bodyMedium,
              color: colors.onSurfaceVariant,
            }}
          >
            <div
              style={{
                width: '16px',
                height: '16px',
                border: `2px solid ${colors.outlineVariant}`,
                borderTop: `2px solid ${colors.primary}`,
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
            Detecting portal information...
          </div>
        )}

        {detectionError && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing?.component?.sm || '8px',
              padding: '12px',
              backgroundColor: colors.errorContainer,
              border: `1px solid ${colors.error}`,
              borderRadius: '6px',
              ...theme.typography?.bodySmall,
              color: colors.error,
            }}
          >
            <ExclamationTriangleIcon style={{ width: '16px', height: '16px' }} />
            {detectionError}
          </div>
        )}

        {portalInfo && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: theme.spacing?.component?.md || '16px',
            }}
          >
            <div>
              <span
                style={{
                  ...theme.typography?.labelMedium,
                  color: colors.onSurfaceVariant,
                  display: 'block',
                  marginBottom: '4px',
                }}
              >
                Portal ID
              </span>
              <span
                style={{
                  ...theme.typography?.bodyMedium,
                  color: colors.onSurface,
                  fontWeight: 500,
                }}
              >
                {portalInfo.id}
              </span>
            </div>

            <div>
              <span
                style={{
                  ...theme.typography?.labelMedium,
                  color: colors.onSurfaceVariant,
                  display: 'block',
                  marginBottom: '4px',
                }}
              >
                Portal Name
              </span>
              <span
                style={{
                  ...theme.typography?.bodyMedium,
                  color: colors.onSurface,
                  fontWeight: 500,
                }}
              >
                {portalInfo.name}
              </span>
            </div>

            <div>
              <span
                style={{
                  ...theme.typography?.labelMedium,
                  color: colors.onSurfaceVariant,
                  display: 'block',
                  marginBottom: '4px',
                }}
              >
                Domain
              </span>
              <span
                style={{
                  ...theme.typography?.bodyMedium,
                  color: colors.onSurface,
                  fontWeight: 500,
                }}
              >
                {portalInfo.domain}
              </span>
            </div>

            <div>
              <span
                style={{
                  ...theme.typography?.labelMedium,
                  color: colors.onSurfaceVariant,
                  display: 'block',
                  marginBottom: '4px',
                }}
              >
                Time Zone
              </span>
              <span
                style={{
                  ...theme.typography?.bodyMedium,
                  color: colors.onSurface,
                  fontWeight: 500,
                }}
              >
                {portalInfo.timeZone}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Feature configuration component
  const FeatureConfiguration = () => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing?.component?.md || '16px',
      }}
    >
      <h4
        style={{
          ...theme.typography?.headlineSmall,
          color: colors.onSurface,
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <Cog6ToothIcon style={{ width: '20px', height: '20px' }} />
        Feature Configuration
      </h4>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: theme.spacing?.component?.md || '16px',
        }}
      >
        {[
          { key: 'invoiceSync', label: 'Invoice Synchronization', description: 'Sync invoice data between HubSpot and other platforms' },
          { key: 'contactSync', label: 'Contact Synchronization', description: 'Sync contact information across platforms' },
          { key: 'companySync', label: 'Company Synchronization', description: 'Sync company data across platforms' },
          { key: 'webhooks', label: 'Real-time Webhooks', description: 'Enable real-time data updates via webhooks' },
        ].map(feature => (
          <div
            key={feature.key}
            style={{
              padding: theme.spacing?.component?.md || '16px',
              backgroundColor: colors.surfaceVariant,
              borderRadius: '8px',
              border: `1px solid ${colors.outlineVariant}`,
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: theme.spacing?.component?.sm || '12px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={formData.features?.[feature.key] ?? false}
                onChange={(e) => handleFeatureToggle(feature.key, e.target.checked)}
                style={{
                  width: '18px',
                  height: '18px',
                  accentColor: colors.primary,
                  marginTop: '2px',
                }}
              />
              <div>
                <span
                  style={{
                    ...theme.typography?.labelLarge,
                    color: colors.onSurface,
                    fontWeight: 600,
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  {feature.label}
                </span>
                <span
                  style={{
                    ...theme.typography?.bodySmall,
                    color: colors.onSurfaceVariant,
                    opacity: 0.8,
                  }}
                >
                  {feature.description}
                </span>
              </div>
            </label>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <ConfigurationForm
      platform="HUBSPOT"
      initialValues={formData}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      onValidate={validateForm}
      isLoading={isLoading}
      showAdvanced={true}
      className={className}
    >
      {/* API Key Input */}
      <APIKeyInput
        value={formData.apiKey || ''}
        onChange={(value) => handleFieldChange('apiKey', value)}
        platform="HUBSPOT"
        label="HubSpot API Key"
        description="Private app token from your HubSpot developer settings"
        required
        showStrength
        validateOnChange
      />

      {/* Portal Information */}
      <PortalInformation />

      {/* Basic Configuration */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: theme.spacing?.component?.md || '16px',
        }}
      >
        <FormField
          name="portalId"
          label="Portal ID"
          type="text"
          placeholder="Auto-detected from API key"
          description="Your HubSpot portal ID (auto-detected)"
          value={formData.portalId || ''}
          onChange={(value) => handleFieldChange('portalId', value)}
          disabled={!!portalInfo?.id}
        />

        <FormField
          name="environment"
          label="Environment"
          type="select"
          options={[
            { value: 'production', label: 'Production' },
            { value: 'sandbox', label: 'Sandbox' },
          ]}
          value={formData.environment || 'production'}
          onChange={(value) => handleFieldChange('environment', value)}
        />
      </div>

      {/* Sync Configuration */}
      <div>
        <h4
          style={{
            ...theme.typography?.headlineSmall,
            color: colors.onSurface,
            margin: 0,
            marginBottom: theme.spacing?.component?.md || '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <ClockIcon style={{ width: '20px', height: '20px' }} />
          Synchronization Settings
        </h4>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: theme.spacing?.component?.md || '16px',
          }}
        >
          <FormField
            name="syncEnabled"
            label="Enable Automatic Sync"
            type="checkbox"
            value={formData.syncEnabled}
            onChange={(value) => handleFieldChange('syncEnabled', value)}
          />

          {formData.syncEnabled && (
            <>
              <FormField
                name="syncInterval"
                label="Sync Interval (ms)"
                type="text"
                placeholder="300000"
                description="Minimum 60000ms (1 minute)"
                value={formData.syncInterval?.toString() || ''}
                onChange={(value) => handleFieldChange('syncInterval', parseInt(value) || 300000)}
                validation={{
                  pattern: /^\d+$/,
                  custom: (value) => {
                    const num = parseInt(value);
                    if (num < 60000) return 'Minimum sync interval is 1 minute (60000ms)';
                    return null;
                  },
                }}
              />

              <FormField
                name="rateLimitPerMinute"
                label="Rate Limit (requests/min)"
                type="text"
                placeholder="100"
                description="Max API requests per minute (1-200)"
                value={formData.rateLimitPerMinute?.toString() || ''}
                onChange={(value) => handleFieldChange('rateLimitPerMinute', parseInt(value) || 100)}
                validation={{
                  pattern: /^\d+$/,
                  custom: (value) => {
                    const num = parseInt(value);
                    if (num < 1 || num > 200) return 'Rate limit must be between 1 and 200';
                    return null;
                  },
                }}
              />
            </>
          )}
        </div>
      </div>

      {/* Feature Configuration */}
      <FeatureConfiguration />

      {/* Connection Testing */}
      {formData.apiKey && (
        <ConnectionTester
          platform="HUBSPOT"
          configuration={formData}
          onTest={handleTestConnection}
          autoTest={false}
          showHistory
        />
      )}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </ConfigurationForm>
  );
}

export default HubSpotConfigForm;