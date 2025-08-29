/**
 * Token Health Monitor Component
 * Real-time monitoring of OAuth token status and health
 * Automatic refresh detection and expiration warnings
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../../design-system/themes/themeProvider';
import { Platform } from './types';
import { getPlatformInfo } from './utils';
import {
  KeyIcon,
  ShieldCheckIcon,
  ClockIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  SignalIcon,
  BoltIcon,
  InformationCircleIcon,
  LockClosedIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';

interface TokenInfo {
  platform: Platform;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  issuedAt?: Date;
  scopes?: string[];
  tokenType?: string;
  realmId?: string; // QuickBooks specific
  companyName?: string;
}

interface TokenHealthMonitorProps {
  tokens: TokenInfo[];
  checkInterval?: number; // Seconds between health checks
  onRefreshRequired?: (platform: Platform) => Promise<boolean>;
  onTokenExpired?: (platform: Platform) => void;
  showDetails?: boolean;
  autoRefresh?: boolean;
  className?: string;
}

interface TokenHealth {
  platform: Platform;
  status: 'healthy' | 'warning' | 'critical' | 'expired' | 'refreshing';
  message: string;
  expiresIn?: number; // Seconds until expiration
  lastChecked: Date;
  refreshAttempts: number;
  details: {
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    isExpired: boolean;
    canRefresh: boolean;
    scopesValid: boolean;
  };
}

export function TokenHealthMonitor({
  tokens,
  checkInterval = 60,
  onRefreshRequired,
  onTokenExpired,
  showDetails = true,
  autoRefresh = true,
  className = '',
}: TokenHealthMonitorProps) {
  const { theme, resolvedMode } = useTheme();
  const colors = theme.colors;
  const isDark = resolvedMode === 'dark';

  const [tokenHealthMap, setTokenHealthMap] = useState<Map<Platform, TokenHealth>>(new Map());
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate token health status
  const calculateTokenHealth = useCallback((token: TokenInfo): TokenHealth => {
    const now = new Date();
    const expiresAt = token.expiresAt ? new Date(token.expiresAt) : null;
    const expiresIn = expiresAt ? Math.floor((expiresAt.getTime() - now.getTime()) / 1000) : null;
    
    let status: TokenHealth['status'] = 'healthy';
    let message = 'Token is valid and healthy';

    const details = {
      hasAccessToken: !!token.accessToken,
      hasRefreshToken: !!token.refreshToken,
      isExpired: expiresIn !== null && expiresIn <= 0,
      canRefresh: !!token.refreshToken,
      scopesValid: token.scopes ? token.scopes.length > 0 : true,
    };

    // Determine status based on expiration
    if (details.isExpired) {
      status = 'expired';
      message = 'Token has expired';
    } else if (expiresIn !== null) {
      if (expiresIn < 300) { // Less than 5 minutes
        status = 'critical';
        message = `Token expires in ${Math.floor(expiresIn / 60)} minutes`;
      } else if (expiresIn < 3600) { // Less than 1 hour
        status = 'warning';
        message = `Token expires in ${Math.floor(expiresIn / 60)} minutes`;
      } else if (expiresIn < 86400) { // Less than 1 day
        message = `Token expires in ${Math.floor(expiresIn / 3600)} hours`;
      } else {
        message = `Token expires in ${Math.floor(expiresIn / 86400)} days`;
      }
    }

    // Check for missing components
    if (!details.hasAccessToken) {
      status = 'critical';
      message = 'Missing access token';
    }

    if (!details.scopesValid) {
      status = 'warning';
      message = 'Invalid or missing scopes';
    }

    return {
      platform: token.platform,
      status,
      message,
      expiresIn: expiresIn || undefined,
      lastChecked: now,
      refreshAttempts: 0,
      details,
    };
  }, []);

  // Check all tokens health
  const checkTokensHealth = useCallback(async () => {
    const newHealthMap = new Map<Platform, TokenHealth>();

    for (const token of tokens) {
      const health = calculateTokenHealth(token);
      const previousHealth = tokenHealthMap.get(token.platform);

      // Handle automatic refresh if needed
      if (autoRefresh && health.status === 'critical' && health.details.canRefresh) {
        if (onRefreshRequired) {
          health.status = 'refreshing';
          health.message = 'Refreshing token...';
          newHealthMap.set(token.platform, health);

          try {
            const success = await onRefreshRequired(token.platform);
            if (success) {
              health.status = 'healthy';
              health.message = 'Token refreshed successfully';
              health.refreshAttempts = 0;
            } else {
              health.status = 'critical';
              health.message = 'Token refresh failed';
              health.refreshAttempts = (previousHealth?.refreshAttempts || 0) + 1;
            }
          } catch (error) {
            health.status = 'critical';
            health.message = 'Token refresh error';
            health.refreshAttempts = (previousHealth?.refreshAttempts || 0) + 1;
          }
        }
      }

      // Notify about expired tokens
      if (health.status === 'expired' && previousHealth?.status !== 'expired') {
        if (onTokenExpired) {
          onTokenExpired(token.platform);
        }
      }

      newHealthMap.set(token.platform, health);
    }

    setTokenHealthMap(newHealthMap);
  }, [tokens, tokenHealthMap, autoRefresh, onRefreshRequired, onTokenExpired, calculateTokenHealth]);

  // Start monitoring
  useEffect(() => {
    if (isMonitoring) {
      // Initial check
      checkTokensHealth();

      // Set up interval
      intervalRef.current = setInterval(checkTokensHealth, checkInterval * 1000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
  }, [isMonitoring, checkInterval, checkTokensHealth]);

  // Get status color
  const getStatusColor = (status: TokenHealth['status']) => {
    switch (status) {
      case 'healthy':
        return '#10b981';
      case 'warning':
        return colors.warning;
      case 'critical':
      case 'expired':
        return colors.error;
      case 'refreshing':
        return colors.primary;
      default:
        return colors.onSurfaceVariant;
    }
  };

  // Get status icon
  const getStatusIcon = (status: TokenHealth['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircleIcon />;
      case 'warning':
        return <ExclamationTriangleIcon />;
      case 'critical':
      case 'expired':
        return <XCircleIcon />;
      case 'refreshing':
        return <ArrowPathIcon style={{ animation: 'spin 1s linear infinite' }} />;
      default:
        return <InformationCircleIcon />;
    }
  };

  // Format time remaining
  const formatTimeRemaining = (seconds?: number) => {
    if (!seconds) return 'Unknown';
    
    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
    return `${Math.floor(seconds / 86400)} days`;
  };

  // Component styles
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing?.component?.md || '16px',
    padding: theme.spacing?.container?.lg || '24px',
    backgroundColor: colors.surface,
    borderRadius: theme.components?.card?.borderRadius || '12px',
    border: `1px solid ${colors.outlineVariant}`,
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing?.component?.sm || '8px',
  };

  const titleStyle: React.CSSProperties = {
    ...theme.typography?.headlineSmall,
    color: colors.onSurface,
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  };

  const tokenCardStyle: React.CSSProperties = {
    padding: theme.spacing?.container?.md || '16px',
    backgroundColor: colors.surfaceVariant,
    borderRadius: '8px',
    cursor: 'pointer',
    transition: `all ${theme.motion?.duration?.short2 || '150ms'} ${theme.motion?.easing?.standard || 'ease'}`,
  };

  return (
    <div
      className={`token-health-monitor ${className}`}
      style={containerStyle}
      data-testid="token-health-monitor"
    >
      {/* Header */}
      <div style={headerStyle}>
        <h3 style={titleStyle}>
          <KeyIcon style={{ width: '24px', height: '24px' }} />
          Token Health Monitor
        </h3>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setIsMonitoring(!isMonitoring)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              backgroundColor: isMonitoring ? colors.errorContainer : colors.primaryContainer,
              color: isMonitoring ? colors.onErrorContainer : colors.onPrimaryContainer,
              border: 'none',
              borderRadius: '6px',
              ...theme.typography?.labelSmall,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {isMonitoring ? (
              <>
                <SignalIcon style={{ width: '14px', height: '14px' }} />
                Monitoring
              </>
            ) : (
              <>
                <SignalIcon style={{ width: '14px', height: '14px' }} />
                Paused
              </>
            )}
          </button>

          <button
            onClick={checkTokensHealth}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              backgroundColor: 'transparent',
              color: colors.primary,
              border: `1px solid ${colors.primary}`,
              borderRadius: '6px',
              ...theme.typography?.labelSmall,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <ArrowPathIcon style={{ width: '14px', height: '14px' }} />
            Check Now
          </button>
        </div>
      </div>

      {/* Token Status Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: theme.spacing?.component?.md || '16px',
        }}
      >
        {tokens.map((token) => {
          const health = tokenHealthMap.get(token.platform);
          const platformInfo = getPlatformInfo(token.platform);
          const isSelected = selectedPlatform === token.platform;

          return (
            <div
              key={token.platform}
              style={{
                ...tokenCardStyle,
                transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                boxShadow: isSelected ? theme.elevation?.level2 : 'none',
              }}
              onClick={() => setSelectedPlatform(isSelected ? null : token.platform)}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      fontSize: '20px',
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
                    {token.companyName && (
                      <div
                        style={{
                          ...theme.typography?.labelSmall,
                          color: colors.onSurfaceVariant,
                          opacity: 0.7,
                        }}
                      >
                        {token.companyName}
                      </div>
                    )}
                  </div>
                </div>

                {health && (
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      color: getStatusColor(health.status),
                    }}
                  >
                    {getStatusIcon(health.status)}
                  </div>
                )}
              </div>

              {/* Status Message */}
              {health && (
                <div
                  style={{
                    padding: '8px',
                    backgroundColor: colors.surface,
                    borderRadius: '6px',
                    marginBottom: '12px',
                  }}
                >
                  <div
                    style={{
                      ...theme.typography?.bodySmall,
                      color: getStatusColor(health.status),
                      fontWeight: 500,
                    }}
                  >
                    {health.message}
                  </div>
                </div>
              )}

              {/* Quick Stats */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px',
                }}
              >
                <StatBadge
                  icon={<ClockIcon />}
                  label="Expires In"
                  value={health ? formatTimeRemaining(health.expiresIn) : 'Unknown'}
                  color={health ? getStatusColor(health.status) : colors.onSurfaceVariant}
                />
                <StatBadge
                  icon={<ShieldCheckIcon />}
                  label="Can Refresh"
                  value={health?.details.canRefresh ? 'Yes' : 'No'}
                  color={health?.details.canRefresh ? '#10b981' : colors.error}
                />
              </div>

              {/* Expanded Details */}
              {showDetails && isSelected && health && (
                <div
                  style={{
                    marginTop: '16px',
                    paddingTop: '16px',
                    borderTop: `1px solid ${colors.outlineVariant}`,
                  }}
                >
                  <h4
                    style={{
                      ...theme.typography?.labelMedium,
                      color: colors.onSurfaceVariant,
                      margin: 0,
                      marginBottom: '8px',
                    }}
                  >
                    Token Details
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <DetailRow
                      icon={<KeyIcon />}
                      label="Access Token"
                      value={health.details.hasAccessToken ? 'Present' : 'Missing'}
                      success={health.details.hasAccessToken}
                    />
                    <DetailRow
                      icon={<ArrowPathIcon />}
                      label="Refresh Token"
                      value={health.details.hasRefreshToken ? 'Present' : 'Missing'}
                      success={health.details.hasRefreshToken}
                    />
                    <DetailRow
                      icon={<LockClosedIcon />}
                      label="Scopes Valid"
                      value={health.details.scopesValid ? 'Yes' : 'No'}
                      success={health.details.scopesValid}
                    />
                    {token.issuedAt && (
                      <DetailRow
                        icon={<CalendarDaysIcon />}
                        label="Issued"
                        value={new Date(token.issuedAt).toLocaleString()}
                        success={true}
                      />
                    )}
                    {health.lastChecked && (
                      <DetailRow
                        icon={<ClockIcon />}
                        label="Last Check"
                        value={new Date(health.lastChecked).toLocaleTimeString()}
                        success={true}
                      />
                    )}
                    {health.refreshAttempts > 0 && (
                      <DetailRow
                        icon={<BoltIcon />}
                        label="Refresh Attempts"
                        value={health.refreshAttempts.toString()}
                        success={false}
                      />
                    )}
                  </div>

                  {/* Token Scopes */}
                  {token.scopes && token.scopes.length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      <h4
                        style={{
                          ...theme.typography?.labelSmall,
                          color: colors.onSurfaceVariant,
                          margin: 0,
                          marginBottom: '6px',
                          opacity: 0.7,
                        }}
                      >
                        Scopes
                      </h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {token.scopes.map((scope, idx) => (
                          <span
                            key={idx}
                            style={{
                              padding: '2px 8px',
                              backgroundColor: colors.primaryContainer,
                              color: colors.onPrimaryContainer,
                              borderRadius: '4px',
                              ...theme.typography?.labelSmall,
                              fontSize: '11px',
                            }}
                          >
                            {scope}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {tokens.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '40px',
            color: colors.onSurfaceVariant,
          }}
        >
          <KeyIcon
            style={{
              width: '48px',
              height: '48px',
              margin: '0 auto 16px',
              opacity: 0.5,
            }}
          />
          <div style={theme.typography?.bodyLarge}>No tokens to monitor</div>
          <div
            style={{
              ...theme.typography?.bodyMedium,
              opacity: 0.7,
              marginTop: '8px',
            }}
          >
            Configure OAuth connections to start monitoring token health
          </div>
        </div>
      )}

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

// Helper component for stat badges
function StatBadge({ icon, label, value, color }: any) {
  const { theme } = useTheme();
  const colors = theme.colors;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 8px',
        backgroundColor: colors.surface,
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
            fontSize: '10px',
          }}
        >
          {label}
        </div>
        <div
          style={{
            ...theme.typography?.labelSmall,
            color,
            fontWeight: 600,
            fontSize: '11px',
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
      <span
        style={{
          color: colors.onSurfaceVariant,
          opacity: 0.8,
        }}
      >
        {label}:
      </span>
      <span
        style={{
          color: success ? '#10b981' : colors.error,
          fontWeight: 500,
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default TokenHealthMonitor;