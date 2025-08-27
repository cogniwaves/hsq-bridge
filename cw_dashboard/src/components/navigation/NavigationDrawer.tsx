/**
 * Navigation Drawer Component
 * Expanded navigation state (280px width) with full labels
 */

'use client';

import React, { useState } from 'react';
import { useNavigationTheme } from '../../design-system/themes/themeProvider';
import { useUserfrontAuth } from '../../contexts/UserfrontAuthContext';
import { NavigationDrawerProps, NavigationSection } from './types';
import NavigationItem from './NavigationItem';
import NavigationProfile from './NavigationProfile';
import { ChevronLeftIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

export function NavigationDrawer({
  className = '',
  config,
  activeItemId,
  onItemClick,
  onCollapseClick,
  showCollapseButton = true,
  a11yLabel = 'Main navigation',
}: NavigationDrawerProps) {
  const { user } = useUserfrontAuth();
  const { surfaces, elevation, layout, spacing, typography, zIndex, a11y, mode: themeMode } = useNavigationTheme();
  
  // Track expanded sections
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    // Add defensive check for config.sections
    if (config && config.sections && Array.isArray(config.sections)) {
      config.sections.forEach(section => {
        if (section.collapsible && !section.defaultCollapsed) {
          initial.add(section.id);
        }
      });
    }
    return initial;
  });

  // Toggle section expansion
  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

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
      const userPermissions = user?.permissions || [];
      const isAdmin = user?.role === 'admin';
      return isAdmin || item.requiredPermissions.some((p: string) => userPermissions.includes(p));
    }
    return true;
  };

  // Render section header
  const renderSectionHeader = (section: NavigationSection) => {
    if (!section.title) return null;

    const isExpanded = expandedSections.has(section.id);

    if (section.collapsible) {
      return (
        <button
          className="nav-section-header"
          onClick={() => toggleSection(section.id)}
          aria-expanded={isExpanded}
          aria-controls={`nav-section-${section.id}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: `${spacing.section.headerMarginBottom} ${spacing.section.headerPaddingHorizontal}`,
            marginTop: spacing.section.headerMarginTop,
            marginBottom: spacing.section.headerMarginBottom,
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: surfaces[themeMode].drawer.border,
            ...typography.sectionHeader,
            transition: 'color 200ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = surfaces[themeMode].drawer.overlay;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = surfaces[themeMode].drawer.border;
          }}
        >
          <span>{section.title}</span>
          <ChevronDownIcon
            className="w-4 h-4"
            style={{
              transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 200ms ease',
            }}
          />
        </button>
      );
    }

    return (
      <div
        className="nav-section-header"
        style={{
          padding: `${spacing.section.headerMarginBottom} ${spacing.section.headerPaddingHorizontal}`,
          marginTop: spacing.section.headerMarginTop,
          marginBottom: spacing.section.headerMarginBottom,
          color: surfaces[themeMode].drawer.border,
          ...typography.sectionHeader,
        }}
      >
        {section.title}
      </div>
    );
  };

  return (
    <nav
      className={`nav-drawer ${className}`}
      role="navigation"
      aria-label={a11yLabel}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        width: layout.drawer?.width || '280px',
        backgroundColor: surfaces[themeMode]?.drawer?.background || 'var(--color-surface, #ffffff)',
        borderRight: elevation[themeMode]?.drawer?.borderRight || '1px solid var(--color-surface-variant, #e0e0e0)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: zIndex.drawer || 1000,
        transition: `width 300ms ease`,
      }}
    >
      {/* Header with branding and collapse button */}
      <div
        className="nav-drawer-header"
        style={{
          height: layout.drawer?.headerHeight || '64px',
          padding: spacing.container?.drawer?.padding || '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${surfaces[themeMode]?.drawer?.border || 'var(--color-surface-variant, #e0e0e0)'}`,
        }}
      >
        {/* Branding */}
        {config.branding && (
          <a
            href={config.branding.href || '/'}
            className="nav-drawer-branding"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            {config.branding.logo && (
              <div style={{ width: '32px', height: '32px' }}>
                {typeof config.branding.logo === 'string' ? (
                  <span style={{ fontSize: '24px' }}>{config.branding.logo}</span>
                ) : (
                  config.branding.logo
                )}
              </div>
            )}
            <div>
              {config.branding.title && (
                <div style={{ fontWeight: 600, fontSize: '16px' }}>
                  {config.branding.title}
                </div>
              )}
              {config.branding.subtitle && (
                <div style={{ fontSize: '12px', opacity: 0.7 }}>
                  {config.branding.subtitle}
                </div>
              )}
            </div>
          </a>
        )}

        {/* Collapse button */}
        {showCollapseButton && (
          <button
            onClick={onCollapseClick}
            className="nav-collapse-button"
            aria-label="Collapse navigation"
            style={{
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              color: surfaces[themeMode].drawer.border,
              transition: 'background-color 200ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-primary-container, rgba(193, 83, 1, 0.08))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation items with scrollable container */}
      <div
        className="nav-drawer-items"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: spacing.container.drawer.padding,
        }}
      >
        {visibleSections.map((section, sectionIndex) => (
          <div key={section.id} className="nav-drawer-section">
            {/* Section header */}
            {renderSectionHeader(section)}

            {/* Section items */}
            {(!section.collapsible || expandedSections.has(section.id)) && (
              <div
                id={`nav-section-${section.id}`}
                className="nav-section-items"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {section.items
                  .filter(isItemVisible)
                  .map((item) => (
                    <div key={item.id}>
                      <NavigationItem
                        item={item}
                        mode="drawer"
                        isActive={activeItemId === item.id}
                        showLabel={true}
                        onClick={onItemClick}
                      />
                      
                      {/* Render children if item has them and is active */}
                      {item.children && activeItemId === item.id && (
                        <div
                          className="nav-item-children"
                          style={{
                            marginLeft: spacing.item.horizontalPadding,
                          }}
                        >
                          {item.children
                            .filter(isItemVisible)
                            .map((child) => (
                              <NavigationItem
                                key={child.id}
                                item={child}
                                mode="drawer"
                                isActive={activeItemId === child.id}
                                level={1}
                                showLabel={true}
                                onClick={onItemClick}
                              />
                            ))}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}

            {/* Section divider */}
            {section.divider && sectionIndex < visibleSections.length - 1 && (
              <div
                className="nav-drawer-divider"
                style={{
                  height: '1px',
                  backgroundColor: surfaces[themeMode].drawer.border,
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
          className="nav-drawer-footer"
          style={{
            padding: spacing.container.drawer.padding,
            paddingTop: 0,
          }}
        >
          {config.footer.items
            .filter(isItemVisible)
            .map((item) => (
              <NavigationItem
                key={item.id}
                item={item}
                mode="drawer"
                isActive={activeItemId === item.id}
                showLabel={true}
                onClick={onItemClick}
              />
            ))}
        </div>
      )}

      {/* User profile section */}
      <NavigationProfile
        mode="drawer"
        showAvatar={true}
        showEmail={true}
        showRole={false}
      />
    </nav>
  );
}

export default NavigationDrawer;