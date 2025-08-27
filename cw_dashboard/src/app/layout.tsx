'use client';

import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '../design-system/themes/themeProvider';
import { UserfrontAuthProvider } from '../contexts/UserfrontAuthContext';
import { AuthenticatedLayout } from '../components/layout/AuthenticatedLayout';
import { UnauthenticatedLayout } from '../components/layout/UnauthenticatedLayout';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const inter = Inter({ subsets: ['latin'] });

function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [isAuthRoute, setIsAuthRoute] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  useEffect(() => {
    // Determine if we're on an auth or special route
    const authRoutes = ['/auth/', '/preview-navigation', '/unauthorized'];
    const isAuth = authRoutes.some(route => pathname.startsWith(route));
    setIsAuthRoute(isAuth);
  }, [pathname]);

  // Show loading state during initial mount
  if (!mounted) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-background)' }}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--color-primary)' }}></div>
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Loading HSQ Bridge...</p>
        </div>
      </div>
    );
  }

  // Use appropriate layout based on route type
  if (isAuthRoute) {
    return <UnauthenticatedLayout pathname={pathname}>{children}</UnauthenticatedLayout>;
  }
  
  return <AuthenticatedLayout pathname={pathname}>{children}</AuthenticatedLayout>;
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