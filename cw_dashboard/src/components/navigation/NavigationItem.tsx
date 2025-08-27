/**
 * Navigation Item Component
 * Individual navigation menu item with full interaction states
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useNavigationTheme } from '../../design-system/themes/themeProvider';
import { NavigationItemProps, NavigationMode } from './types';
import { ChevronRightIcon } from '@heroicons/react/24/outline';

export function NavigationItem({
  item,
  mode,
  isActive = false,
  level = 0,
  showLabel = true,
  showTooltip = false,
  onClick,
  onHover,
  onFocus,
  className = '',
  a11yLabel,
}: NavigationItemProps) {
  const { itemStates, typography, spacing, layout, motion, mode: themeMode } = useNavigationTheme();
  
  // Safe access to theme item states with fallbacks
  const safeItemStates = itemStates || {};
  const currentModeStates = safeItemStates[themeMode] || safeItemStates['light'] || {};
  
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showTooltipState, setShowTooltipState] = useState(false);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout>();
  const itemRef = useRef<HTMLElement>(null);

  // Determine if we should show the label based on mode
  const shouldShowLabel = mode !== 'rail' && showLabel;
  const shouldShowTooltip = mode === 'rail' && !item.children;

  // Get current state styles
  const getItemStyles = () => {
    const baseStyles = currentModeStates.default || {};
    let currentStyles = { ...baseStyles };

    if (item.disabled) {
      currentStyles = {
        ...currentModeStates.disabled || {},
        cursor: 'not-allowed',
      };
    } else if (isActive) {
      currentStyles = currentModeStates.active || {};
    } else if (isFocused) {
      currentStyles = currentModeStates.focused || {};
    } else if (isHovered) {
      currentStyles = currentModeStates.hover || {};
    }

    return currentStyles;
  };

  // Handle hover state
  const handleMouseEnter = () => {
    if (!item.disabled) {
      setIsHovered(true);
      if (onHover) onHover(item);

      // Show tooltip after delay in rail mode
      if (shouldShowTooltip) {
        tooltipTimeoutRef.current = setTimeout(() => {
          setShowTooltipState(true);
        }, 500);
      }
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (onHover) onHover(null);

    // Hide tooltip
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    setShowTooltipState(false);
  };

  // Handle focus state
  const handleFocus = () => {
    if (!item.disabled) {
      setIsFocused(true);
      if (onFocus) onFocus(item);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (onFocus) onFocus(null);
  };

  // Handle click
  const handleClick = (event: React.MouseEvent) => {
    if (item.disabled) {
      event.preventDefault();
      return;
    }

    if (onClick) {
      onClick(item);
    }

    if (item.onClick) {
      event.preventDefault();
      item.onClick();
    }

    // Close modal on mobile after clicking
    if (mode === 'modal' && item.href) {
      // This would be handled by the parent modal component
    }
  };

  // Clean up tooltip timeout on unmount
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  const currentStyles = getItemStyles();

  // Calculate dimensions based on mode
  const itemHeight = mode === 'rail' ? layout?.rail?.itemHeight || '48px' : layout?.[mode]?.itemHeight || '48px';
  const iconSize = layout?.[mode]?.iconSize || '24px';
  const horizontalPadding = mode === 'rail' ? '12px' : spacing?.container?.[mode]?.itemPadding || '16px';

  // Base item styles
  const itemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    height: itemHeight,
    padding: `0 ${horizontalPadding}`,
    marginLeft: level > 0 ? `${level * 24}px` : 0,
    marginBottom: spacing?.container?.[mode]?.itemGap || '4px',
    backgroundColor: currentStyles.background,
    color: currentStyles.color,
    borderRadius: '8px',
    cursor: item.disabled ? 'not-allowed' : 'pointer',
    textDecoration: 'none',
    border: 'none',
    width: '100%',
    position: 'relative',
    opacity: item.disabled ? currentStyles.opacity : 1,
    transition: `all ${motion?.item?.hover?.duration || '200ms'} ${motion?.item?.hover?.easing || 'ease'}`,
    outline: isFocused ? `2px solid ${currentStyles.outline}` : 'none',
    outlineOffset: '-2px',
    justifyContent: mode === 'rail' ? 'center' : 'flex-start',
    gap: shouldShowLabel ? spacing?.item?.iconToText || '12px' : 0,
  };

  // Icon component
  const IconComponent = () => {
    if (typeof item.icon === 'string') {
      // If icon is a string, render it as text (emoji or character)
      return (
        <span
          style={{
            fontSize: iconSize,
            width: iconSize,
            height: iconSize,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: currentStyles.icon,
          }}
        >
          {item.icon}
        </span>
      );
    }

    // If icon is a React component
    const Icon = item.icon as React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    return (
      <Icon
        className={`nav-item-icon`}
        style={{
          width: iconSize,
          height: iconSize,
          flexShrink: 0,
          color: currentStyles.icon,
        }}
      />
    );
  };

  // Badge component
  const BadgeComponent = () => {
    if (!item.badge) return null;

    const badgeColors = {
      primary: { bg: 'rgb(193, 83, 1)', text: 'white' },
      error: { bg: 'rgb(239, 68, 68)', text: 'white' },
      warning: { bg: 'rgb(245, 158, 11)', text: 'white' },
      success: { bg: 'rgb(34, 197, 94)', text: 'white' },
      info: { bg: 'rgb(59, 130, 246)', text: 'white' },
    };

    const colors = badgeColors[item.badge.color || 'primary'];

    return (
      <span
        className={`nav-item-badge ${item.badge.pulse ? 'pulse' : ''}`}
        style={{
          position: 'absolute',
          top: mode === 'rail' ? '8px' : '50%',
          right: mode === 'rail' ? '8px' : '16px',
          transform: mode === 'rail' ? 'none' : 'translateY(-50%)',
          backgroundColor: colors.bg,
          color: colors.text,
          ...(typography?.badge || {}),
          padding: '2px 6px',
          borderRadius: '12px',
          minWidth: '20px',
          textAlign: 'center',
          animation: item.badge?.pulse ? `pulse ${motion?.badge?.pulse?.duration || '2s'} ${motion?.badge?.pulse?.easing || 'ease-in-out'} infinite` : undefined,
        }}
      >
        {item.badge.count || item.badge.text}
      </span>
    );
  };

  // Tooltip component (for rail mode)
  const TooltipComponent = () => {
    if (!shouldShowTooltip || !showTooltipState) return null;

    return (
      <div
        className="nav-item-tooltip"
        style={{
          position: 'absolute',
          left: '100%',
          top: '50%',
          transform: 'translateY(-50%)',
          marginLeft: '12px',
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          color: 'white',
          ...(typography?.tooltip || {}),
          padding: '6px 12px',
          borderRadius: '6px',
          whiteSpace: 'nowrap',
          zIndex: 1000,
          pointerEvents: 'none',
          opacity: showTooltipState ? 1 : 0,
          transition: `opacity ${motion?.tooltip?.show?.duration || '200ms'} ${motion?.tooltip?.show?.easing || 'ease'}`,
        }}
      >
        {item.label}
        {item.description && (
          <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>
            {item.description}
          </div>
        )}
      </div>
    );
  };

  // Content wrapper
  const ItemContent = () => (
    <>
      <IconComponent />
      {shouldShowLabel && (
        <span
          style={{
            ...(typography?.item?.primary || {}),
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.label}
        </span>
      )}
      {item.children && shouldShowLabel && (
        <ChevronRightIcon
          style={{
            width: '16px',
            height: '16px',
            color: currentStyles.icon,
            transform: isActive ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 200ms ease',
          }}
        />
      )}
      <BadgeComponent />
      <TooltipComponent />
    </>
  );

  // Render as Link or button based on href
  if (item.href && !item.external) {
    return (
      <Link
        ref={itemRef as any}
        href={item.href}
        className={`nav-item nav-item-${mode} ${isActive ? 'active' : ''} ${className}`}
        style={itemStyle}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        aria-label={a11yLabel || item.label}
        aria-current={isActive ? 'page' : undefined}
        aria-disabled={item.disabled}
      >
        <ItemContent />
      </Link>
    );
  }

  // External link
  if (item.href && item.external) {
    return (
      <a
        ref={itemRef as any}
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={`nav-item nav-item-${mode} ${isActive ? 'active' : ''} ${className}`}
        style={itemStyle}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        aria-label={a11yLabel || item.label}
        aria-disabled={item.disabled}
      >
        <ItemContent />
      </a>
    );
  }

  // Button for items without href
  return (
    <button
      ref={itemRef as any}
      className={`nav-item nav-item-${mode} ${isActive ? 'active' : ''} ${className}`}
      style={itemStyle}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      aria-label={a11yLabel || item.label}
      aria-current={isActive ? 'page' : undefined}
      aria-disabled={item.disabled}
      disabled={item.disabled}
    >
      <ItemContent />
    </button>
  );
}

export default NavigationItem;