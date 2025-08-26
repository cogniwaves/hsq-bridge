'use client';

/**
 * Userfront Protected Route Component
 * Wraps components that require authentication with Userfront
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserfrontAuth } from '../../contexts/UserfrontAuthContext';

interface UserfrontProtectedRouteProps {
  children: React.ReactNode;
  fallbackUrl?: string;
}

export function UserfrontProtectedRoute({
  children,
  fallbackUrl = '/auth/signin'
}: UserfrontProtectedRouteProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useUserfrontAuth();

  useEffect(() => {
    if (isLoading) return;

    // Check authentication
    if (!isAuthenticated) {
      router.push(fallbackUrl);
      return;
    }
  }, [isAuthenticated, isLoading, router, fallbackUrl]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-background)' }}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--color-primary)' }}></div>
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render children until authentication check passes
  if (!isAuthenticated) return null;

  return <>{children}</>;
}