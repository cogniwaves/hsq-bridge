/**
 * Authentication Layout Component
 * Provides consistent layout for authentication pages
 */

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors duration-300"
         style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 
          className="text-center text-3xl font-bold transition-colors duration-300"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {title}
        </h2>
        {subtitle && (
          <p 
            className="mt-2 text-center text-sm transition-colors duration-300"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {subtitle}
          </p>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div 
          className="py-8 px-4 shadow-lg sm:rounded-lg sm:px-10 transition-colors duration-300"
          style={{ 
            backgroundColor: 'var(--color-surface)',
            boxShadow: 'var(--elevation-medium)'
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}