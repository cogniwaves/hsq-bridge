/**
 * Enhanced Navigation Item Component
 * Advanced navigation item with animations, badges, tooltips, and accessibility
 */

'use client';

import React, { forwardRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useNavigationTheme } from '../../design-system/themes/themeProvider';
import { NavigationItemProps, NavigationItem, NavigationMode } from './types';
import { EnhancedBadge } from '../../hooks/useBadges';

export interface EnhancedNavigationItemProps extends Omit<NavigationItemProps, 'onHover' | 'onFocus'> {
  /** Enhanced badges */
  badges?: EnhancedBadge[];
  /** Enable animations */
  enableAnimations?: boolean;
  /** Animation duration */
  animationDuration?: number;
  /** Show badge */
  showBadge?: boolean;
  /** Badge click handler */
  onBadgeClick?: (badgeId: string, itemId: string) => void;
  /** Mouse enter handler */
  onMouseEnter?: (item: NavigationItem, element: HTMLElement) => void;
  /** Mouse leave handler */
  onMouseLeave?: (item: NavigationItem, element: HTMLElement) => void;
  /** Focus handler */
  onFocus?: (item: NavigationItem) => void;
  /** Blur handler */
  onBlur?: (item: NavigationItem) => void;
  /** Loading state */
  isLoading?: boolean;
  /** Custom icon component */
  customIcon?: React.ReactNode;
  /** Icon animation */
  iconAnimation?: 'none' | 'pulse' | 'rotate' | 'bounce';
}

