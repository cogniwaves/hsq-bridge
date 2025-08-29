/**
 * Live Connection Tester Component
 * Real-time connection monitoring with automatic health checks
 * Visual indicators and detailed diagnostics
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../../design-system/themes/themeProvider';
import { Platform, ConnectionTestResult } from './types';
import { getPlatformInfo } from './utils';
import {
  SignalIcon,
  SignalSlashIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ClockIcon,
  BoltIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  PlayIcon,
  PauseIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';

interface LiveConnectionTesterProps {
  platforms: Array<{
    platform: Platform;
    config: Record<string, any>;
    enabled: boolean;
  }>;
  interval?: number; // Test interval in seconds
  autoStart?: boolean;
  showHistory?: boolean;
  showMetrics?: boolean;
  onStatusChange?: (platform: Platform, status: ConnectionTestResult) => void;
  className?: string;
}

interface PlatformStatus {
  platform: Platform;
  lastTest?: Date;
  nextTest?: Date;
  result?: ConnectionTestResult;
  history: ConnectionTestResult[];
  metrics: {
    uptime: number;
    averageResponseTime: number;
    successRate: number;
    totalTests: number;
    failureCount: number;
  };
}

export function LiveConnectionTester({
  platforms,
  interval = 30,
  autoStart = true,
  showHistory = true,
  showMetrics = true,
  onStatusChange,
  className = '',
}: LiveConnectionTesterProps) {
  const { theme, resolvedMode } = useTheme();
  const colors = theme.colors;
  const isDark = resolvedMode === 'dark';

  const [isMonitoring, setIsMonitoring] = useState(autoStart);
  const [platformStatuses, setPlatformStatuses] = useState<Record<Platform, PlatformStatus>>({});
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [testingPlatform, setTestingPlatform] = useState<Platform | null>(null);

  // Initialize platform statuses
  useEffect(() => {
    const initialStatuses: Record<Platform, PlatformStatus> = {} as any;
    
    platforms.forEach(({ platform }) => {
      if (!platformStatuses[platform]) {
        initialStatuses[platform] = {
          platform,
          history: [],
          metrics: {
            uptime: 0,
            averageResponseTime: 0,
            successRate: 0,
            totalTests: 0,
            failureCount: 0,
          },
        };
      }
    });

    setPlatformStatuses(prev => ({ ...prev, ...initialStatuses }));
  }, [platforms]);

  // Test a single platform
  const testPlatform = useCallback(async (platform: Platform, config: Record<string, any>) => {
    setTestingPlatform(platform);
    const startTime = Date.now();

    try {
      const response = await fetch('/api/config/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform,
          config,
        }),
      });

      const result: ConnectionTestResult = await response.json();
      const testDate = new Date();

      setPlatformStatuses(prev => {
        const current = prev[platform] || {
          platform,
          history: [],
          metrics: {
            uptime: 0,
            averageResponseTime: 0,
            successRate: 0,
            totalTests: 0,
            failureCount: 0,
          },
        };

        // Update history (keep last 20 results)
        const newHistory = [result, ...current.history].slice(0, 20);

        // Calculate metrics
        const totalTests = current.metrics.totalTests + 1;
        const failureCount = current.metrics.failureCount + (result.success ? 0 : 1);
        const successRate = ((totalTests - failureCount) / totalTests) * 100;
        
        const responseTime = result.details?.responseTime || 0;
        const averageResponseTime = current.metrics.averageResponseTime
          ? (current.metrics.averageResponseTime * current.metrics.totalTests + responseTime) / totalTests
          : responseTime;

        // Calculate uptime (based on last 24 hours of tests)
        const last24Hours = newHistory.filter((h, idx) => idx < Math.min(48, newHistory.length)); // Assuming 30-second intervals
        const successfulTests = last24Hours.filter(h => h.success).length;
        const uptime = last24Hours.length > 0 ? (successfulTests / last24Hours.length) * 100 : 0;

        const newStatus: PlatformStatus = {
          platform,
          lastTest: testDate,
          nextTest: new Date(testDate.getTime() + interval * 1000),
          result,
          history: newHistory,
          metrics: {
            uptime,
            averageResponseTime: Math.round(averageResponseTime),
            successRate: Math.round(successRate * 100) / 100,
            totalTests,
            failureCount,
          },
        };

        return {
          ...prev,
          [platform]: newStatus,
        };
      });

      if (onStatusChange) {
        onStatusChange(platform, result);
      }
    } catch (error) {
      const errorResult: ConnectionTestResult = {
        success: false,
        message: error instanceof Error ? error.message : 'Test failed',
        details: {
          apiReachable: false,
          authValid: false,
          rateLimitOk: false,
          errorCount: 1,
          responseTime: Date.now() - startTime,
        },
      };

      setPlatformStatuses(prev => ({
        ...prev,
        [platform]: {
          ...prev[platform],
          lastTest: new Date(),
          result: errorResult,
          history: [errorResult, ...(prev[platform]?.history || [])].slice(0, 20),
        },
      }));

      if (onStatusChange) {
        onStatusChange(platform, errorResult);
      }
    } finally {
      setTestingPlatform(null);
    }
  }, [interval, onStatusChange]);

  // Run tests for all enabled platforms
  const runTests = useCallback(async () => {
    const enabledPlatforms = platforms.filter(p => p.enabled && p.config && Object.keys(p.config).length > 0);
    
    for (const { platform, config } of enabledPlatforms) {
      await testPlatform(platform, config);
      // Add small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }, [platforms, testPlatform]);

  // Start/stop monitoring
  useEffect(() => {
    if (isMonitoring) {
      // Run initial tests
      runTests();

      // Set up interval
      intervalRef.current = setInterval(runTests, interval * 1000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [isMonitoring, interval, runTests]);

  // Get status color
  const getStatusColor = (status?: PlatformStatus) => {
    if (!status?.result) return colors.onSurfaceVariant;
    if (status.result.success) return '#10b981';
    if (status.metrics.uptime > 50) return colors.warning;
    return colors.error;
  };

  // Get status icon
  const getStatusIcon = (status?: PlatformStatus) => {
    if (!status?.result) {
      return <SignalSlashIcon style={{ width: '20px', height: '20px' }} />;
    }
    if (status.result.success) {
      return <SignalIcon style={{ width: '20px', height: '20px' }} />;
    }
    return <SignalSlashIcon style={{ width: '20px', height: '20px' }} />;
  };

  // Component styles
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing?.component?.lg || '24px',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing?.container?.md || '16px',
    backgroundColor: colors.surface,
    borderRadius: theme.components?.card?.borderRadius || '12px',
    border: `1px solid ${colors.outlineVariant}`,
  };

  const platformCardStyle: React.CSSProperties = {
    padding: theme.spacing?.container?.md || '16px',
    backgroundColor: colors.surface,
    borderRadius: theme.components?.card?.borderRadius || '12px',
    border: `1px solid ${colors.outlineVariant}`,
    cursor: 'pointer',
    transition: `all ${theme.motion?.duration?.short2 || '150ms'} ${theme.motion?.easing?.standard || 'ease'}`,
  };

  return (
    <div
      className={`live-connection-tester ${className}`}
      style={containerStyle}
      data-testid="live-connection-tester"
    >
      {/* Header Controls */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h3
            style={{
              ...theme.typography?.headlineSmall,
              color: colors.onSurface,
              margin: 0,
            }}
          >
            Live Connection Monitor
          </h3>
          <div
            style={{
              width: '8px',
              height: '8px',
              backgroundColor: isMonitoring ? '#10b981' : colors.onSurfaceVariant,
              borderRadius: '50%',
              animation: isMonitoring ? 'pulse 2s infinite' : 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setIsMonitoring(!isMonitoring)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              backgroundColor: isMonitoring ? colors.errorContainer : colors.primaryContainer,
              color: isMonitoring ? colors.onErrorContainer : colors.onPrimaryContainer,
              border: 'none',
              borderRadius: '6px',
              ...theme.typography?.labelMedium,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {isMonitoring ? (
              <>
                <PauseIcon style={{ width: '16px', height: '16px' }} />
                Pause
              </>
            ) : (
              <>
                <PlayIcon style={{ width: '16px', height: '16px' }} />
                Start
              </>
            )}
          </button>

          <button
            onClick={runTests}
            disabled={isMonitoring}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              backgroundColor: 'transparent',
              color: colors.primary,
              border: `1px solid ${colors.primary}`,
              borderRadius: '6px',
              ...theme.typography?.labelMedium,
              fontWeight: 600,
              cursor: isMonitoring ? 'not-allowed' : 'pointer',
              opacity: isMonitoring ? 0.5 : 1,
            }}
          >
            <ArrowPathIcon style={{ width: '16px', height: '16px' }} />
            Test Now
          </button>
        </div>
      </div>

      {/* Platform Status Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: theme.spacing?.component?.md || '16px',
        }}
      >
        {platforms.map(({ platform, enabled }) => {
          const status = platformStatuses[platform];
          const platformInfo = getPlatformInfo(platform);
          const isActive = testingPlatform === platform;

          return (
            <div
              key={platform}
              style={{
                ...platformCardStyle,
                opacity: enabled ? 1 : 0.6,
                transform: selectedPlatform === platform ? 'scale(1.02)' : 'scale(1)',
                boxShadow: selectedPlatform === platform ? theme.elevation?.level2 : 'none',
              }}
              onClick={() => setSelectedPlatform(selectedPlatform === platform ? null : platform)}
            >
              {/* Platform Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      fontSize: '24px',
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: platformInfo.color,
                    }}
                  >
                    {platformInfo.icon}
                  </div>
                  <div>
                    <div
                      style={{
                        ...theme.typography?.labelLarge,
                        color: colors.onSurface,
                        fontWeight: 600,
                      }}
                    >
                      {platformInfo.name}
                    </div>
                    {!enabled && (
                      <div
                        style={{
                          ...theme.typography?.labelSmall,
                          color: colors.onSurfaceVariant,
                          opacity: 0.7,
                        }}
                      >
                        Disabled
                      </div>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    color: getStatusColor(status),
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {isActive ? (
                    <ArrowPathIcon
                      style={{
                        width: '20px',
                        height: '20px',
                        animation: 'spin 1s linear infinite',
                      }}
                    />
                  ) : (
                    getStatusIcon(status)
                  )}
                </div>
              </div>

              {/* Status Message */}
              {status?.result && (
                <div
                  style={{
                    padding: '8px',
                    backgroundColor: status.result.success ? colors.successContainer : colors.errorContainer,
                    borderRadius: '6px',
                    marginBottom: '12px',
                  }}
                >
                  <div
                    style={{
                      ...theme.typography?.bodySmall,
                      color: status.result.success ? '#047857' : colors.onErrorContainer,
                    }}
                  >
                    {status.result.message}
                  </div>
                </div>
              )}

              {/* Quick Metrics */}
              {showMetrics && status?.metrics && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                  }}
                >
                  <MetricBadge
                    icon={<ChartBarIcon />}
                    label="Uptime"
                    value={`${status.metrics.uptime.toFixed(1)}%`}
                    color={status.metrics.uptime > 95 ? '#10b981' : status.metrics.uptime > 80 ? colors.warning : colors.error}
                  />
                  <MetricBadge
                    icon={<ClockIcon />}
                    label="Avg Response"
                    value={`${status.metrics.averageResponseTime}ms`}
                    color={status.metrics.averageResponseTime < 500 ? '#10b981' : status.metrics.averageResponseTime < 1000 ? colors.warning : colors.error}
                  />
                </div>
              )}

              {/* Expanded Details */}
              {selectedPlatform === platform && status && (
                <div
                  style={{
                    marginTop: '16px',
                    paddingTop: '16px',
                    borderTop: `1px solid ${colors.outlineVariant}`,
                  }}
                >
                  {/* Detailed Metrics */}
                  <div style={{ marginBottom: '12px' }}>
                    <h4
                      style={{
                        ...theme.typography?.labelMedium,
                        color: colors.onSurfaceVariant,
                        margin: 0,
                        marginBottom: '8px',
                      }}
                    >
                      Connection Details
                    </h4>
                    {status.result?.details && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <DetailRow
                          icon={<SignalIcon />}
                          label="API Reachable"
                          value={status.result.details.apiReachable ? 'Yes' : 'No'}
                          success={status.result.details.apiReachable}
                        />
                        <DetailRow
                          icon={<ShieldCheckIcon />}
                          label="Auth Valid"
                          value={status.result.details.authValid ? 'Yes' : 'No'}
                          success={status.result.details.authValid}
                        />
                        <DetailRow
                          icon={<BoltIcon />}
                          label="Rate Limit OK"
                          value={status.result.details.rateLimitOk ? 'Yes' : 'No'}
                          success={status.result.details.rateLimitOk}
                        />
                      </div>
                    )}
                  </div>

                  {/* Test History */}
                  {showHistory && status.history.length > 0 && (
                    <div>
                      <h4
                        style={{
                          ...theme.typography?.labelMedium,
                          color: colors.onSurfaceVariant,
                          margin: 0,
                          marginBottom: '8px',
                        }}
                      >
                        Recent Tests
                      </h4>
                      <div
                        style={{
                          display: 'flex',
                          gap: '2px',
                          height: '20px',
                        }}
                      >
                        {status.history.slice(0, 20).reverse().map((result, idx) => (
                          <div
                            key={idx}
                            style={{
                              flex: 1,
                              backgroundColor: result.success ? '#10b981' : colors.error,
                              opacity: 0.8,
                              borderRadius: '2px',
                            }}
                            title={`${result.success ? 'Success' : 'Failed'}: ${result.message}`}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Statistics */}
                  <div
                    style={{
                      marginTop: '12px',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px',
                      ...theme.typography?.labelSmall,
                      color: colors.onSurfaceVariant,
                    }}
                  >
                    <div>Total Tests: {status.metrics.totalTests}</div>
                    <div>Failures: {status.metrics.failureCount}</div>
                    <div>Success Rate: {status.metrics.successRate}%</div>
                    <div>Last Test: {status.lastTest ? new Date(status.lastTest).toLocaleTimeString() : 'Never'}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

// Helper component for metric badges
function MetricBadge({ icon, label, value, color }: any) {
  const { theme } = useTheme();
  const colors = theme.colors;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 8px',
        backgroundColor: colors.surfaceVariant,
        borderRadius: '4px',
      }}
    >
      <div style={{ width: '14px', height: '14px', color, flexShrink: 0 }}>
        {React.cloneElement(icon, { style: { width: '14px', height: '14px' } })}
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            ...theme.typography?.labelSmall,
            color: colors.onSurfaceVariant,
            opacity: 0.7,
          }}
        >
          {label}
        </div>
        <div
          style={{
            ...theme.typography?.labelSmall,
            color,
            fontWeight: 600,
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

// Helper component for detail rows
function DetailRow({ icon, label, value, success }: any) {
  const { theme } = useTheme();
  const colors = theme.colors;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        ...theme.typography?.bodySmall,
      }}
    >
      <div
        style={{
          width: '14px',
          height: '14px',
          color: success ? '#10b981' : colors.error,
          flexShrink: 0,
        }}
      >
        {React.cloneElement(icon, { style: { width: '14px', height: '14px' } })}
      </div>
      <span style={{ color: colors.onSurfaceVariant }}>{label}:</span>
      <span style={{ color: success ? '#10b981' : colors.error, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

export default LiveConnectionTester;