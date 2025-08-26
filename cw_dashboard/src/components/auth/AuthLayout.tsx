'use client';

import Link from 'next/link';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  showBackToHome?: boolean;
}

export function AuthLayout({ 
  children, 
  title, 
  subtitle, 
  showBackToHome = false 
}: AuthLayoutProps) {
  return (
    <div 
      className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300"
      style={{ backgroundColor: 'var(--color-background)' }}
    >
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 
            className="mt-6 text-center text-3xl font-extrabold transition-colors duration-300"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {title}
          </h2>
          <p 
            className="mt-2 text-center text-sm transition-colors duration-300"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {subtitle}
          </p>
          {showBackToHome && (
            <p className="mt-2 text-center text-sm">
              <Link 
                href="/" 
                className="font-medium transition-colors duration-200 hover:opacity-80"
                style={{ color: 'var(--color-primary)' }}
              >
                Back to Dashboard
              </Link>
            </p>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}