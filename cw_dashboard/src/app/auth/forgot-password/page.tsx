'use client';

/**
 * Forgot Password Page
 * Allows users to request a password reset link
 */

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthLayout } from '../../../components/auth/AuthLayout';
import { authApi, validators } from '../../../utils/auth';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

export default function ForgotPasswordPage() {
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validate email
    const emailError = validators.email(email);
    if (emailError) {
      setError(emailError);
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await authApi.post('/auth/forgot-password', { email });
      
      if (response.data.success) {
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  if (success) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle="We've sent you a password reset link"
      >
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full" 
               style={{ backgroundColor: 'var(--color-success-container)' }}>
            <svg className="h-6 w-6" style={{ color: 'var(--color-success)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          
          <h3 className="mt-4 text-lg font-medium" style={{ color: 'var(--color-text-primary)' }}>
            Password reset email sent
          </h3>
          
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            We&apos;ve sent a password reset link to <strong>{email}</strong>
          </p>
          
          <p className="mt-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Please check your email and follow the instructions to reset your password.
          </p>
          
          <div className="mt-6">
            <Link
              href="/auth/signin"
              className="inline-flex items-center text-sm font-medium hover:underline"
              style={{ color: 'var(--color-primary)' }}
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              Back to sign in
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }
  
  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a reset link"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div 
            className="rounded-md p-4 transition-colors duration-200"
            style={{ 
              backgroundColor: 'var(--color-error-container)',
              color: 'var(--color-on-error-container)'
            }}
          >
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}
        
        <div>
          <label 
            htmlFor="email" 
            className="block text-sm font-medium transition-colors duration-200"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Email address
          </label>
          <div className="mt-1">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm transition-colors duration-200"
              style={{
                backgroundColor: 'var(--color-surface)',
                borderColor: error ? 'var(--color-error)' : 'var(--color-outline)',
                color: 'var(--color-text-primary)'
              }}
              placeholder="Enter your email"
              disabled={isLoading}
            />
          </div>
        </div>
        
        <div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            style={{
              backgroundColor: isLoading ? 'var(--color-surface-variant)' : 'var(--color-primary)',
              color: 'var(--color-on-primary)'
            }}
          >
            {isLoading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Sending reset link...
              </span>
            ) : (
              'Send reset link'
            )}
          </button>
        </div>
        
        <div className="text-center">
          <Link
            href="/auth/signin"
            className="inline-flex items-center text-sm font-medium hover:underline"
            style={{ color: 'var(--color-primary)' }}
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to sign in
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}