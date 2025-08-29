'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function SignInForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // TODO: Implement actual authentication
      console.log('Sign in attempt:', formData);
      
      // For now, redirect to dashboard
      setTimeout(() => {
        router.push('/');
      }, 1000);
    } catch (err) {
      setError('Sign in failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
      {error && (
        <div 
          className="rounded-md p-4"
          style={{ backgroundColor: 'var(--color-error)', color: 'white' }}
        >
          <div className="text-sm">{error}</div>
        </div>
      )}
      
      <div className="rounded-md shadow-sm -space-y-px">
        <div>
          <input
            type="email"
            required
            className="appearance-none rounded-none relative block w-full px-3 py-2 border rounded-t-md focus:outline-none focus:z-10 sm:text-sm transition-colors duration-200"
            placeholder="Email address"
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            style={{ 
              backgroundColor: 'var(--color-surface)', 
              borderColor: 'var(--color-surface-variant)',
              color: 'var(--color-text-primary)',
              '--tw-placeholder-color': 'var(--color-text-secondary)'
            } as any}
            onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--color-surface-variant)'}
          />
        </div>
        <div>
          <input
            type="password"
            required
            className="appearance-none rounded-none relative block w-full px-3 py-2 border rounded-b-md focus:outline-none focus:z-10 sm:text-sm transition-colors duration-200"
            placeholder="Password"
            value={formData.password}
            onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
            style={{ 
              backgroundColor: 'var(--color-surface)', 
              borderColor: 'var(--color-surface-variant)',
              color: 'var(--color-text-primary)',
              '--tw-placeholder-color': 'var(--color-text-secondary)'
            } as any}
            onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--color-surface-variant)'}
          />
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={loading}
          className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md transition-all duration-200 disabled:opacity-50 hover:opacity-90"
          style={{ 
            backgroundColor: 'var(--color-primary)', 
            color: 'var(--color-on-primary)' 
          }}
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </div>

      <div className="text-center">
        <Link 
          href="/auth/signup" 
          className="font-medium transition-colors duration-200 hover:opacity-80"
          style={{ color: 'var(--color-primary)' }}
        >
          Don&apos;t have an account? Sign up
        </Link>
      </div>
    </form>
  );
}