'use client';

import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '../design-system/themes/themeProvider';
import { ThemeToggle } from '../design-system/components/ThemeToggle';
import { UserfrontAuthProvider } from '../contexts/UserfrontAuthContext';
import { UserfrontUserMenu } from '../components/user/UserfrontUserMenu';
import { SideNavigation } from '../components/navigation/SideNavigation';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const inter = Inter({ subsets: ['latin'] });

function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [showNavigation, setShowNavigation] = useState(true);
  
  useEffect(() => {
    // Hide navigation on auth pages and preview pages
    const hideNavRoutes = ['/auth/', '/preview-navigation', '/unauthorized'];
    const shouldHideNav = hideNavRoutes.some(route => pathname.startsWith(route));
    setShowNavigation(!shouldHideNav);
  }, [pathname]);

  if (showNavigation) {
    // Layout with navigation
    return (
      <div className="h-screen flex overflow-hidden">
        <SideNavigation />
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Bar */}
          <header 
            className="shadow-sm border-b transition-colors duration-300 flex-shrink-0"
            style={{ 
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-surface-variant)'
            }}
          >
            <div className="px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center">
                  <h1 
                    className="text-lg font-semibold transition-colors duration-300"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    HSQ Bridge Dashboard
                  </h1>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Phase 3 Navigation
                  </span>
                  <ThemeToggle 
                    variant="icon" 
                    size="medium" 
                    showTooltip 
                    includeSystem 
                  />
                  <UserfrontUserMenu />
                </div>
              </div>
            </div>
          </header>
          
          {/* Main Content */}
          <main className="flex-1 overflow-auto">
            <div className="py-6 px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    );
  }
  
  // Layout without navigation (auth pages, previews)
  return (
    <div 
      className="min-h-screen transition-colors duration-300"
      style={{ backgroundColor: 'var(--color-background)' }}
    >
      <nav 
        className="shadow-sm border-b transition-colors duration-300"
        style={{ 
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-surface-variant)'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 
                  className="text-lg font-semibold transition-colors duration-300"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  HSQ Bridge
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                System Deployed
              </span>
              <ThemeToggle 
                variant="icon" 
                size="medium" 
                showTooltip 
                includeSystem 
              />
              <UserfrontUserMenu />
            </div>
          </div>
        </div>
      </nav>
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <UserfrontAuthProvider
          loginUrl="/auth/signin"
          loginRedirect="/"
          signupRedirect="/"
          logoutRedirect="/auth/signin"
          requireAuth={false}
        >
          <ThemeProvider defaultMode="system" enableTransitions>
            <LayoutContent>{children}</LayoutContent>
          </ThemeProvider>
        </UserfrontAuthProvider>
      </body>
    </html>
  );
}