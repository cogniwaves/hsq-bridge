/**
 * Side Navigation Component
 * Main navigation container that manages responsive states
 */

'use client';

import React, { createContext, useContext } from 'react';
import { useNavigation } from './useNavigation';
import { navigationConfig } from './navigationConfig';
import NavigationRail from './NavigationRail';
import NavigationDrawer from './NavigationDrawer';
import NavigationModal from './NavigationModal';
import { SideNavigationProps, NavigationContextValue, NavigationConfig } from './types';

// Create navigation context
const NavigationContext = createContext<NavigationContextValue | undefined>(undefined);

// Navigation context hook
export function useNavigationContext() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigationContext must be used within SideNavigation');
  }
  return context;
}

export function SideNavigation({
  className = '',
  children,
  config = navigationConfig,
  defaultMode,
  defaultExpanded = true,
  onModeChange,
  onExpandedChange,
  onItemClick,
  sticky = true,
  a11yLabel = 'Main navigation',
}: SideNavigationProps) {
  // Use navigation state management hook
  const navigation = useNavigation(config);
  const {
    state,
    currentMode,
    isMobile,
    toggleNavigation,
    expandNavigation,
    collapseNavigation,
    openNavigation,
    closeNavigation,
  } = navigation;

  // Handle item click
  const handleItemClick = (item: any) => {
    if (onItemClick) {
      onItemClick(item);
    }
    
    // Set active item
    navigation.setActiveItem(item.id);
  };

  // Handle expand/collapse
  const handleExpandClick = () => {
    expandNavigation();
    if (onExpandedChange) {
      onExpandedChange(true);
    }
  };

  const handleCollapseClick = () => {
    collapseNavigation();
    if (onExpandedChange) {
      onExpandedChange(false);
    }
  };

  // Handle modal open/close
  const handleModalClose = () => {
    closeNavigation();
  };

  // Render navigation based on current mode
  const renderNavigation = () => {
    switch (currentMode) {
      case 'rail':
        return (
          <NavigationRail
            config={config}
            activeItemId={state.activeItemId}
            onItemClick={handleItemClick}
            onExpandClick={handleExpandClick}
            showExpandButton={true}
            a11yLabel={a11yLabel}
          />
        );
        
      case 'drawer':
        return (
          <NavigationDrawer
            config={config}
            activeItemId={state.activeItemId}
            onItemClick={handleItemClick}
            onCollapseClick={handleCollapseClick}
            showCollapseButton={!isMobile}
            a11yLabel={a11yLabel}
          />
        );
        
      case 'modal':
        return (
          <NavigationModal
            config={config}
            isOpen={state.isOpen}
            onClose={handleModalClose}
            activeItemId={state.activeItemId}
            onItemClick={handleItemClick}
            a11yLabel={a11yLabel}
          />
        );
        
      default:
        return null;
    }
  };

  // Calculate main content offset based on navigation mode
  const getMainContentStyle = (): React.CSSProperties => {
    if (currentMode === 'modal') {
      return {}; // No offset for modal
    }

    const width = currentMode === 'rail' ? '80px' : '280px';
    
    return {
      marginLeft: width,
      transition: 'margin-left 300ms ease',
    };
  };

  return (
    <NavigationContext.Provider value={navigation}>
      <div className={`side-navigation-container ${className}`}>
        {/* Skip to content link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 bg-primary text-on-primary px-4 py-2 rounded"
          style={{
            position: 'absolute',
            left: '-10000px',
            top: 'auto',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
          }}
          onFocus={(e) => {
            e.currentTarget.style.position = 'fixed';
            e.currentTarget.style.left = '16px';
            e.currentTarget.style.top = '16px';
            e.currentTarget.style.width = 'auto';
            e.currentTarget.style.height = 'auto';
            e.currentTarget.style.overflow = 'visible';
            e.currentTarget.style.zIndex = '9999';
          }}
          onBlur={(e) => {
            e.currentTarget.style.position = 'absolute';
            e.currentTarget.style.left = '-10000px';
            e.currentTarget.style.width = '1px';
            e.currentTarget.style.height = '1px';
            e.currentTarget.style.overflow = 'hidden';
          }}
        >
          Skip to main content
        </a>

        {/* Render navigation */}
        {renderNavigation()}

        {/* Main content area with offset */}
        {children && (
          <main
            id="main-content"
            className="main-content"
            style={getMainContentStyle()}
          >
            {children}
          </main>
        )}

        {/* Mobile menu button (only shown on mobile when modal is closed) */}
        {currentMode === 'modal' && !state.isOpen && (
          <button
            onClick={openNavigation}
            className="mobile-menu-button"
            aria-label="Open navigation menu"
            style={{
              position: 'fixed',
              top: '16px',
              left: '16px',
              width: '48px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-on-primary)',
              border: 'none',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              cursor: 'pointer',
              zIndex: 100,
            }}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        )}
      </div>
    </NavigationContext.Provider>
  );
}

// Export additional navigation components for direct use
export { NavigationRail } from './NavigationRail';
export { NavigationDrawer } from './NavigationDrawer';
export { NavigationModal } from './NavigationModal';
export { NavigationItem } from './NavigationItem';
export { NavigationProfile } from './NavigationProfile';

// Export hooks and utilities
export { useNavigation } from './useNavigation';
export { navigationConfig, updateNavigationBadges, findNavigationItem } from './navigationConfig';

// Export types
export * from './types';

export default SideNavigation;