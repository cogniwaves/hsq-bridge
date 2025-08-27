/**
 * Enhanced Navigation Rail Component
 * Advanced navigation rail with tooltips, badges, animations, and smart behaviors
 */

'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigationTheme } from '../../design-system/themes/themeProvider';
import { useUserfrontAuth } from '../../contexts/UserfrontAuthContext';
import { useTooltips } from '../../hooks/useTooltips';
import { useBadges } from '../../hooks/useBadges';
import { useCollapsibleSections } from '../../hooks/useCollapsibleSections';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { useGestures } from '../../utils/gestures';
import { createRippleEffect, createHoverGlow, removeHoverGlow } from '../../utils/animations';
import { NavigationRailProps, NavigationItem } from './types';
import EnhancedNavigationItem from './EnhancedNavigationItem';
import EnhancedNavigationProfile from './EnhancedNavigationProfile';
import { Bars3Icon } from '@heroicons/react/24/outline';

export interface EnhancedNavigationRailProps extends NavigationRailProps {
  /** Enable advanced tooltips */
  enableTooltips?: boolean;
  /** Enable badge system */
  enableBadges?: boolean;
  /** Enable animations */
  enableAnimations?: boolean;
  /** Enable gesture support */
  enableGestures?: boolean;
  /** Enable keyboard navigation */
  enableKeyboardNavigation?: boolean;
  /** Show recent items section */
  showRecentItems?: boolean;
  /** Animation duration in ms */
  animationDuration?: number;
  /** Tooltip configuration */
  tooltipConfig?: {
    showDelay?: number;
    hideDelay?: number;
    position?: 'right' | 'left';
  };
  /** Badge click handler */
  onBadgeClick?: (badgeId: string, itemId: string) => void;
  /** Gesture handlers */
  onSwipeRight?: () => void;
  /** Accessibility enhancements */
  announcements?: {
    itemFocused?: (itemName: string) => void;
    itemActivated?: (itemName: string) => void;
    badgeUpdated?: (itemName: string, count: number) => void;
  };
}

