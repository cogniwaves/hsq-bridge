'use client';

import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '../design-system/themes/themeProvider';
import { ThemeToggle } from '../design-system/components/ThemeToggle';
import { AuthProvider } from '../contexts/AuthContext';
import { useAuth } from '../hooks/useAuth';
import { useTenant } from '../hooks/useTenant';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDownIcon, ArrowRightOnRectangleIcon, UserCircleIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';

const inter = Inter({ subsets: ['latin'] });

// Metadata moved to individual pages for client component compatibility

function NavigationBar() {
  const pathname = usePathname();
  const { user, tenant, logout, isAuthenticated } = useAuth();
  const { availableTenants, switchTenant } = useTenant();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showTenantMenu, setShowTenantMenu] = useState(false);

  // Don't show navigation on auth pages
  const isAuthPage = pathname?.startsWith('/auth');
  if (isAuthPage) return null;

  return (
    <nav 
      className="shadow-sm border-b transition-colors duration-300"
      style={{ 
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-surface-variant)'
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link href="/">
              <h1 
                className="text-xl font-semibold transition-colors duration-300 cursor-pointer hover:opacity-80"
                style={{ color: 'var(--color-text-primary)' }}
              >
                HS Bridge Dashboard
              </h1>
            </Link>
            
            {/* Tenant Switcher */}
            {isAuthenticated && tenant && availableTenants.length > 1 && (
              <div className="relative">
                <button
                  onClick={() => setShowTenantMenu(!showTenantMenu)}
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200"
                  style={{
                    backgroundColor: 'var(--color-surface-variant)',
                    color: 'var(--color-text-primary)'
                  }}
                >
                  <span>{tenant.name}</span>
                  <ChevronDownIcon className="h-4 w-4" />
                </button>
                
                {showTenantMenu && (
                  <div 
                    className="absolute left-0 mt-2 w-56 rounded-md shadow-lg py-1 z-50"
                    style={{
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-outline)'
                    }}
                  >
                    {availableTenants.map(t => (
                      <button
                        key={t.id}
                        onClick={() => {
                          switchTenant(t.id);
                          setShowTenantMenu(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors duration-200"
                        style={{
                          color: t.id === tenant.id ? 'var(--color-primary)' : 'var(--color-text-primary)',
                          backgroundColor: t.id === tenant.id ? 'var(--color-primary-container)' : 'transparent'
                        }}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            <span 
              className="text-sm transition-colors duration-300"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              v1.0.0
            </span>
            
            <ThemeToggle 
              variant="icon" 
              size="medium" 
              showTooltip 
              includeSystem 
            />
            
            {/* User Menu */}
            {isAuthenticated && user && (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 p-2 rounded-full transition-colors duration-200 hover:bg-gray-100"
                >
                  <UserCircleIcon 
                    className="h-8 w-8"
                    style={{ color: 'var(--color-text-secondary)' }}
                  />
                </button>
                
                {showUserMenu && (
                  <div 
                    className="absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 z-50"
                    style={{
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-outline)'
                    }}
                  >
                    <div 
                      className="px-4 py-2 text-sm border-b"
                      style={{
                        color: 'var(--color-text-primary)',
                        borderColor: 'var(--color-outline-variant)'
                      }}
                    >
                      <p className="font-medium">{user.firstName} {user.lastName}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        {user.email}
                      </p>
                    </div>
                    
                    <Link
                      href="/settings/profile"
                      className="block px-4 py-2 text-sm hover:bg-gray-50 transition-colors duration-200"
                      style={{ color: 'var(--color-text-primary)' }}
                      onClick={() => setShowUserMenu(false)}
                    >
                      <span className="flex items-center">
                        <UserCircleIcon className="h-4 w-4 mr-2" />
                        Profile
                      </span>
                    </Link>
                    
                    <Link
                      href="/settings"
                      className="block px-4 py-2 text-sm hover:bg-gray-50 transition-colors duration-200"
                      style={{ color: 'var(--color-text-primary)' }}
                      onClick={() => setShowUserMenu(false)}
                    >
                      <span className="flex items-center">
                        <Cog6ToothIcon className="h-4 w-4 mr-2" />
                        Settings
                      </span>
                    </Link>
                    
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        logout();
                      }}
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors duration-200 border-t"
                      style={{ 
                        color: 'var(--color-text-primary)',
                        borderColor: 'var(--color-outline-variant)'
                      }}
                    >
                      <span className="flex items-center">
                        <ArrowRightOnRectangleIcon className="h-4 w-4 mr-2" />
                        Sign out
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith('/auth');
  
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <AuthProvider>
          <ThemeProvider defaultMode="system" enableTransitions>
            <div 
              className="min-h-screen transition-colors duration-300"
              style={{ backgroundColor: 'var(--color-background)' }}
            >
              <NavigationBar />
              <main className={isAuthPage ? "" : "max-w-7xl mx-auto py-6 sm:px-6 lg:px-8"}>
                {children}
              </main>
            </div>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}