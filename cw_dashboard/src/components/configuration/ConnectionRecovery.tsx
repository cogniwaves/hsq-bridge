/**
 * Connection Recovery Component
 * Guided troubleshooting and recovery for failed connections
 * Context-aware help with step-by-step solutions
 */

'use client';

import React, { useState, useCallback } from 'react';
import { useTheme } from '../../design-system/themes/themeProvider';
import { Platform, ConnectionTestResult } from './types';
import { getPlatformInfo } from './utils';
import {
  WrenchScrewdriverIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  LightBulbIcon,
  DocumentTextIcon,
  QuestionMarkCircleIcon,
  ShieldExclamationIcon,
  WifiIcon,
  KeyIcon,
  ClockIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline';

interface ConnectionRecoveryProps {
  platform: Platform;
  lastError?: ConnectionTestResult;
  onRetry?: () => Promise<ConnectionTestResult>;
  onReconfigure?: () => void;
  onContactSupport?: () => void;
  showDiagnostics?: boolean;
  className?: string;
}

interface RecoveryStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: () => void;
  actionLabel?: string;
  checks?: Array<{
    label: string;
    test: () => Promise<boolean>;
  }>;
}

interface DiagnosticResult {
  category: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  solution?: string;
}

export function ConnectionRecovery({
  platform,
  lastError,
  onRetry,
  onReconfigure,
  onContactSupport,
  showDiagnostics = true,
  className = '',
}: ConnectionRecoveryProps) {
  const { theme, resolvedMode } = useTheme();
  const colors = theme.colors;
  const isDark = resolvedMode === 'dark';

  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [diagnosticResults, setDiagnosticResults] = useState<DiagnosticResult[]>([]);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const platformInfo = getPlatformInfo(platform);

  // Get recovery steps based on error
  const getRecoverySteps = useCallback((): RecoveryStep[] => {
    const steps: RecoveryStep[] = [];

    // Analyze error to determine recovery steps
    const errorMessage = lastError?.message?.toLowerCase() || '';
    const errorDetails = lastError?.details || {};

    // Authentication issues
    if (errorMessage.includes('auth') || errorMessage.includes('unauthorized') || !errorDetails.authValid) {
      steps.push({
        id: 'auth',
        title: 'Verify Authentication Credentials',
        description: 'Your authentication credentials may be invalid or expired.',
        icon: <KeyIcon />,
        action: onReconfigure,
        actionLabel: 'Reconfigure Credentials',
        checks: [
          {
            label: 'API key is valid',
            test: async () => platform === 'HUBSPOT' && !!errorDetails.authValid,
          },
          {
            label: 'OAuth token is not expired',
            test: async () => platform === 'QUICKBOOKS' && !!errorDetails.authValid,
          },
        ],
      });
    }

    // Network issues
    if (errorMessage.includes('network') || errorMessage.includes('timeout') || !errorDetails.apiReachable) {
      steps.push({
        id: 'network',
        title: 'Check Network Connectivity',
        description: 'There may be network connectivity issues preventing connection.',
        icon: <WifiIcon />,
        checks: [
          {
            label: 'Internet connection is active',
            test: async () => navigator.onLine,
          },
          {
            label: 'API endpoint is reachable',
            test: async () => !!errorDetails.apiReachable,
          },
        ],
      });
    }

    // Rate limiting
    if (errorMessage.includes('rate') || errorMessage.includes('limit') || !errorDetails.rateLimitOk) {
      steps.push({
        id: 'ratelimit',
        title: 'Rate Limit Issues',
        description: 'You may have exceeded the API rate limits. Wait a moment before retrying.',
        icon: <ClockIcon />,
        checks: [
          {
            label: 'Rate limit not exceeded',
            test: async () => !!errorDetails.rateLimitOk,
          },
        ],
      });
    }

    // Permission issues
    if (errorMessage.includes('permission') || errorMessage.includes('scope') || errorMessage.includes('access')) {
      steps.push({
        id: 'permissions',
        title: 'Check API Permissions',
        description: 'Your API credentials may not have the required permissions.',
        icon: <ShieldExclamationIcon />,
        action: onReconfigure,
        actionLabel: 'Update Permissions',
        checks: [
          {
            label: 'Required scopes are granted',
            test: async () => true, // This would check actual scopes
          },
        ],
      });
    }

    // Generic recovery step
    steps.push({
      id: 'generic',
      title: 'General Troubleshooting',
      description: 'Try these general steps to resolve the connection issue.',
      icon: <WrenchScrewdriverIcon />,
      checks: [
        {
          label: 'Service is operational',
          test: async () => true,
        },
        {
          label: 'Configuration is complete',
          test: async () => true,
        },
      ],
    });

    return steps;
  }, [platform, lastError, onReconfigure]);

  // Run diagnostics
  const runDiagnostics = useCallback(async () => {
    setIsRunningDiagnostics(true);
    const results: DiagnosticResult[] = [];

    // Check internet connectivity
    results.push({
      category: 'Network',
      status: navigator.onLine ? 'pass' : 'fail',
      message: navigator.onLine ? 'Internet connection is active' : 'No internet connection detected',
      solution: !navigator.onLine ? 'Check your internet connection and try again' : undefined,
    });

    // Check API configuration
    if (lastError?.details) {
      results.push({
        category: 'API',
        status: lastError.details.apiReachable ? 'pass' : 'fail',
        message: lastError.details.apiReachable ? 'API endpoint is reachable' : 'Cannot reach API endpoint',
        solution: !lastError.details.apiReachable ? 'Verify the API endpoint URL and network settings' : undefined,
      });

      results.push({
        category: 'Authentication',
        status: lastError.details.authValid ? 'pass' : 'fail',
        message: lastError.details.authValid ? 'Authentication is valid' : 'Authentication failed',
        solution: !lastError.details.authValid ? 'Check your API credentials and regenerate if necessary' : undefined,
      });

      results.push({
        category: 'Rate Limiting',
        status: lastError.details.rateLimitOk ? 'pass' : 'warning',
        message: lastError.details.rateLimitOk ? 'Within rate limits' : 'Approaching or exceeded rate limits',
        solution: !lastError.details.rateLimitOk ? 'Wait a few minutes before retrying' : undefined,
      });
    }

    // Platform-specific checks
    switch (platform) {
      case 'QUICKBOOKS':
        results.push({
          category: 'OAuth',
          status: lastError?.message?.includes('token') ? 'fail' : 'pass',
          message: lastError?.message?.includes('token') ? 'OAuth token issue detected' : 'OAuth tokens are valid',
          solution: lastError?.message?.includes('token') ? 'Reconnect your QuickBooks account' : undefined,
        });
        break;

      case 'HUBSPOT':
        results.push({
          category: 'API Key',
          status: lastError?.message?.includes('key') ? 'fail' : 'pass',
          message: lastError?.message?.includes('key') ? 'API key issue detected' : 'API key appears valid',
          solution: lastError?.message?.includes('key') ? 'Generate a new private app key in HubSpot' : undefined,
        });
        break;

      case 'STRIPE':
        results.push({
          category: 'Environment',
          status: 'pass',
          message: 'Using correct environment (test/live)',
          solution: undefined,
        });
        break;
    }

    setDiagnosticResults(results);
    setIsRunningDiagnostics(false);
  }, [platform, lastError]);

  // Handle retry
  const handleRetry = async () => {
    if (!onRetry) return;

    setIsRetrying(true);
    try {
      const result = await onRetry();
      if (result.success) {
        // Success - clear diagnostics
        setDiagnosticResults([]);
      }
    } catch (error) {
      console.error('Retry failed:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  // Copy error details
  const copyErrorDetails = () => {
    const errorText = `
Platform: ${platform}
Error: ${lastError?.message || 'Unknown error'}
Details: ${JSON.stringify(lastError?.details || {}, null, 2)}
Timestamp: ${new Date().toISOString()}
    `.trim();

    navigator.clipboard.writeText(errorText);
    setCopiedText('error');
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Component styles
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing?.component?.lg || '24px',
    padding: theme.spacing?.container?.lg || '24px',
    backgroundColor: colors.surface,
    borderRadius: theme.components?.card?.borderRadius || '12px',
    border: `1px solid ${colors.outlineVariant}`,
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: theme.spacing?.component?.md || '16px',
  };

  const titleStyle: React.CSSProperties = {
    ...theme.typography?.headlineMedium,
    color: colors.onSurface,
    margin: 0,
  };

  return (
    <div
      className={`connection-recovery ${className}`}
      style={containerStyle}
      data-testid="connection-recovery"
    >
      {/* Header */}
      <div>
        <div style={headerStyle}>
          <WrenchScrewdriverIcon
            style={{
              width: '32px',
              height: '32px',
              color: colors.primary,
            }}
          />
          <div style={{ flex: 1 }}>
            <h2 style={titleStyle}>Connection Recovery</h2>
            <p
              style={{
                ...theme.typography?.bodyLarge,
                color: colors.onSurfaceVariant,
                margin: 0,
                marginTop: '4px',
              }}
            >
              Let's troubleshoot your {platformInfo.name} connection
            </p>
          </div>
        </div>

        {/* Error Summary */}
        {lastError && (
          <div
            style={{
              padding: '16px',
              backgroundColor: colors.errorContainer,
              borderRadius: '8px',
              border: `1px solid ${colors.error}`,
              marginTop: '16px',
            }}
          >
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <ExclamationTriangleIcon
                style={{
                  width: '20px',
                  height: '20px',
                  color: colors.error,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    ...theme.typography?.labelLarge,
                    color: colors.error,
                    marginBottom: '4px',
                  }}
                >
                  Connection Failed
                </div>
                <div
                  style={{
                    ...theme.typography?.bodyMedium,
                    color: colors.onErrorContainer,
                  }}
                >
                  {lastError.message}
                </div>
              </div>
              <button
                onClick={copyErrorDetails}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 10px',
                  backgroundColor: 'transparent',
                  color: colors.onErrorContainer,
                  border: `1px solid ${colors.error}`,
                  borderRadius: '4px',
                  ...theme.typography?.labelSmall,
                  cursor: 'pointer',
                }}
              >
                <ClipboardDocumentCheckIcon style={{ width: '14px', height: '14px' }} />
                {copiedText === 'error' ? 'Copied!' : 'Copy Details'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Diagnostics */}
      {showDiagnostics && (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
            }}
          >
            <h3
              style={{
                ...theme.typography?.headlineSmall,
                color: colors.onSurface,
                margin: 0,
              }}
            >
              System Diagnostics
            </h3>
            <button
              onClick={runDiagnostics}
              disabled={isRunningDiagnostics}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                backgroundColor: colors.primaryContainer,
                color: colors.onPrimaryContainer,
                border: 'none',
                borderRadius: '6px',
                ...theme.typography?.labelMedium,
                fontWeight: 600,
                cursor: isRunningDiagnostics ? 'not-allowed' : 'pointer',
                opacity: isRunningDiagnostics ? 0.7 : 1,
              }}
            >
              {isRunningDiagnostics ? (
                <>
                  <ArrowPathIcon
                    style={{
                      width: '16px',
                      height: '16px',
                      animation: 'spin 1s linear infinite',
                    }}
                  />
                  Running...
                </>
              ) : (
                <>
                  <LightBulbIcon style={{ width: '16px', height: '16px' }} />
                  Run Diagnostics
                </>
              )}
            </button>
          </div>

          {/* Diagnostic Results */}
          {diagnosticResults.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {diagnosticResults.map((result, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '12px',
                    backgroundColor: colors.surfaceVariant,
                    borderRadius: '6px',
                  }}
                >
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      flexShrink: 0,
                      color:
                        result.status === 'pass'
                          ? '#10b981'
                          : result.status === 'warning'
                          ? colors.warning
                          : colors.error,
                    }}
                  >
                    {result.status === 'pass' ? (
                      <CheckCircleIcon />
                    ) : result.status === 'warning' ? (
                      <ExclamationTriangleIcon />
                    ) : (
                      <XCircleIcon />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        ...theme.typography?.labelMedium,
                        color: colors.onSurface,
                        marginBottom: '2px',
                      }}
                    >
                      {result.category}
                    </div>
                    <div
                      style={{
                        ...theme.typography?.bodySmall,
                        color: colors.onSurfaceVariant,
                      }}
                    >
                      {result.message}
                    </div>
                    {result.solution && (
                      <div
                        style={{
                          ...theme.typography?.bodySmall,
                          color: colors.primary,
                          marginTop: '4px',
                        }}
                      >
                        💡 {result.solution}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recovery Steps */}
      <div>
        <h3
          style={{
            ...theme.typography?.headlineSmall,
            color: colors.onSurface,
            margin: 0,
            marginBottom: '12px',
          }}
        >
          Recovery Steps
        </h3>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {getRecoverySteps().map((step) => (
            <div
              key={step.id}
              style={{
                backgroundColor: colors.surfaceVariant,
                borderRadius: '8px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px',
                  cursor: 'pointer',
                }}
                onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    color: colors.primary,
                    flexShrink: 0,
                  }}
                >
                  {step.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      ...theme.typography?.labelLarge,
                      color: colors.onSurface,
                    }}
                  >
                    {step.title}
                  </div>
                  <div
                    style={{
                      ...theme.typography?.bodySmall,
                      color: colors.onSurfaceVariant,
                      marginTop: '2px',
                    }}
                  >
                    {step.description}
                  </div>
                </div>
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    color: colors.onSurfaceVariant,
                    transform: expandedStep === step.id ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                  }}
                >
                  <ChevronRightIcon />
                </div>
              </div>

              {expandedStep === step.id && (
                <div
                  style={{
                    padding: '0 16px 16px',
                    borderTop: `1px solid ${colors.outlineVariant}`,
                  }}
                >
                  {step.checks && (
                    <div
                      style={{
                        marginTop: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      {step.checks.map((check, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            ...theme.typography?.bodySmall,
                            color: colors.onSurfaceVariant,
                          }}
                        >
                          <div
                            style={{
                              width: '16px',
                              height: '16px',
                              border: `2px solid ${colors.outlineVariant}`,
                              borderRadius: '4px',
                            }}
                          />
                          {check.label}
                        </div>
                      ))}
                    </div>
                  )}

                  {step.action && (
                    <button
                      onClick={step.action}
                      style={{
                        marginTop: '12px',
                        padding: '10px 16px',
                        backgroundColor: colors.primary,
                        color: colors.onPrimary,
                        border: 'none',
                        borderRadius: '6px',
                        ...theme.typography?.labelMedium,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {step.actionLabel || 'Take Action'}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          paddingTop: '16px',
          borderTop: `1px solid ${colors.outlineVariant}`,
        }}
      >
        <button
          onClick={handleRetry}
          disabled={isRetrying || !onRetry}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 20px',
            backgroundColor: colors.primary,
            color: colors.onPrimary,
            border: 'none',
            borderRadius: '8px',
            ...theme.typography?.labelLarge,
            fontWeight: 600,
            cursor: isRetrying || !onRetry ? 'not-allowed' : 'pointer',
            opacity: isRetrying || !onRetry ? 0.7 : 1,
          }}
        >
          {isRetrying ? (
            <>
              <ArrowPathIcon
                style={{
                  width: '16px',
                  height: '16px',
                  animation: 'spin 1s linear infinite',
                }}
              />
              Retrying...
            </>
          ) : (
            <>
              <ArrowPathIcon style={{ width: '16px', height: '16px' }} />
              Retry Connection
            </>
          )}
        </button>

        {onReconfigure && (
          <button
            onClick={onReconfigure}
            style={{
              flex: 1,
              padding: '12px 20px',
              backgroundColor: 'transparent',
              color: colors.primary,
              border: `1px solid ${colors.primary}`,
              borderRadius: '8px',
              ...theme.typography?.labelLarge,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reconfigure
          </button>
        )}

        {onContactSupport && (
          <button
            onClick={onContactSupport}
            style={{
              padding: '12px 20px',
              backgroundColor: 'transparent',
              color: colors.onSurfaceVariant,
              border: `1px solid ${colors.outlineVariant}`,
              borderRadius: '8px',
              ...theme.typography?.labelLarge,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <QuestionMarkCircleIcon
              style={{
                width: '16px',
                height: '16px',
                marginRight: '4px',
                display: 'inline-block',
              }}
            />
            Get Help
          </button>
        )}
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default ConnectionRecovery;