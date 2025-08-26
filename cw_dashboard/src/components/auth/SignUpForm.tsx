'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function SignUpForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    organizationName: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // TODO: Implement actual registration
      console.log('Sign up attempt:', formData);
      
      // For now, redirect to sign in
      setTimeout(() => {
        router.push('/auth/signin');
      }, 1000);
    } catch (err) {
      setError('Registration failed. Please try again.');
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
      
      <div className="rounded-md shadow-sm space-y-4">
        <div className="flex space-x-4">
          <input
            type="text"
            required
            className="appearance-none relative block w-full px-3 py-2 border rounded-md focus:outline-none sm:text-sm transition-colors duration-200"
            placeholder="First name"
            value={formData.firstName}
            onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
            style={{ 
              backgroundColor: 'var(--color-surface)', 
              borderColor: 'var(--color-surface-variant)',
              color: 'var(--color-text-primary)',
              '--tw-placeholder-color': 'var(--color-text-secondary)'
            } as any}
            onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--color-surface-variant)'}
          />
          <input
            type="text"
            required
            className="appearance-none relative block w-full px-3 py-2 border rounded-md focus:outline-none sm:text-sm transition-colors duration-200"
            placeholder="Last name"
            value={formData.lastName}
            onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
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
        
        <input
          type="email"
          required
          className="appearance-none relative block w-full px-3 py-2 border rounded-md focus:outline-none sm:text-sm transition-colors duration-200"
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
        
        <input
          type="text"
          required
          className="appearance-none relative block w-full px-3 py-2 border rounded-md focus:outline-none sm:text-sm transition-colors duration-200"
          placeholder="Organization name"
          value={formData.organizationName}
          onChange={(e) => setFormData(prev => ({ ...prev, organizationName: e.target.value }))}
          style={{ 
            backgroundColor: 'var(--color-surface)', 
            borderColor: 'var(--color-surface-variant)',
            color: 'var(--color-text-primary)',
            '--tw-placeholder-color': 'var(--color-text-secondary)'
          } as any}
          onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
          onBlur={(e) => e.target.style.borderColor = 'var(--color-surface-variant)'}
        />
        
        <input
          type="password"
          required
          className="appearance-none relative block w-full px-3 py-2 border rounded-md focus:outline-none sm:text-sm transition-colors duration-200"
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
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </div>

      <div className="text-center">
        <Link 
          href="/auth/signin" 
          className="font-medium transition-colors duration-200 hover:opacity-80"
          style={{ color: 'var(--color-primary)' }}
        >
          Already have an account? Sign in
        </Link>
      </div>
    </form>
  );
}