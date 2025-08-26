'use client';

import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '../design-system/themes/themeProvider';
import { ThemeToggle } from '../design-system/components/ThemeToggle';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider defaultMode="system" enableTransitions>
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
                  </div>
                </div>
              </div>
            </nav>
            
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}