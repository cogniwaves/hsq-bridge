/**
 * Navigation Rail Component
 * Collapsed navigation state (80px width) with icons only
 */

'use client';

import React from 'react';
import { useNavigationTheme } from '../../design-system/themes/themeProvider';
import { useUserfrontAuth } from '../../contexts/UserfrontAuthContext';
import { NavigationRailProps } from './types';
import NavigationItem from './NavigationItem';
import NavigationProfile from './NavigationProfile';
import { Bars3Icon } from '@heroicons/react/24/outline';

export function NavigationRail({
  className = '',
  config,
  activeItemId,
  onItemClick,
  onExpandClick,
  showExpandButton = true,
  a11yLabel = 'Main navigation',
}: NavigationRailProps) {
  const { user } = useUserfrontAuth();
  const { surfaces, elevation, layout, spacing, zIndex, a11y, mode: themeMode } = useNavigationTheme();
  
  // Safe access to theme surfaces with fallbacks
  const railSurfaces = surfaces?.rail || {};
  const railElevation = elevation?.rail || {};

  // Filter visible sections based on user permissions
  const visibleSections = (config?.sections || []).filter(section => {
    if (typeof section.visible === 'function') {
      return section.visible(user);
    }
    return section.visible !== false;
  });

  // Check if item is visible based on user permissions
  const isItemVisible = (item: any) => {
    if (typeof item.visible === 'function') {
      return item.visible(user);
    }
    if (item.visible === false) return false;
    if (item.requiredPermissions?.length > 0) {
      // Check user permissions
      const userPermissions = user?.permissions || [];
      const isAdmin = user?.role === 'admin';
      return isAdmin || item.requiredPermissions.some((p: string) => userPermissions.includes(p));
    }
    return true;
  };

  return (
    <nav
      className={`nav-rail ${className}`}
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
        padding: spacing.container.rail.padding,
        zIndex: zIndex.rail,
        transition: `width 300ms ease`,
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
          marginBottom: spacing.section.headerMarginBottom,
        }}
      >
        {showExpandButton ? (
          <button
            onClick={onExpandClick}
            className="nav-expand-button"
            aria-label={a11y.srOnly.toggleButton}
            style={{
              width: '48px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              color: railSurfaces.border || 'var(--color-surface-variant, #e0e0e0)',
              transition: 'background-color 200ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(193, 83, 1, 0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Bars3Icon className="w-6 h-6" />
          </button>
        ) : (
          config.branding?.logo && (
            <div
              className="nav-rail-logo"
              style={{
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {typeof config.branding.logo === 'string' ? (
                <span style={{ fontSize: '24px' }}>{config.branding.logo}</span>
              ) : (
                config.branding.logo
              )}
            </div>
          )
        )}
      </div>

      {/* Navigation items */}
      <div
        className="nav-rail-items"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {visibleSections.map((section, sectionIndex) => (
          <div key={section.id} className="nav-rail-section">
            {/* Section items */}
            {section.items
              .filter(isItemVisible)
              .map((item) => (
                <NavigationItem
                  key={item.id}
                  item={item}
                  mode="rail"
                  isActive={activeItemId === item.id || item.children?.some(child => activeItemId === child.id)}
                  showLabel={false}
                  showTooltip={true}
                  onClick={onItemClick}
                />
              ))}

            {/* Section divider */}
            {section.divider && sectionIndex < visibleSections.length - 1 && (
              <div
                className="nav-rail-divider"
                style={{
                  height: '1px',
                  backgroundColor: railSurfaces.border || 'var(--color-surface-variant, #e0e0e0)',
                  margin: `${spacing.section.dividerMargin} 0`,
                  opacity: 0.2,
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Footer section with additional items */}
      {config.footer && (
        <div
          className="nav-rail-footer"
          style={{
            paddingTop: spacing.section.dividerMargin,
            borderTop: `1px solid ${railSurfaces.border || 'var(--color-surface-variant, #e0e0e0)'}`,
          }}
        >
          {config.footer.items
            .filter(isItemVisible)
            .map((item) => (
              <NavigationItem
                key={item.id}
                item={item}
                mode="rail"
                isActive={activeItemId === item.id}
                showLabel={false}
                showTooltip={true}
                onClick={onItemClick}
              />
            ))}
        </div>
      )}

      {/* User profile section */}
      <NavigationProfile
        mode="rail"
        showAvatar={true}
        showEmail={false}
        showRole={false}
      />
    </nav>
  );
}

export default NavigationRail;