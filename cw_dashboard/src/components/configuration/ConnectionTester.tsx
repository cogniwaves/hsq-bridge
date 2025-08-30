/**
 * Connection Tester Component
 * Real-time connection testing with Material Design 3 styling
 * Tests platform configurations and displays detailed results
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../design-system/themes/themeProvider';
import { ConnectionTesterProps, ConnectionTestResult, TestHistory } from './types';
import { getPlatformInfo, formatRelativeTime, loadFromLocalStorage, saveToLocalStorage } from './utils';
import {
  PlayIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  SignalIcon,
  ShieldCheckIcon,
  BoltIcon,
  ArrowPathIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

export function ConnectionTester({
  platform,
  configuration,
  onTest,
  onTestComplete,
  autoTest = false,
  showHistory = true,
  className = '',
}: ConnectionTesterProps) {
  const { theme, resolvedMode } = useTheme();
  const [isTesting, setIsTesting] = useState(false);
  const [lastResult, setLastResult] = useState<ConnectionTestResult | null>(null);
  const [testHistory, setTestHistory] = useState<TestHistory[]>([]);
  const [currentStep, setCurrentStep] = useState<string>('');

  const platformInfo = getPlatformInfo(platform);
  const colors = theme.colors;
  const isDark = resolvedMode === 'dark';

  const storageKey = `connection-test-history-${platform.toLowerCase()}`;

  // Load test history from localStorage
  useEffect(() => {
    if (showHistory) {
      const history = loadFromLocalStorage<TestHistory[]>(storageKey, []);
      setTestHistory(history);
    }
  }, [showHistory, storageKey]);

  // Save test history to localStorage
  const saveTestHistory = useCallback((history: TestHistory[]) => {
    if (showHistory) {
      // Keep only the last 10 test results
      const limitedHistory = history.slice(0, 10);
      setTestHistory(limitedHistory);
      saveToLocalStorage(storageKey, limitedHistory);
    }
  }, [showHistory, storageKey]);

  // Auto-test effect
  useEffect(() => {
    if (autoTest && configuration && Object.keys(configuration).length > 0) {
      runTest();
    }
  }, [autoTest, configuration]);

  // Test execution
  const runTest = async () => {
    if (!configuration || isTesting || Object.keys(configuration).length === 0) return;

    console.log('🧪 [DEBUG] ConnectionTester runTest started:', {
      platform,
      hasConfig: !!configuration,
      configKeys: Object.keys(configuration),
      timestamp: new Date().toISOString()
    });

    setIsTesting(true);
    setCurrentStep('Initializing connection test...');

    try {
      // Simulate testing steps for better UX
      const steps = [
        'Validating configuration...',
        'Testing API connectivity...',
        'Verifying authentication...',
        'Checking rate limits...',
        'Finalizing test results...',
      ];

      for (let i = 0; i < steps.length; i++) {
        setCurrentStep(steps[i]);
        // Add small delay for visual feedback
        if (i < steps.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      const result = await onTest(configuration);
      
      console.log('🔬 [DEBUG] ConnectionTester received test result:', {
        platform,
        result,
        timestamp: new Date().toISOString()
      });
      
      setLastResult(result);

      // Add to history
      const newHistoryItem: TestHistory = {
        id: Date.now().toString(),
        timestamp: new Date(),
        result,
        config: { ...configuration }, // Store a copy
      };

      const updatedHistory = [newHistoryItem, ...testHistory];
      saveTestHistory(updatedHistory);

      if (onTestComplete) {
        onTestComplete(result);
      }
    } catch (error) {
      const errorResult: ConnectionTestResult = {
        success: false,
        message: error instanceof Error ? error.message : 'Test failed',
        details: {
          apiReachable: false,
          authValid: false,
          errorCount: 1,
        },
      };

      setLastResult(errorResult);

      const newHistoryItem: TestHistory = {
        id: Date.now().toString(),
        timestamp: new Date(),
        result: errorResult,
        config: { ...configuration },
      };

      const updatedHistory = [newHistoryItem, ...testHistory];
      saveTestHistory(updatedHistory);

      if (onTestComplete) {
        onTestComplete(errorResult);
      }
    } finally {
      setIsTesting(false);
      setCurrentStep('');
    }
  };

  // Component styles
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing?.component?.lg || '24px',
    padding: theme.spacing?.container?.lg || '24px',
    backgroundColor: colors.surface,
    border: `1px solid ${colors.outlineVariant}`,
    borderRadius: theme.components?.card?.borderRadius || '12px',
    maxWidth: '600px',
    width: '100%',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing?.component?.md || '16px',
  };

  const titleStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing?.component?.sm || '12px',
    ...theme.typography?.headlineSmall,
    color: colors.onSurface,
    margin: 0,
    fontWeight: 600,
  };

  const testButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing?.component?.sm || '8px',
    padding: '12px 20px',
    backgroundColor: isTesting ? colors.surfaceVariant : colors.primary,
    color: isTesting ? colors.onSurfaceVariant : colors.onPrimary,
    border: 'none',
    borderRadius: '8px',
    cursor: isTesting ? 'not-allowed' : 'pointer',
    transition: `all ${theme.motion?.duration?.short2 || '150ms'} ${theme.motion?.easing?.standard || 'ease'}`,
    ...theme.typography?.labelLarge,
    fontWeight: 600,
    opacity: isTesting ? 0.7 : 1,
  };

  // Current test status
  const CurrentTestStatus = () => {
    if (!isTesting && !lastResult) return null;

    if (isTesting) {
      return (
        <div
          style={{
            padding: theme.spacing?.component?.lg || '20px',
            backgroundColor: colors.surfaceContainer,
            borderRadius: '8px',
            border: `1px solid ${colors.primary}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing?.component?.md || '12px',
              marginBottom: theme.spacing?.component?.sm || '12px',
            }}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                border: `3px solid ${colors.outlineVariant}`,
                borderTop: `3px solid ${colors.primary}`,
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
            <span
              style={{
                ...theme.typography?.labelLarge,
                color: colors.primary,
                fontWeight: 600,
              }}
            >
              Testing Connection
            </span>
          </div>
          <div
            style={{
              ...theme.typography?.bodyMedium,
              color: colors.onSurfaceVariant,
            }}
          >
            {currentStep}
          </div>
        </div>
      );
    }

    return (
      <div
        style={{
          padding: theme.spacing?.component?.lg || '20px',
          backgroundColor: lastResult.success ? colors.successContainer : colors.errorContainer,
          borderRadius: '8px',
          border: `1px solid ${lastResult.success ? '#10b981' : colors.error}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing?.component?.md || '12px',
            marginBottom: theme.spacing?.component?.sm || '12px',
          }}
        >
          {lastResult.success ? (
            <CheckCircleIcon
              style={{
                width: '24px',
                height: '24px',
                color: '#10b981',
              }}
            />
          ) : (
            <XCircleIcon
              style={{
                width: '24px',
                height: '24px',
                color: colors.error,
              }}
            />
          )}
          <span
            style={{
              ...theme.typography?.labelLarge,
              color: lastResult.success ? '#10b981' : colors.error,
              fontWeight: 600,
            }}
          >
            {lastResult.success ? 'Connection Successful' : 'Connection Failed'}
          </span>
        </div>
        
        <div
          style={{
            ...theme.typography?.bodyMedium,
            color: lastResult.success ? '#047857' : '#dc2626',
            marginBottom: lastResult.details ? (theme.spacing?.component?.md || '16px') : 0,
          }}
        >
          {lastResult.message}
        </div>

        {/* Test Details */}
        {lastResult.details && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: theme.spacing?.component?.md || '12px',
            }}
          >
            {lastResult.details.apiReachable !== undefined && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SignalIcon style={{ width: '16px', height: '16px' }} />
                <span style={{ ...theme.typography?.bodySmall }}>
                  API: {lastResult.details.apiReachable ? 'Reachable' : 'Unreachable'}
                </span>
              </div>
            )}

            {lastResult.details.authValid !== undefined && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheckIcon style={{ width: '16px', height: '16px' }} />
                <span style={{ ...theme.typography?.bodySmall }}>
                  Auth: {lastResult.details.authValid ? 'Valid' : 'Invalid'}
                </span>
              </div>
            )}

            {lastResult.details.rateLimitOk !== undefined && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BoltIcon style={{ width: '16px', height: '16px' }} />
                <span style={{ ...theme.typography?.bodySmall }}>
                  Rate Limit: {lastResult.details.rateLimitOk ? 'OK' : 'Exceeded'}
                </span>
              </div>
            )}

            {lastResult.details.responseTime !== undefined && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ClockIcon style={{ width: '16px', height: '16px' }} />
                <span style={{ ...theme.typography?.bodySmall }}>
                  Response: {lastResult.details.responseTime}ms
                </span>
              </div>
            )}
          </div>
        )}

        {/* Enhanced Error Details Section */}
        {!lastResult.success && lastResult.details && (
          <div
            style={{
              marginTop: theme.spacing?.component?.md || '16px',
              padding: theme.spacing?.component?.lg || '16px',
              backgroundColor: isDark ? '#2d1b1b' : '#fef2f2',
              border: `1px solid ${colors.error}`,
              borderRadius: '6px',
            }}
          >
            <div
              style={{
                ...theme.typography?.labelMedium,
                color: colors.error,
                fontWeight: 600,
                marginBottom: theme.spacing?.component?.sm || '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <ExclamationTriangleIcon style={{ width: '16px', height: '16px' }} />
              Connection Error Details
            </div>
            
            {lastResult.details.debugInfo && (
              <div style={{ 
                ...theme.typography?.bodySmall,
                color: colors.onErrorContainer,
                fontFamily: 'monospace',
                backgroundColor: isDark ? '#1a0f0f' : '#fee2e2',
                padding: '8px',
                borderRadius: '4px',
                marginTop: '8px'
              }}>
                <div><strong>Error Type:</strong> {lastResult.details.debugInfo.errorType}</div>
                <div><strong>API Key Status:</strong> {lastResult.details.debugInfo.hasApiKey ? 'Present' : 'Missing'}</div>
                {lastResult.details.debugInfo.hasApiKey && (
                  <div><strong>API Key Length:</strong> {lastResult.details.debugInfo.apiKeyLength} chars</div>
                )}
                <div><strong>Timestamp:</strong> {lastResult.details.timestamp}</div>
              </div>
            )}

            <div style={{ 
              ...theme.typography?.bodySmall,
              color: colors.onErrorContainer,
              marginTop: '8px',
              fontStyle: 'italic'
            }}>
              💡 Tip: Check your API key format and permissions. HubSpot API keys should start with "pat-na"
            </div>
          </div>
        )}
      </div>
    );
  };

  // Test History Component
  const TestHistorySection = () => {
    if (!showHistory || testHistory.length === 0) return null;

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing?.component?.md || '16px',
        }}
      >
        <h3
          style={{
            ...theme.typography?.headlineSmall,
            color: colors.onSurface,
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <ChartBarIcon style={{ width: '20px', height: '20px' }} />
          Test History
        </h3>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: theme.spacing?.component?.sm || '8px',
            maxHeight: '300px',
            overflowY: 'auto',
          }}
        >
          {testHistory.map((historyItem, index) => (
            <div
              key={historyItem.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: theme.spacing?.component?.md || '12px',
                backgroundColor: index === 0 ? colors.primaryContainer : colors.surfaceVariant,
                borderRadius: '6px',
                border: index === 0 ? `1px solid ${colors.primary}` : `1px solid ${colors.outlineVariant}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                {historyItem.result.success ? (
                  <CheckCircleIcon
                    style={{
                      width: '16px',
                      height: '16px',
                      color: '#10b981',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <XCircleIcon
                    style={{
                      width: '16px',
                      height: '16px',
                      color: colors.error,
                      flexShrink: 0,
                    }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      ...theme.typography?.bodyMedium,
                      color: colors.onSurface,
                      fontWeight: 500,
                    }}
                  >
                    {historyItem.result.success ? 'Success' : 'Failed'}
                  </div>
                  <div
                    style={{
                      ...theme.typography?.bodySmall,
                      color: colors.onSurfaceVariant,
                      opacity: 0.8,
                    }}
                  >
                    {formatRelativeTime(historyItem.timestamp)}
                  </div>
                </div>
              </div>

              {historyItem.result.details?.responseTime && (
                <div
                  style={{
                    ...theme.typography?.labelSmall,
                    color: colors.onSurfaceVariant,
                    backgroundColor: colors.surface,
                    padding: '4px 8px',
                    borderRadius: '4px',
                  }}
                >
                  {historyItem.result.details.responseTime}ms
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`connection-tester connection-tester-${platform.toLowerCase()} ${className}`}
      style={containerStyle}
      data-testid={`connection-tester-${platform.toLowerCase()}`}
    >
      {/* Header */}
      <div style={headerStyle}>
        <h2 style={titleStyle}>
          <div
            style={{
              fontSize: '20px',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {platformInfo.icon}
          </div>
          Connection Test
        </h2>

        <button
          onClick={runTest}
          disabled={isTesting || Object.keys(configuration).length === 0}
          style={testButtonStyle}
          aria-label={`Test ${platformInfo.name} connection`}
        >
          {isTesting ? (
            <>
              <ArrowPathIcon
                style={{
                  width: '16px',
                  height: '16px',
                  animation: 'spin 1s linear infinite',
                }}
              />
              Testing...
            </>
          ) : (
            <>
              <PlayIcon style={{ width: '16px', height: '16px' }} />
              Run Test
            </>
          )}
        </button>
      </div>

      {/* No Configuration Warning */}
      {Object.keys(configuration).length === 0 && (
        <div
          style={{
            padding: theme.spacing?.component?.lg || '20px',
            backgroundColor: colors.warningContainer,
            borderRadius: '8px',
            border: `1px solid ${colors.warning}`,
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing?.component?.md || '12px',
          }}
        >
          <ExclamationTriangleIcon
            style={{
              width: '24px',
              height: '24px',
              color: colors.warning,
              flexShrink: 0,
            }}
          />
          <div>
            <div
              style={{
                ...theme.typography?.labelLarge,
                color: colors.warning,
                fontWeight: 600,
                marginBottom: '4px',
              }}
            >
              No Configuration Available
            </div>
            <div
              style={{
                ...theme.typography?.bodySmall,
                color: colors.onWarningContainer,
              }}
            >
              Please configure {platformInfo.name} before testing the connection.
            </div>
          </div>
        </div>
      )}

      {/* Current Test Status */}
      <CurrentTestStatus />

      {/* Test History */}
      <TestHistorySection />

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

export default ConnectionTester;