import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '../design-system/themes/themeProvider';
import { ThemeToggle } from '../design-system/components/ThemeToggle';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'HubSpot-Stripe-QuickBooks Bridge',
  description: 'Real-time synchronization dashboard for invoice and payment management',
};

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
                    <h1 
                      className="text-xl font-semibold transition-colors duration-300"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      HS Bridge Dashboard
                    </h1>
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