export function EnhancedNavigationRail({
  className = '',
  config,
  activeItemId,
  onItemClick,
  onExpandClick,
  showExpandButton = true,
  enableTooltips = true,
  enableBadges = true,
  enableAnimations = true,
  enableGestures = true,
  enableKeyboardNavigation = true,
  showRecentItems = false,
  animationDuration = 300,
  tooltipConfig = {},
  onBadgeClick,
  onSwipeRight,
  announcements,
  a11yLabel = 'Enhanced main navigation',
}: EnhancedNavigationRailProps) {
  const { user } = useUserfrontAuth();
  const { surfaces, elevation, layout, spacing, zIndex, a11y, mode: themeMode } = useNavigationTheme();
  
  // Component refs
  const railRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map());
  
  // Component state
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  
  // Advanced hooks
  const {
    expandedSections,
    isSectionExpanded,
    toggleSection,
    getSectionAnimationProps,
  } = useCollapsibleSections({
    sections: config?.sections || [],
    navigationMode: 'rail',
    autoCollapseInRail: true,
    enableAnimations,
    animationDuration,
  });

  const {
    tooltipState,
    showItemTooltip,
    hideTooltip,
    tooltipRef,
    getTooltipProps,
  } = useTooltips({
    showDelay: tooltipConfig.showDelay || 500,
    hideDelay: tooltipConfig.hideDelay || 100,
    defaultPosition: tooltipConfig.position || 'right',
    keyboardTriggered: enableKeyboardNavigation,
    richContent: true,
  });

  const {
    badges,
    getBadges,
    getBadgeProps,
    hasBadges,
    getBadgeCount,
  } = useBadges({
    enableAnimations,
    animationDuration,
    announceChanges: true,
    onBadgeClick: onBadgeClick ? (badge, itemId) => onBadgeClick(badge.id, itemId) : undefined,
  });

  const keyboardNavigation = useKeyboardNavigation({
    sections: config?.sections || [],
    enableShortcuts: enableKeyboardNavigation,
    enableTypeAhead: false, // Disabled for rail mode
    onToggleNavigation: onExpandClick,
    onItemActivate: (item) => {
      onItemClick?.(item);
      announcements?.itemActivated?.(item.label);
    },
    onFocusChange: (itemId) => {
      setFocusedItemId(itemId);
      if (itemId) {
        const item = findItemById(itemId);
        if (item) {
          announcements?.itemFocused?.(item.label);
        }
      }
    },
  });

  // Gesture support
  const { gestureRecognizer } = useGestures(
    railRef,
    {
      onSwipe: (direction) => {
        if (direction === 'right' && onSwipeRight) {
          onSwipeRight();
        }
      },
      onTap: (data) => {
        // Handle tap on rail background
        if (data.distance < 10) {
          onExpandClick?.();
        }
      },
    },
    {
      swipeThreshold: 30,
      hapticFeedback: true,
    }
  );

  // Safe access to theme surfaces with fallbacks
  const railSurfaces = surfaces?.rail || {};
  const railElevation = elevation?.rail || {};

  // Find item by ID helper
  const findItemById = useCallback((itemId: string): NavigationItem | null => {
    const findInItems = (items: NavigationItem[]): NavigationItem | null => {
      for (const item of items) {
        if (item.id === itemId) return item;
        if (item.children) {
          const found = findInItems(item.children);
          if (found) return found;
        }
      }
      return null;
    };

    for (const section of config?.sections || []) {
      const found = findInItems(section.items);
      if (found) return found;
    }

    // Check footer section
    if (config?.footer) {
      const found = findInItems(config.footer.items);
      if (found) return found;
    }

    return null;
  }, [config]);

  // Filter visible sections based on user permissions
  const visibleSections = (config?.sections || []).filter(section => {
    if (typeof section.visible === 'function') {
      return section.visible(user);
    }
    return section.visible !== false;
  });

  // Check if item is visible based on user permissions
  const isItemVisible = (item: NavigationItem) => {
    if (typeof item.visible === 'function') {
      return item.visible(user);
    }
    if (item.visible === false) return false;
    if (item.requiredPermissions?.length > 0) {
      const userPermissions = user?.permissions || [];
      const isAdmin = user?.role === 'admin';
      return isAdmin || item.requiredPermissions.some((p: string) => userPermissions.includes(p));
    }
    return true;
  };

  // Handle item interactions
  const handleItemMouseEnter = useCallback((item: NavigationItem, element: HTMLElement) => {
    setHoveredItemId(item.id);
    
    if (enableTooltips) {
      showItemTooltip(element, item);
    }
    
    if (enableAnimations) {
      createHoverGlow(element);
    }
  }, [enableTooltips, enableAnimations, showItemTooltip]);

  const handleItemMouseLeave = useCallback((item: NavigationItem, element: HTMLElement) => {
    setHoveredItemId(null);
    
    if (enableTooltips) {
      hideTooltip();
    }
    
    if (enableAnimations) {
      removeHoverGlow(element);
    }
  }, [enableTooltips, enableAnimations, hideTooltip]);

  const handleItemClick = useCallback((item: NavigationItem, event?: React.MouseEvent) => {
    if (event && enableAnimations) {
      createRippleEffect(event.currentTarget as HTMLElement, event);
    }
    
    onItemClick?.(item);
    announcements?.itemActivated?.(item.label);
    
    // Update keyboard navigation focus
    keyboardNavigation.focusItem(item.id);
  }, [enableAnimations, onItemClick, announcements, keyboardNavigation]);

  const handleExpandClick = useCallback((event: React.MouseEvent) => {
    if (enableAnimations) {
      createRippleEffect(event.currentTarget as HTMLElement, event);
    }
    
    onExpandClick?.();
    announcements?.itemActivated?.('Expand navigation');
  }, [enableAnimations, onExpandClick, announcements]);

  // Register item refs for keyboard navigation and tooltips
  const registerItemRef = useCallback((itemId: string, element: HTMLElement | null) => {
    if (element) {
      itemRefs.current.set(itemId, element);
    } else {
      itemRefs.current.delete(itemId);
    }
  }, []);

  return (
    <>
      <nav
        ref={railRef}
        className={`nav-rail nav-rail--enhanced ${className}`}
        role="navigation"
        aria-label={a11yLabel}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          width: layout?.rail?.width || '80px',
          backgroundColor: railSurfaces.background || 'var(--color-surface, #ffffff)',
          borderRight: railElevation.borderRight || '1px solid var(--color-surface-variant, #e0e0e0)',
          display: 'flex',
          flexDirection: 'column',
          padding: spacing?.container?.rail?.padding || '16px 8px',
          zIndex: zIndex?.rail || 1000,
          transition: enableAnimations ? `all ${animationDuration}ms ease` : 'none',
          overflow: 'hidden',
        }}
      >
        {/* Header with expand button */}
        <div
          className="nav-rail-header"
          style={{
            height: layout?.rail?.headerHeight || '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing?.section?.headerMarginBottom || '16px',
          }}
        >
          {showExpandButton ? (
            <button
              onClick={handleExpandClick}
              className="nav-expand-button"
              aria-label={a11y.srOnly.toggleButton || 'Expand navigation'}
              ref={(el) => registerItemRef('expand-button', el)}
              style={{
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                color: railSurfaces.foreground || 'var(--color-on-surface, #000000)',
                transition: enableAnimations ? 'all 200ms ease' : 'none',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                if (enableAnimations) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 107, 53, 0.08)';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }
              }}
              onMouseLeave={(e) => {
                if (enableAnimations) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.transform = 'scale(1)';
                }
              }}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow = '0 0 0 2px rgba(255, 107, 53, 0.5)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <Bars3Icon 
                className="w-6 h-6" 
                style={{
                  transition: enableAnimations ? 'transform 200ms ease' : 'none',
                }} 
              />
            </button>
          ) : (
            config?.branding?.logo && (
              <div
                className="nav-rail-logo"
                style={{
                  width: '48px',
                  height: '48px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '12px',
                }}
              >
                {typeof config.branding.logo === 'string' ? (
                  <span style={{ fontSize: '24px', fontWeight: '600' }}>
                    {config.branding.logo}
                  </span>
                ) : (
                  config.branding.logo
                )}
              </div>
            )
          )}
        </div>

        {/* Navigation sections */}
        <div
          className="nav-rail-content"
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            scrollBehavior: 'smooth',
          }}
        >
          {visibleSections.map((section, sectionIndex) => (
            <div 
              key={section.id} 
              className="nav-rail-section"
              {...getSectionAnimationProps(section.id)}
            >
              {/* Section items */}
              <div
                className="nav-rail-section-items"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: spacing?.item?.gap || '4px',
                }}
              >
                {section.items
                  .filter(isItemVisible)
                  .map((item) => (
                    <EnhancedNavigationItem
                      key={item.id}
                      item={item}
                      mode="rail"
                      isActive={activeItemId === item.id || item.children?.some(child => activeItemId === child.id)}
                      isFocused={focusedItemId === item.id}
                      isHovered={hoveredItemId === item.id}
                      showLabel={false}
                      showTooltip={enableTooltips}
                      showBadge={enableBadges}
                      badges={getBadges(item.id)}
                      enableAnimations={enableAnimations}
                      animationDuration={animationDuration}
                      onClick={handleItemClick}
                      onMouseEnter={handleItemMouseEnter}
                      onMouseLeave={handleItemMouseLeave}
                      onBadgeClick={onBadgeClick}
                      ref={(el) => registerItemRef(item.id, el)}
                    />
                  ))}
              </div>

              {/* Section divider */}
              {section.divider && sectionIndex < visibleSections.length - 1 && (
                <div
                  className="nav-rail-divider"
                  style={{
                    height: '1px',
                    backgroundColor: railSurfaces.border || 'var(--color-outline, #e0e0e0)',
                    margin: `${spacing?.section?.dividerMargin || '16px'} 8px`,
                    opacity: 0.3,
                    transition: enableAnimations ? 'opacity 200ms ease' : 'none',
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Footer section */}
        {config?.footer && (
          <div
            className="nav-rail-footer"
            style={{
              paddingTop: spacing?.section?.dividerMargin || '16px',
              borderTop: `1px solid ${railSurfaces.border || 'var(--color-outline, #e0e0e0)'}`,
              display: 'flex',
              flexDirection: 'column',
              gap: spacing?.item?.gap || '4px',
            }}
          >
            {config.footer.items
              .filter(isItemVisible)
              .map((item) => (
                <EnhancedNavigationItem
                  key={item.id}
                  item={item}
                  mode="rail"
                  isActive={activeItemId === item.id}
                  isFocused={focusedItemId === item.id}
                  isHovered={hoveredItemId === item.id}
                  showLabel={false}
                  showTooltip={enableTooltips}
                  showBadge={enableBadges}
                  badges={getBadges(item.id)}
                  enableAnimations={enableAnimations}
                  animationDuration={animationDuration}
                  onClick={handleItemClick}
                  onMouseEnter={handleItemMouseEnter}
                  onMouseLeave={handleItemMouseLeave}
                  onBadgeClick={onBadgeClick}
                  ref={(el) => registerItemRef(item.id, el)}
                />
              ))}
          </div>
        )}

        {/* Enhanced user profile */}
        <EnhancedNavigationProfile
          mode="rail"
          enableTooltips={enableTooltips}
          enableAnimations={enableAnimations}
          showAvatar={true}
          showEmail={false}
          showRole={false}
          showStatus={true}
          onProfileClick={() => announcements?.itemActivated?.('Profile menu')}
        />
      </nav>

      {/* Tooltip portal */}
      {enableTooltips && tooltipState.isVisible && (
        <div {...getTooltipProps()}>
          <div className="nav-tooltip-content">
            <div className="nav-tooltip-title">{tooltipState.content?.title}</div>
            {tooltipState.content?.description && (
              <div className="nav-tooltip-description">
                {tooltipState.content.description}
              </div>
            )}
            {tooltipState.content?.badge && (
              <div className="nav-tooltip-badge">
                {tooltipState.content.badge.text || tooltipState.content.badge.count}
              </div>
            )}
            {tooltipState.content?.shortcut && (
              <div className="nav-tooltip-shortcut">
                {tooltipState.content.shortcut}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default EnhancedNavigationRail;