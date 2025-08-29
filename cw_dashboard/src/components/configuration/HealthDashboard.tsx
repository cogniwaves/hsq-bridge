/**
 * Health Dashboard Component
 * Comprehensive overview of all platform connection health
 * Real-time monitoring with visual indicators and metrics
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../design-system/themes/themeProvider';
import { Platform, HealthStatus, ConnectionStatus } from './types';
import { getPlatformInfo } from './utils';
import {
  HeartIcon,
  SignalIcon,
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BoltIcon,
  ShieldCheckIcon,
  ServerIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline';

interface PlatformHealth {
  platform: Platform;
  status: HealthStatus;
  uptime: number; // Percentage
  responseTime: number; // Milliseconds
  errorRate: number; // Percentage
  lastCheck: Date;
  trend: 'up' | 'down' | 'stable';
  incidents: number;
  details: {
    apiHealth: boolean;
    authHealth: boolean;
    rateLimitHealth: boolean;
    dataFlowHealth: boolean;
  };
}

interface HealthDashboardProps {
  platforms: Platform[];
  onPlatformClick?: (platform: Platform) => void;
  onRefresh?: () => Promise<void>;
  refreshInterval?: number; // Seconds
  showMetrics?: boolean;
  showTrends?: boolean;
  className?: string;
}

interface HealthMetrics {
  overallHealth: number;
  totalPlatforms: number;
  healthyPlatforms: number;
  degradedPlatforms: number;
  unhealthyPlatforms: number;
  averageUptime: number;
  averageResponseTime: number;
  totalIncidents: number;
}

export function HealthDashboard({
  platforms,
  onPlatformClick,
  onRefresh,
  refreshInterval = 60,
  showMetrics = true,
  showTrends = true,
  className = '',
}: HealthDashboardProps) {
  const { theme, resolvedMode } = useTheme();
  const colors = theme.colors;
  const isDark = resolvedMode === 'dark';

  const [platformHealthMap, setPlatformHealthMap] = useState<Map<Platform, PlatformHealth>>(new Map());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [metrics, setMetrics] = useState<HealthMetrics>({
    overallHealth: 0,
    totalPlatforms: 0,
    healthyPlatforms: 0,
    degradedPlatforms: 0,
    unhealthyPlatforms: 0,
    averageUptime: 0,
    averageResponseTime: 0,
    totalIncidents: 0,
  });

  // Calculate platform health
  const calculatePlatformHealth = useCallback(async (platform: Platform): Promise<PlatformHealth> => {
    // This would normally fetch real data from API
    // For now, simulating with random data
    const randomHealth = (): boolean => Math.random() > 0.2;
    const randomUptime = () => 85 + Math.random() * 15;
    const randomResponseTime = () => 100 + Math.random() * 400;
    const randomErrorRate = () => Math.random() * 5;

    const uptime = randomUptime();
    const responseTime = randomResponseTime();
    const errorRate = randomErrorRate();

    let status: HealthStatus = 'HEALTHY';
    if (uptime < 90 || errorRate > 5) {
      status = 'UNHEALTHY';
    } else if (uptime < 95 || errorRate > 2 || responseTime > 300) {
      status = 'DEGRADED';
    }

    const trend = Math.random() > 0.5 ? 'up' : Math.random() > 0.5 ? 'down' : 'stable';
    const incidents = Math.floor(Math.random() * 3);

    return {
      platform,
      status,
      uptime,
      responseTime,
      errorRate,
      lastCheck: new Date(),
      trend,
      incidents,
      details: {
        apiHealth: randomHealth(),
        authHealth: randomHealth(),
        rateLimitHealth: randomHealth(),
        dataFlowHealth: randomHealth(),
      },
    };
  }, []);

  // Refresh all platform health
  const refreshHealth = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const healthMap = new Map<Platform, PlatformHealth>();
      let totalUptime = 0;
      let totalResponseTime = 0;
      let totalIncidents = 0;
      let healthyCount = 0;
      let degradedCount = 0;
      let unhealthyCount = 0;

      for (const platform of platforms) {
        const health = await calculatePlatformHealth(platform);
        healthMap.set(platform, health);

        totalUptime += health.uptime;
        totalResponseTime += health.responseTime;
        totalIncidents += health.incidents;

        switch (health.status) {
          case 'HEALTHY':
            healthyCount++;
            break;
          case 'DEGRADED':
            degradedCount++;
            break;
          case 'UNHEALTHY':
            unhealthyCount++;
            break;
        }
      }

      setPlatformHealthMap(healthMap);
      setLastRefresh(new Date());

      // Calculate metrics
      const overallHealth = platforms.length > 0
        ? (healthyCount * 100 + degradedCount * 50) / platforms.length
        : 0;

      setMetrics({
        overallHealth,
        totalPlatforms: platforms.length,
        healthyPlatforms: healthyCount,
        degradedPlatforms: degradedCount,
        unhealthyPlatforms: unhealthyCount,
        averageUptime: platforms.length > 0 ? totalUptime / platforms.length : 0,
        averageResponseTime: platforms.length > 0 ? totalResponseTime / platforms.length : 0,
        totalIncidents,
      });

      if (onRefresh) {
        await onRefresh();
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [platforms, calculatePlatformHealth, onRefresh]);

  // Auto-refresh
  useEffect(() => {
    refreshHealth();

    const interval = setInterval(refreshHealth, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [refreshHealth, refreshInterval]);

  // Get health color
  const getHealthColor = (status: HealthStatus) => {
    switch (status) {
      case 'HEALTHY':
        return '#10b981';
      case 'DEGRADED':
        return colors.warning;
      case 'UNHEALTHY':
        return colors.error;
      default:
        return colors.onSurfaceVariant;
    }
  };

  // Get health icon
  const getHealthIcon = (status: HealthStatus) => {
    switch (status) {
      case 'HEALTHY':
        return <CheckCircleIcon />;
      case 'DEGRADED':
        return <ExclamationTriangleIcon />;
      case 'UNHEALTHY':
        return <XCircleIcon />;
      default:
        return <SignalIcon />;
    }
  };

  // Get trend icon
  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <ArrowTrendingUpIcon style={{ color: '#10b981' }} />;
      case 'down':
        return <ArrowTrendingDownIcon style={{ color: colors.error }} />;
      default:
        return <div style={{ width: '16px', height: '2px', backgroundColor: colors.onSurfaceVariant }} />;
    }
  };

  // Component styles
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing?.component?.lg || '24px',
  };

  const headerStyle: React.CSSProperties = {
    padding: theme.spacing?.container?.lg || '24px',
    backgroundColor: colors.surface,
    borderRadius: theme.components?.card?.borderRadius || '12px',
    border: `1px solid ${colors.outlineVariant}`,
  };

  const metricsGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: theme.spacing?.component?.md || '16px',
  };

  const platformGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: theme.spacing?.component?.md || '16px',
  };

  return (
    <div
      className={`health-dashboard ${className}`}
      style={containerStyle}
      data-testid="health-dashboard"
    >
      {/* Header Section */}
      <div style={headerStyle}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
          }}
        >
          <div>
            <h2
              style={{
                ...theme.typography?.headlineMedium,
                color: colors.onSurface,
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <HeartIcon style={{ width: '28px', height: '28px', color: colors.primary }} />
              System Health Dashboard
            </h2>
            <p
              style={{
                ...theme.typography?.bodyLarge,
                color: colors.onSurfaceVariant,
                margin: 0,
                marginTop: '4px',
              }}
            >
              Real-time monitoring of all platform connections
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                ...theme.typography?.labelSmall,
                color: colors.onSurfaceVariant,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <ClockIcon style={{ width: '14px', height: '14px' }} />
              Last updated: {lastRefresh.toLocaleTimeString()}
            </div>

            <button
              onClick={refreshHealth}
              disabled={isRefreshing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                backgroundColor: colors.primaryContainer,
                color: colors.onPrimaryContainer,
                border: 'none',
                borderRadius: '8px',
                ...theme.typography?.labelMedium,
                fontWeight: 600,
                cursor: isRefreshing ? 'not-allowed' : 'pointer',
                opacity: isRefreshing ? 0.7 : 1,
              }}
            >
              <ArrowPathIcon
                style={{
                  width: '16px',
                  height: '16px',
                  animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                }}
              />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Overall Health Score */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
            padding: '20px',
            backgroundColor: colors.surfaceVariant,
            borderRadius: '12px',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              background: `conic-gradient(
                ${getHealthColor(
                  metrics.overallHealth > 80 ? 'HEALTHY' : metrics.overallHealth > 50 ? 'DEGRADED' : 'UNHEALTHY'
                )} ${metrics.overallHealth * 3.6}deg,
                ${colors.outlineVariant} ${metrics.overallHealth * 3.6}deg
              )`,
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                backgroundColor: colors.surfaceVariant,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                ...theme.typography?.headlineSmall,
                color: colors.onSurface,
                fontWeight: 'bold',
              }}
            >
              {Math.round(metrics.overallHealth)}%
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div
              style={{
                ...theme.typography?.titleLarge,
                color: colors.onSurface,
                marginBottom: '4px',
              }}
            >
              Overall System Health
            </div>
            <div
              style={{
                ...theme.typography?.bodyMedium,
                color: colors.onSurfaceVariant,
              }}
            >
              {metrics.healthyPlatforms} healthy, {metrics.degradedPlatforms} degraded, {metrics.unhealthyPlatforms} unhealthy
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        {showMetrics && (
          <div style={metricsGridStyle}>
            <MetricCard
              icon={<ServerIcon />}
              label="Total Platforms"
              value={metrics.totalPlatforms.toString()}
              color={colors.primary}
            />
            <MetricCard
              icon={<ChartBarIcon />}
              label="Average Uptime"
              value={`${metrics.averageUptime.toFixed(1)}%`}
              color={metrics.averageUptime > 95 ? '#10b981' : metrics.averageUptime > 90 ? colors.warning : colors.error}
            />
            <MetricCard
              icon={<BoltIcon />}
              label="Avg Response Time"
              value={`${Math.round(metrics.averageResponseTime)}ms`}
              color={metrics.averageResponseTime < 200 ? '#10b981' : metrics.averageResponseTime < 500 ? colors.warning : colors.error}
            />
            <MetricCard
              icon={<ExclamationTriangleIcon />}
              label="Active Incidents"
              value={metrics.totalIncidents.toString()}
              color={metrics.totalIncidents === 0 ? '#10b981' : metrics.totalIncidents < 3 ? colors.warning : colors.error}
            />
          </div>
        )}
      </div>

      {/* Platform Health Grid */}
      <div style={platformGridStyle}>
        {platforms.map((platform) => {
          const health = platformHealthMap.get(platform);
          const platformInfo = getPlatformInfo(platform);

          if (!health) return null;

          return (
            <div
              key={platform}
              style={{
                padding: theme.spacing?.container?.lg || '20px',
                backgroundColor: colors.surface,
                borderRadius: theme.components?.card?.borderRadius || '12px',
                border: `2px solid ${getHealthColor(health.status)}`,
                cursor: onPlatformClick ? 'pointer' : 'default',
                transition: `all ${theme.motion?.duration?.short2 || '150ms'} ${theme.motion?.easing?.standard || 'ease'}`,
              }}
              onClick={() => onPlatformClick && onPlatformClick(platform)}
            >
              {/* Platform Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      fontSize: '24px',
                      color: platformInfo.color,
                    }}
                  >
                    {platformInfo.icon}
                  </div>
                  <div>
                    <div
                      style={{
                        ...theme.typography?.titleMedium,
                        color: colors.onSurface,
                      }}
                    >
                      {platformInfo.name}
                    </div>
                    <div
                      style={{
                        ...theme.typography?.labelSmall,
                        color: getHealthColor(health.status),
                        fontWeight: 600,
                        textTransform: 'uppercase',
                      }}
                    >
                      {health.status}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {showTrends && (
                    <div style={{ width: '16px', height: '16px' }}>
                      {getTrendIcon(health.trend)}
                    </div>
                  )}
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      color: getHealthColor(health.status),
                    }}
                  >
                    {getHealthIcon(health.status)}
                  </div>
                </div>
              </div>

              {/* Health Metrics */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  marginBottom: '16px',
                }}
              >
                <HealthMetric
                  label="Uptime"
                  value={`${health.uptime.toFixed(1)}%`}
                  status={health.uptime > 95 ? 'good' : health.uptime > 90 ? 'warning' : 'error'}
                />
                <HealthMetric
                  label="Response"
                  value={`${Math.round(health.responseTime)}ms`}
                  status={health.responseTime < 200 ? 'good' : health.responseTime < 500 ? 'warning' : 'error'}
                />
                <HealthMetric
                  label="Error Rate"
                  value={`${health.errorRate.toFixed(1)}%`}
                  status={health.errorRate < 1 ? 'good' : health.errorRate < 5 ? 'warning' : 'error'}
                />
                <HealthMetric
                  label="Incidents"
                  value={health.incidents.toString()}
                  status={health.incidents === 0 ? 'good' : health.incidents < 2 ? 'warning' : 'error'}
                />
              </div>

              {/* Service Status */}
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  paddingTop: '12px',
                  borderTop: `1px solid ${colors.outlineVariant}`,
                }}
              >
                <ServiceIndicator
                  label="API"
                  healthy={health.details.apiHealth}
                />
                <ServiceIndicator
                  label="Auth"
                  healthy={health.details.authHealth}
                />
                <ServiceIndicator
                  label="Rate"
                  healthy={health.details.rateLimitHealth}
                />
                <ServiceIndicator
                  label="Data"
                  healthy={health.details.dataFlowHealth}
                />
              </div>
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
      `}</style>
    </div>
  );
}

// Helper component for metric cards
function MetricCard({ icon, label, value, color }: any) {
  const { theme } = useTheme();
  const colors = theme.colors;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px',
        backgroundColor: colors.surface,
        borderRadius: '8px',
        border: `1px solid ${colors.outlineVariant}`,
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceVariant,
          borderRadius: '8px',
          color,
        }}
      >
        {React.cloneElement(icon, { style: { width: '20px', height: '20px' } })}
      </div>
      <div>
        <div
          style={{
            ...theme.typography?.labelSmall,
            color: colors.onSurfaceVariant,
            opacity: 0.8,
          }}
        >
          {label}
        </div>
        <div
          style={{
            ...theme.typography?.titleMedium,
            color: colors.onSurface,
            fontWeight: 600,
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

// Helper component for health metrics
function HealthMetric({ label, value, status }: any) {
  const { theme } = useTheme();
  const colors = theme.colors;

  const statusColor = status === 'good' ? '#10b981' : status === 'warning' ? colors.warning : colors.error;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        padding: '8px',
        backgroundColor: colors.surfaceVariant,
        borderRadius: '6px',
      }}
    >
      <div
        style={{
          ...theme.typography?.labelSmall,
          color: colors.onSurfaceVariant,
          opacity: 0.8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          ...theme.typography?.labelMedium,
          color: statusColor,
          fontWeight: 600,
        }}
      >
        {value}
      </div>
    </div>
  );
}

// Helper component for service indicators
function ServiceIndicator({ label, healthy }: any) {
  const { theme } = useTheme();
  const colors = theme.colors;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
      }}
    >
      <div
        style={{
          width: '8px',
          height: '8px',
          backgroundColor: healthy ? '#10b981' : colors.error,
          borderRadius: '50%',
        }}
      />
      <div
        style={{
          ...theme.typography?.labelSmall,
          color: colors.onSurfaceVariant,
          fontSize: '10px',
        }}
      >
        {label}
      </div>
    </div>
  );
}

export default HealthDashboard;