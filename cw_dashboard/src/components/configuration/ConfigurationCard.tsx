/**
 * Configuration Card Component
 * Material Design 3 card displaying platform configuration status
 * with connection indicators, actions, and theme integration
 */

'use client';

import React, { useState } from 'react';
import { useTheme } from '../../design-system/themes/themeProvider';
import { ConfigurationCardProps } from './types';
import { getPlatformInfo, getHealthStatusInfo, formatRelativeTime } from './utils';
import {
  Cog6ToothIcon,
  PlayIcon,
  PencilIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

export function ConfigurationCard({
  platform,
  title,
  description,
  status,
  onConfigure,
  onTest,
  onEdit,
  onDelete,
  className = '',
  showActions = true,
  isLoading = false,
}: ConfigurationCardProps) {
  const { theme, resolvedMode } = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  const [actionHover, setActionHover] = useState<string | null>(null);

  const platformInfo = getPlatformInfo(platform);
  
  // Provide default values for status if undefined
  const safeStatus = status || {
    platform,
    configured: false,
    connected: false,
    healthy: false,
    message: 'Status unavailable'
  };
  
  // Map ConnectionStatus to HealthStatus
  const healthStatus: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN' = 
    !safeStatus.configured ? 'UNKNOWN' :
    safeStatus.healthy && safeStatus.connected ? 'HEALTHY' :
    safeStatus.connected ? 'DEGRADED' : 'UNHEALTHY';
  
  const healthInfo = getHealthStatusInfo(healthStatus);

  // Theme colors
  const colors = theme.colors;
  const isDark = resolvedMode === 'dark';

  // Card styles
  const cardStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: isDark ? colors.surface : colors.surface,
    border: `1px solid ${colors.outlineVariant}`,
    borderRadius: theme.components?.card?.borderRadius || '12px',
    padding: theme.spacing?.container?.md || '24px',
    transition: `all ${theme.motion?.duration?.medium2 || '200ms'} ${theme.motion?.easing?.standard || 'ease'}`,
    cursor: 'pointer',
    boxShadow: isHovered 
      ? theme.elevation?.level2 || '0 2px 8px rgba(0,0,0,0.1)' 
      : theme.elevation?.level1 || '0 1px 3px rgba(0,0,0,0.05)',
    transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
    minHeight: '180px',
    maxWidth: '400px',
    width: '100%',
  };

  // Status indicator styles
  const statusIndicatorStyle: React.CSSProperties = {
    position: 'absolute',
    top: '16px',
    right: '16px',
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: healthInfo.color,
    boxShadow: `0 0 0 2px ${isDark ? colors.surface : colors.surface}`,
    animation: healthStatus === 'DEGRADED' ? 'pulse 2s infinite' : undefined,
  };

  // Platform header styles
  const platformHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing?.component?.sm || '12px',
    marginBottom: theme.spacing?.component?.md || '16px',
  };

  const platformIconStyle: React.CSSProperties = {
    fontSize: '24px',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: platformInfo.color + '20',
    borderRadius: '8px',
    color: platformInfo.color,
  };

  const titleStyle: React.CSSProperties = {
    ...theme.typography?.headlineSmall,
    color: colors.onSurface,
    margin: 0,
    fontWeight: 600,
  };

  const descriptionStyle: React.CSSProperties = {
    ...theme.typography?.bodyMedium,
    color: colors.onSurfaceVariant,
    margin: 0,
    opacity: 0.8,
  };

  // Status section styles
  const statusSectionStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing?.component?.xs || '8px',
    marginBottom: theme.spacing?.component?.lg || '20px',
    flex: 1,
  };

  const statusRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing?.component?.sm || '12px',
  };

  const statusIconStyle: React.CSSProperties = {
    width: '16px',
    height: '16px',
    color: healthInfo.color,
  };

  const statusTextStyle: React.CSSProperties = {
    ...theme.typography?.bodySmall,
    color: colors.onSurfaceVariant,
    flex: 1,
  };

  const statusValueStyle: React.CSSProperties = {
    ...theme.typography?.labelMedium,
    color: colors.onSurface,
    fontWeight: 500,
  };

  // Actions section styles
  const actionsStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing?.component?.sm || '12px',
    paddingTop: theme.spacing?.component?.md || '16px',
    borderTop: `1px solid ${colors.outlineVariant}`,
  };

  const actionButtonStyle = (action: string, variant: 'primary' | 'secondary' | 'danger' = 'secondary'): React.CSSProperties => {
    const isHovered = actionHover === action;
    
    const variants = {
      primary: {
        backgroundColor: isHovered ? colors.primaryContainer : 'transparent',
        color: colors.primary,
        border: `1px solid ${colors.primary}`,
      },
      secondary: {
        backgroundColor: isHovered ? colors.surfaceVariant : 'transparent',
        color: colors.onSurfaceVariant,
        border: `1px solid ${colors.outlineVariant}`,
      },
      danger: {
        backgroundColor: isHovered ? colors.errorContainer : 'transparent',
        color: colors.error,
        border: `1px solid ${colors.error}`,
      },
    };

    return {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '8px 12px',
      borderRadius: '8px',
      cursor: 'pointer',
      transition: `all ${theme.motion?.duration?.short2 || '150ms'} ${theme.motion?.easing?.standard || 'ease'}`,
      ...variants[variant],
      transform: isHovered ? 'scale(1.05)' : 'scale(1)',
    };
  };

  // Status icon component
  const StatusIcon = () => {
    switch (healthStatus) {
      case 'HEALTHY':
        return <CheckCircleIcon style={statusIconStyle} />;
      case 'DEGRADED':
        return <ExclamationTriangleIcon style={statusIconStyle} />;
      case 'UNHEALTHY':
        return <XCircleIcon style={statusIconStyle} />;
      default:
        return <ClockIcon style={statusIconStyle} />;
    }
  };

  return (
    <div
      className={`configuration-card configuration-card-${platform.toLowerCase()} ${className}`}
      style={cardStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={!safeStatus.configured ? onConfigure : undefined}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (!safeStatus.configured) onConfigure();
        }
      }}
      aria-label={`${title} configuration card`}
      data-testid={`config-card-${platform.toLowerCase()}`}
    >
      {/* Status Indicator */}
      <div style={statusIndicatorStyle} aria-hidden="true" />

      {/* Loading Overlay */}
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: theme.components?.card?.borderRadius || '12px',
            zIndex: 10,
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              border: `3px solid ${colors.outlineVariant}`,
              borderTop: `3px solid ${colors.primary}`,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
        </div>
      )}

      {/* Platform Header */}
      <div style={platformHeaderStyle}>
        <div style={platformIconStyle}>
          {platformInfo.icon}
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={titleStyle}>{title}</h3>
          <p style={descriptionStyle}>{description}</p>
        </div>
      </div>

      {/* Status Section */}
      <div style={statusSectionStyle}>
        <div style={statusRowStyle}>
          <StatusIcon />
          <span style={statusTextStyle}>Status</span>
          <span style={statusValueStyle}>
            {safeStatus.configured ? healthInfo.label : 'Not configured'}
          </span>
        </div>

        {safeStatus.configured && (
          <>
            <div style={statusRowStyle}>
              <div style={{ ...statusIconStyle, backgroundColor: safeStatus.connected ? '#10b981' : '#ef4444', borderRadius: '50%' }} />
              <span style={statusTextStyle}>Connection</span>
              <span style={statusValueStyle}>
                {safeStatus.connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {safeStatus.lastCheck && (
              <div style={statusRowStyle}>
                <ClockIcon style={statusIconStyle} />
                <span style={statusTextStyle}>Last Check</span>
                <span style={statusValueStyle}>
                  {formatRelativeTime(safeStatus.lastCheck)}
                </span>
              </div>
            )}
          </>
        )}

        {safeStatus.message && (
          <div style={{
            ...theme.typography?.bodySmall,
            color: healthStatus === 'HEALTHY' ? colors.onSurfaceVariant : healthInfo.color,
            backgroundColor: healthInfo.bgColor,
            padding: '8px 12px',
            borderRadius: '6px',
            marginTop: theme.spacing?.component?.sm || '8px',
            border: `1px solid ${healthInfo.color}20`,
          }}>
            {safeStatus.message}
          </div>
        )}
      </div>

      {/* Actions Section */}
      {showActions && (
        <div style={actionsStyle}>
          {!safeStatus.configured ? (
            <button
              style={actionButtonStyle('configure', 'primary')}
              onClick={(e) => {
                e.stopPropagation();
                onConfigure();
              }}
              onMouseEnter={() => setActionHover('configure')}
              onMouseLeave={() => setActionHover(null)}
              aria-label={`Configure ${title}`}
            >
              <Cog6ToothIcon style={{ width: '16px', height: '16px', marginRight: '6px' }} />
              Configure
            </button>
          ) : (
            <>
              {onTest && (
                <button
                  style={actionButtonStyle('test')}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTest();
                  }}
                  onMouseEnter={() => setActionHover('test')}
                  onMouseLeave={() => setActionHover(null)}
                  aria-label={`Test ${title} connection`}
                >
                  <PlayIcon style={{ width: '16px', height: '16px' }} />
                </button>
              )}

              {onEdit && (
                <button
                  style={actionButtonStyle('edit')}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  onMouseEnter={() => setActionHover('edit')}
                  onMouseLeave={() => setActionHover(null)}
                  aria-label={`Edit ${title} configuration`}
                >
                  <PencilIcon style={{ width: '16px', height: '16px' }} />
                </button>
              )}

              {onDelete && (
                <button
                  style={actionButtonStyle('delete', 'danger')}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  onMouseEnter={() => setActionHover('delete')}
                  onMouseLeave={() => setActionHover(null)}
                  aria-label={`Delete ${title} configuration`}
                >
                  <TrashIcon style={{ width: '16px', height: '16px' }} />
                </button>
              )}
            </>
          )}
        </div>
      )}

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
        
        .configuration-card:focus {
          outline: 2px solid ${colors.primary};
          outline-offset: 2px;
        }
        
        .configuration-card:focus:not(:focus-visible) {
          outline: none;
        }
      `}</style>
    </div>
  );
}

export default ConfigurationCard;