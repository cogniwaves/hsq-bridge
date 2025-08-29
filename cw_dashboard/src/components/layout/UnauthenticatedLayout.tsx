/**
 * Unauthenticated Layout Component
 * Provides a clean layout for authentication pages and public routes
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { ThemeToggle } from '../../design-system/components/ThemeToggle';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

interface UnauthenticatedLayoutProps {
  children: React.ReactNode;
  pathname: string;
}

export function UnauthenticatedLayout({ children, pathname }: UnauthenticatedLayoutProps) {
  // Determine if we should show back button
  const showBackButton = pathname !== '/auth/signin' && !pathname.startsWith('/preview');

  // Get page title based on pathname
  const getPageTitle = () => {
    if (pathname.startsWith('/auth/signin')) return 'Sign In';
    if (pathname.startsWith('/auth/signup')) return 'Create Account';
    if (pathname.startsWith('/auth/reset-password')) return 'Reset Password';
    if (pathname.startsWith('/auth/verify-email')) return 'Verify Email';
    if (pathname.startsWith('/preview-navigation')) return 'Navigation Preview';
    if (pathname.startsWith('/unauthorized')) return 'Unauthorized';
    return 'HSQ Bridge';
  };

  // Determine if we're on a preview page (different layout style)
  const isPreviewPage = pathname.startsWith('/preview');

  if (isPreviewPage) {
    // Special layout for preview pages
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
        {children}
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen transition-colors duration-300 flex flex-col"
      style={{ backgroundColor: 'var(--color-background)' }}
    >
      {/* Simple Header */}
      <nav 
        className="shadow-sm border-b transition-colors duration-300"
        style={{ 
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-surface-variant)'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              {/* Back Button */}
              {showBackButton && (
                <Link
                  href="/auth/signin"
                  className="flex items-center space-x-2 text-sm transition-colors hover:opacity-80"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  <ArrowLeftIcon className="w-4 h-4" />
                  <span>Back</span>
                </Link>
              )}
              
              {/* Logo/Title */}
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <h1 
                    className="text-lg font-semibold transition-colors duration-300"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    HSQ Bridge
                  </h1>
                </div>
                {pathname.startsWith('/auth/') && (
                  <div 
                    className="ml-4 pl-4 border-l"
                    style={{ borderColor: 'var(--color-surface-variant)' }}
                  >
                    <span 
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {getPageTitle()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center space-x-4">
              {/* Environment badge */}
              <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Secure Auth
              </span>
              
              {/* Theme Toggle */}
              <ThemeToggle 
                variant="icon" 
                size="medium" 
                showTooltip 
                includeSystem 
              />
              
              {/* Help Link */}
              <a
                href="https://docs.hsq-bridge.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm transition-colors hover:opacity-80"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Help
              </a>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Auth pages specific wrapper */}
        {pathname.startsWith('/auth/') ? (
          <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
              {/* Auth Card Container */}
              <div 
                className="rounded-lg shadow-xl p-8 transition-colors duration-300"
                style={{ 
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-surface-variant)',
                  border: '1px solid'
                }}
              >
                {children}
              </div>

              {/* Footer Links */}
              <div className="text-center text-sm space-y-2">
                {pathname === '/auth/signin' ? (
                  <>
                    <p style={{ color: 'var(--color-text-secondary)' }}>
                      Don&apos;t have an account?{' '}
                      <Link
                        href="/auth/signup"
                        className="font-medium transition-colors hover:opacity-80"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        Sign up
                      </Link>
                    </p>
                    <p>
                      <Link
                        href="/auth/reset-password"
                        className="font-medium transition-colors hover:opacity-80"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        Forgot your password?
                      </Link>
                    </p>
                  </>
                ) : pathname === '/auth/signup' ? (
                  <p style={{ color: 'var(--color-text-secondary)' }}>
                    Already have an account?{' '}
                    <Link
                      href="/auth/signin"
                      className="font-medium transition-colors hover:opacity-80"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      Sign in
                    </Link>
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          // Non-auth pages (unauthorized, etc.)
          <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 w-full">
            {children}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer 
        className="border-t py-4 text-center text-sm transition-colors duration-300"
        style={{ 
          borderColor: 'var(--color-surface-variant)',
          color: 'var(--color-text-secondary)'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p>© 2024 HSQ Bridge. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default UnauthenticatedLayout;