const EnhancedNavigationItem = forwardRef<HTMLElement, EnhancedNavigationItemProps>(({
  item,
  mode,
  isActive = false,
  isHovered = false,
  isFocused = false,
  level = 0,
  showLabel = true,
  showTooltip = false,
  showBadge = true,
  badges = [],
  enableAnimations = true,
  animationDuration = 300,
  className = '',
  onBadgeClick,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  onClick,
  isLoading = false,
  customIcon,
  iconAnimation = 'none',
  a11yLabel,
}, ref) => {
  const { surfaces, spacing, typography } = useNavigationTheme();

  // Get item surfaces based on mode - use fallback values
  const itemSurfaces = surfaces?.[mode] || {};

  // Determine if item should be rendered as a link or button
  const isLink = !!item.href && !item.onClick;
  const isExternal = item.external || (item.href && item.href.startsWith('http'));

  // Calculate indentation for nested items
  const indentLevel = level * 16;

  // Get icon component
  const IconComponent = useMemo(() => {
    if (customIcon) return () => customIcon;
    if (!item.icon) return null;
    
    if (typeof item.icon === 'string') {
      // If it's a string, assume it's an icon name - you'd need to map this to actual icons
      return null; // Could implement icon mapping here
    }
    
    return item.icon as React.ComponentType<any>;
  }, [item.icon, customIcon]);

  // Handle click events
  const handleClick = useCallback((event: React.MouseEvent) => {
    if (item.disabled || isLoading) {
      event.preventDefault();
      return;
    }

    if (item.onClick) {
      event.preventDefault();
      item.onClick();
    }

    onClick?.(item, event);
  }, [item, onClick, isLoading]);

  // Handle mouse events
  const handleMouseEnter = useCallback((event: React.MouseEvent<HTMLElement>) => {
    onMouseEnter?.(item, event.currentTarget);
  }, [item, onMouseEnter]);

  const handleMouseLeave = useCallback((event: React.MouseEvent<HTMLElement>) => {
    onMouseLeave?.(item, event.currentTarget);
  }, [item, onMouseLeave]);

  // Handle focus events
  const handleFocus = useCallback(() => {
    onFocus?.(item);
  }, [item, onFocus]);

  const handleBlur = useCallback(() => {
    onBlur?.(item);
  }, [item, onBlur]);

  // Handle badge clicks
  const handleBadgeClick = useCallback((badgeId: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onBadgeClick?.(badgeId, item.id);
  }, [item.id, onBadgeClick]);

  // Generate styles based on state and mode
  const itemStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    minHeight: '48px',
    padding: mode === 'rail' ? '12px' : '8px 16px',
    paddingLeft: mode !== 'rail' ? `${16 + indentLevel}px` : undefined,
    backgroundColor: isActive 
      ? 'rgba(255, 107, 53, 0.12)'
      : isHovered 
        ? 'rgba(255, 107, 53, 0.04)'
        : 'transparent',
    color: isActive 
      ? 'var(--color-primary, #FF6B35)'
      : 'var(--color-on-surface, #000000)',
    borderRadius: '12px',
    border: 'none',
    textDecoration: 'none',
    cursor: item.disabled || isLoading ? 'not-allowed' : 'pointer',
    opacity: item.disabled ? 0.5 : 1,
    transition: enableAnimations 
      ? `all ${animationDuration}ms ease, transform 150ms ease` 
      : 'none',
    transform: isActive && enableAnimations ? 'scale(1.02)' : 'scale(1)',
    position: 'relative',
    overflow: 'hidden',
    justifyContent: mode === 'rail' ? 'center' : 'flex-start',
    fontFamily: 'inherit',
    fontSize: '14px',
    fontWeight: isActive ? 600 : 500,
    outline: 'none',
    boxShadow: isFocused 
      ? '0 0 0 2px rgba(255, 107, 53, 0.5)' 
      : isActive && enableAnimations 
        ? '0 2px 8px rgba(255, 107, 53, 0.2)' 
        : 'none',
  };

  // Icon styles
  const iconStyles: React.CSSProperties = {
    width: '24px',
    height: '24px',
    marginRight: showLabel && mode !== 'rail' ? '12px' : 0,
    flexShrink: 0,
    transition: enableAnimations ? `all ${animationDuration}ms ease` : 'none',
    animation: enableAnimations && iconAnimation !== 'none' 
      ? `nav-icon-${iconAnimation} ${animationDuration}ms ease` 
      : 'none',
  };

  // Label styles
  const labelStyles: React.CSSProperties = {
    flex: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    transition: enableAnimations ? `opacity ${animationDuration}ms ease` : 'none',
    opacity: showLabel ? 1 : 0,
  };

  // Badge container styles
  const badgeContainerStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginLeft: mode !== 'rail' ? 'auto' : 0,
    position: mode === 'rail' ? 'absolute' : 'relative',
    top: mode === 'rail' ? '4px' : 'auto',
    right: mode === 'rail' ? '4px' : 'auto',
  };

  // Render badge
  const renderBadge = (badge: EnhancedBadge, index: number) => {
    const badgeStyles: React.CSSProperties = {
      minWidth: '20px',
      height: '20px',
      borderRadius: '10px',
      backgroundColor: getBadgeColor(badge.color || 'primary'),
      color: 'white',
      fontSize: '11px',
      fontWeight: '600',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 6px',
      cursor: badge.onClick || onBadgeClick ? 'pointer' : 'default',
      transition: enableAnimations ? 'all 200ms ease' : 'none',
      animation: enableAnimations && badge.pulse 
        ? `nav-badge-pulse ${animationDuration}ms ease infinite` 
        : 'none',
      transform: 'scale(1)',
    };

    return (
      <div
        key={badge.id}
        className={`nav-badge nav-badge--${badge.type} ${badge.className || ''}`}
        style={badgeStyles}
        onClick={(e) => handleBadgeClick(badge.id, e)}
        aria-label={badge.ariaLabel || `${badge.text || badge.count} notification`}
        onMouseEnter={(e) => {
          if (enableAnimations) {
            e.currentTarget.style.transform = 'scale(1.1)';
          }
        }}
        onMouseLeave={(e) => {
          if (enableAnimations) {
            e.currentTarget.style.transform = 'scale(1)';
          }
        }}
      >
        {badge.text || badge.count}
      </div>
    );
  };

  // Get badge color
  function getBadgeColor(color: string): string {
    const colors = {
      primary: '#FF6B35',
      error: '#DC2626',
      warning: '#F59E0B',
      success: '#10B981',
      info: '#3B82F6',
    };
    return colors[color as keyof typeof colors] || colors.primary;
  }

  // Loading spinner
  const LoadingSpinner = () => (
    <div
      className="nav-item-loading"
      style={{
        width: '16px',
        height: '16px',
        border: '2px solid currentColor',
        borderTop: '2px solid transparent',
        borderRadius: '50%',
        animation: 'nav-loading-spin 1s linear infinite',
        marginRight: showLabel ? '8px' : 0,
      }}
    />
  );

  // Create the content
  const content = (
    <>
      {/* Loading state or icon */}
      {isLoading ? (
        <LoadingSpinner />
      ) : IconComponent ? (
        <IconComponent style={iconStyles} />
      ) : null}

      {/* Label */}
      {showLabel && (
        <span style={labelStyles}>
          {item.label}
        </span>
      )}

      {/* Badges */}
      {showBadge && badges.length > 0 && (
        <div style={badgeContainerStyles}>
          {badges.slice(0, 3).map(renderBadge)}
        </div>
      )}

      {/* Ripple effect container */}
      {enableAnimations && (
        <div
          className="nav-item-ripple-container"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
            borderRadius: 'inherit',
            overflow: 'hidden',
          }}
        />
      )}
    </>
  );

  // Common props for both link and button
  const commonProps = {
    ref,
    className: `nav-item nav-item--${mode} nav-item--level-${level} ${isActive ? 'nav-item--active' : ''} ${isHovered ? 'nav-item--hovered' : ''} ${isFocused ? 'nav-item--focused' : ''} ${item.disabled ? 'nav-item--disabled' : ''} ${className}`,
    style: itemStyles,
    onClick: handleClick,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onFocus: handleFocus,
    onBlur: handleBlur,
    'aria-label': a11yLabel || item.description || item.label,
    'aria-current': isActive ? 'page' : undefined,
    'aria-disabled': item.disabled || isLoading,
    'data-item-id': item.id,
    'data-level': level,
    tabIndex: item.disabled ? -1 : 0,
  };

  // Render as link or button
  if (isLink) {
    const linkProps = {
      href: item.href!,
      target: isExternal ? '_blank' : undefined,
      rel: isExternal ? 'noopener noreferrer' : undefined,
    };

    return (
      <Link {...linkProps} {...commonProps}>
        {content}
      </Link>
    );
  }

  return (
    <button {...commonProps}>
      {content}
    </button>
  );
});

EnhancedNavigationItem.displayName = 'EnhancedNavigationItem';

export default EnhancedNavigationItem;