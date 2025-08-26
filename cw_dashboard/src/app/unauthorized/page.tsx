'use client';

/**
 * Unauthorized Access Page
 * Shown when a user tries to access a resource they don't have permission for
 */

import { useRouter } from 'next/navigation';
import { ShieldExclamationIcon } from '@heroicons/react/24/outline';

export default function UnauthorizedPage() {
  const router = useRouter();
  
  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8"
         style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full"
               style={{ backgroundColor: 'var(--color-warning-container)' }}>
            <ShieldExclamationIcon className="h-10 w-10"
                                 style={{ color: 'var(--color-warning)' }} />
          </div>
          
          <h2 className="mt-6 text-3xl font-bold"
              style={{ color: 'var(--color-text-primary)' }}>
            Access Denied
          </h2>
          
          <p className="mt-2 text-base"
             style={{ color: 'var(--color-text-secondary)' }}>
            You don't have permission to access this resource.
          </p>
          
          <div className="mt-8 space-y-3">
            <button
              onClick={() => router.push('/')}
              className="w-full inline-flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-on-primary)'
              }}
            >
              Go to Dashboard
            </button>
            
            <button
              onClick={() => router.back()}
              className="w-full inline-flex justify-center py-3 px-4 border rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{
                borderColor: 'var(--color-outline)',
                color: 'var(--color-text-primary)',
                backgroundColor: 'transparent'
              }}
            >
              Go Back
            </button>
          </div>
          
          <p className="mt-6 text-sm"
             style={{ color: 'var(--color-text-secondary)' }}>
            If you believe you should have access to this resource, please contact your administrator.
          </p>
        </div>
      </div>
    </div>
  );
}