'use client';

/**
 * Reset Password Page
 * Allows users to reset their password using a token from email
 */

import { useState, FormEvent, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AuthLayout } from '../../../components/auth/AuthLayout';
import { authApi, validators } from '../../../utils/auth';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [token, setToken] = useState<string | null>(null);
  
  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (!tokenParam) {
      setError('Invalid or missing reset token. Please request a new password reset.');
    } else {
      setToken(tokenParam);
    }
  }, [searchParams]);
  
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    const passwordError = validators.password(password);
    if (passwordError) errors.password = passwordError;
    
    const confirmError = validators.confirmPassword(password, confirmPassword);
    if (confirmError) errors.confirmPassword = confirmError;
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!token) {
      setError('Invalid reset token');
      return;
    }
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await authApi.post('/auth/reset-password', {
        token,
        password,
        confirmPassword
      });
      
      if (response.data.success) {
        // Redirect to sign in with success message
        router.push('/auth/signin?message=password_reset_success');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!token) {
    return (
      <AuthLayout
        title="Invalid Reset Link"
        subtitle="This password reset link is invalid or has expired"
      >
        <div className="text-center">
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            {error}
          </p>
          <button
            onClick={() => router.push('/auth/forgot-password')}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-on-primary)'
            }}
          >
            Request new reset link
          </button>
        </div>
      </AuthLayout>
    );
  }
  
  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your new password below"
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
            htmlFor="password" 
            className="block text-sm font-medium transition-colors duration-200"
            style={{ color: 'var(--color-text-primary)' }}
          >
            New Password
          </label>
          <div className="mt-1 relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setFieldErrors(prev => ({ ...prev, password: '' }));
              }}
              className="appearance-none block w-full px-3 py-2 pr-10 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm transition-colors duration-200"
              style={{
                backgroundColor: 'var(--color-surface)',
                borderColor: fieldErrors.password ? 'var(--color-error)' : 'var(--color-outline)',
                color: 'var(--color-text-primary)'
              }}
              placeholder="Enter new password"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeSlashIcon 
                  className="h-5 w-5 transition-colors duration-200" 
                  style={{ color: 'var(--color-text-secondary)' }}
                />
              ) : (
                <EyeIcon 
                  className="h-5 w-5 transition-colors duration-200" 
                  style={{ color: 'var(--color-text-secondary)' }}
                />
              )}
            </button>
            {fieldErrors.password && (
              <p className="mt-1 text-xs" style={{ color: 'var(--color-error)' }}>
                {fieldErrors.password}
              </p>
            )}
          </div>
          <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Must be 8+ characters with uppercase, lowercase, number, and special character
          </p>
        </div>
        
        <div>
          <label 
            htmlFor="confirmPassword" 
            className="block text-sm font-medium transition-colors duration-200"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Confirm New Password
          </label>
          <div className="mt-1 relative">
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setFieldErrors(prev => ({ ...prev, confirmPassword: '' }));
              }}
              className="appearance-none block w-full px-3 py-2 pr-10 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm transition-colors duration-200"
              style={{
                backgroundColor: 'var(--color-surface)',
                borderColor: fieldErrors.confirmPassword ? 'var(--color-error)' : 'var(--color-outline)',
                color: 'var(--color-text-primary)'
              }}
              placeholder="Confirm new password"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              tabIndex={-1}
            >
              {showConfirmPassword ? (
                <EyeSlashIcon 
                  className="h-5 w-5 transition-colors duration-200" 
                  style={{ color: 'var(--color-text-secondary)' }}
                />
              ) : (
                <EyeIcon 
                  className="h-5 w-5 transition-colors duration-200" 
                  style={{ color: 'var(--color-text-secondary)' }}
                />
              )}
            </button>
            {fieldErrors.confirmPassword && (
              <p className="mt-1 text-xs" style={{ color: 'var(--color-error)' }}>
                {fieldErrors.confirmPassword}
              </p>
            )}
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
                Resetting password...
              </span>
            ) : (
              'Reset password'
            )}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}