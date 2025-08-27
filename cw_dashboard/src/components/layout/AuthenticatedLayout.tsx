/**
 * Authenticated Layout Component
 * Provides the main application layout with integrated navigation for authenticated users
 */

'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SideNavigation } from '../navigation/SideNavigation';
import { NavigationProfile } from '../navigation/NavigationProfile';
import { ThemeToggle } from '../../design-system/components/ThemeToggle';
import { useUserfrontAuth } from '../../contexts/UserfrontAuthContext';
import { navigationConfig, getVisibleSections } from '../navigation/navigationConfig';
import { NavigationConfig } from '../navigation/types';
import { useNavigationData } from '../../hooks/useNavigationData';
import { useMobileNavigation } from '../../hooks/useMobileNavigation';
import { BellIcon, Cog6ToothIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
  pathname: string;
}

export function AuthenticatedLayout({ children, pathname }: AuthenticatedLayoutProps) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useUserfrontAuth();
  const { stats, refresh: refreshStats } = useNavigationData();
  const { 
    isMobile, 
    isTablet, 
    navOpen, 
    toggleNav, 
    closeNav,
    getOptimalNavMode,
    setupSwipeHandlers 
  } = useMobileNavigation();
  
  const [dynamicConfig, setDynamicConfig] = useState<NavigationConfig>(navigationConfig);
  const navigationRef = useRef<HTMLDivElement>(null);

  // Update navigation config based on user permissions
  useEffect(() => {
    if (!user) return;

    // Get visible sections based on user permissions
    const visibleSections = getVisibleSections(user);
    
    // Update navigation config with user-specific visibility
    const userSpecificConfig: NavigationConfig = {
      ...navigationConfig,
      sections: visibleSections,
      footer: {
        ...navigationConfig.footer,
        // Add user profile integration
        customComponent: (
          <NavigationProfile
            mode="drawer"
            showAvatar={true}
            showEmail={true}
            showRole={user.role === 'admin'}
          />
        ),
      },
    };

    setDynamicConfig(userSpecificConfig);
  }, [user]);

  // Set up swipe gestures for mobile navigation
  useEffect(() => {
    if (!isMobile || !navigationRef.current) return;

    const cleanup = setupSwipeHandlers(navigationRef.current, {
      onSwipeLeft: closeNav,
      onSwipeRight: () => {
        if (!navOpen) toggleNav();
      },
    });

    return cleanup;
  }, [isMobile, navOpen, closeNav, toggleNav, setupSwipeHandlers]);

  // Handle navigation item click
  const handleNavigationItemClick = useCallback((item: any) => {
    // Close mobile nav if open
    if (isMobile && navOpen) {
      closeNav();
    }

    // Handle external links
    if (item.external && item.href) {
      window.open(item.href, '_blank');
      return;
    }

    // Handle internal navigation
    if (item.href) {
      router.push(item.href);
    }

    // Handle custom onClick
    if (item.onClick) {
      item.onClick();
    }
  }, [router, isMobile, navOpen, closeNav]);

  // Handle authentication state
  useEffect(() => {
    if (isLoading) return;

    // Redirect to login if not authenticated and not on a public route
    const publicRoutes = ['/auth/', '/preview-navigation', '/unauthorized'];
    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

    if (!isAuthenticated && !isPublicRoute) {
      router.push('/auth/signin');
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-background)' }}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--color-primary)' }}></div>
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Authenticating...</p>
        </div>
      </div>
    );
  }

  // Get current page title from pathname
  const getPageTitle = () => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return 'Dashboard';
    
    // Capitalize first segment
    const title = segments[0].charAt(0).toUpperCase() + segments[0].slice(1);
    return title.replace(/-/g, ' ');
  };

  return (
    <div className="h-screen flex overflow-hidden" ref={navigationRef}>
      {/* Side Navigation - Responsive based on device */}
      <SideNavigation
        config={dynamicConfig}
        defaultMode={getOptimalNavMode()}
        defaultExpanded={!isMobile && !isTablet}
        onItemClick={handleNavigationItemClick}
        sticky={!isMobile}
        className={`nav-authenticated ${isMobile ? 'nav-mobile' : ''}`}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header 
          className="shadow-sm border-b transition-colors duration-300 flex-shrink-0 z-10"
          style={{ 
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-surface-variant)'
          }}
        >
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              {/* Left side - Page title and breadcrumb */}
              <div className="flex items-center">
                <div>
                  <h1 
                    className="text-lg font-semibold transition-colors duration-300"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {getPageTitle()}
                  </h1>
                  {pathname !== '/' && (
                    <nav className="flex mt-1" aria-label="Breadcrumb">
                      <ol className="flex items-center space-x-1 text-sm">
                        <li>
                          <a 
                            href="/" 
                            className="hover:text-primary transition-colors"
                            style={{ color: 'var(--color-text-secondary)' }}
                          >
                            Home
                          </a>
                        </li>
                        {pathname.split('/').filter(Boolean).map((segment, index, array) => (
                          <React.Fragment key={index}>
                            <li style={{ color: 'var(--color-text-secondary)' }}>/</li>
                            <li>
                              <span 
                                className={index === array.length - 1 ? 'font-medium' : ''}
                                style={{ 
                                  color: index === array.length - 1 
                                    ? 'var(--color-text-primary)' 
                                    : 'var(--color-text-secondary)' 
                                }}
                              >
                                {segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')}
                              </span>
                            </li>
                          </React.Fragment>
                        ))}
                      </ol>
                    </nav>
                  )}
                </div>
              </div>

              {/* Right side - Actions and user menu */}
              <div className="flex items-center space-x-3">
                {/* Environment Badge */}
                <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Phase 5 Complete
                </span>

                {/* Mobile Menu Toggle */}
                {isMobile && (
                  <button
                    className="lg:hidden p-2 rounded-lg transition-colors hover:bg-surface-variant"
                    style={{ color: 'var(--color-text-secondary)' }}
                    onClick={toggleNav}
                    aria-label="Toggle navigation menu"
                  >
                    {navOpen ? (
                      <XMarkIcon className="w-5 h-5" />
                    ) : (
                      <Bars3Icon className="w-5 h-5" />
                    )}
                  </button>
                )}

                {/* Notifications */}
                <button
                  className="relative p-2 rounded-lg transition-colors"
                  style={{
                    backgroundColor: stats.unreadNotifications > 0 ? 'var(--color-error-container)' : 'transparent',
                    color: stats.unreadNotifications > 0 ? 'var(--color-on-error-container)' : 'var(--color-text-secondary)',
                  }}
                  onClick={() => router.push('/notifications')}
                  aria-label={`Notifications ${stats.unreadNotifications > 0 ? `(${stats.unreadNotifications} unread)` : ''}`}
                >
                  <BellIcon className="w-5 h-5" />
                  {stats.unreadNotifications > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full animate-pulse" />
                  )}
                </button>

                {/* Settings */}
                <button
                  className="p-2 rounded-lg transition-colors hover:bg-surface-variant"
                  style={{ color: 'var(--color-text-secondary)' }}
                  onClick={() => router.push('/settings')}
                  aria-label="Settings"
                >
                  <Cog6ToothIcon className="w-5 h-5" />
                </button>

                {/* Theme Toggle */}
                <ThemeToggle 
                  variant="icon" 
                  size="medium" 
                  showTooltip 
                  includeSystem 
                />

                {/* User Profile - Desktop only (mobile uses navigation profile) */}
                <div className="hidden lg:block">
                  <NavigationProfile
                    mode="rail"
                    showAvatar={true}
                    showEmail={false}
                    showRole={false}
                  />
                </div>
              </div>
            </div>
          </div>
        </header>
        
        {/* Main Content */}
        <main 
          id="main-content"
          className="flex-1 overflow-auto focus:outline-none"
          style={{ backgroundColor: 'var(--color-background)' }}
        >
          <div className="py-6 px-4 sm:px-6 lg:px-8">
            {/* Add container with max-width for better readability */}
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </div>
        </main>

        {/* Sync Status Indicator */}
        {(stats.syncStatus.hubspot === 'active' || 
          stats.syncStatus.stripe === 'active' || 
          stats.syncStatus.quickbooks === 'active') && (
          <div className="fixed bottom-4 left-4 flex items-center space-x-2 px-3 py-2 rounded-full shadow-lg z-40"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-surface-variant)',
            }}
          >
            <div className="animate-spin rounded-full h-4 w-4 border-b-2" 
              style={{ borderColor: 'var(--color-primary)' }} 
            />
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Syncing...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default AuthenticatedLayout;