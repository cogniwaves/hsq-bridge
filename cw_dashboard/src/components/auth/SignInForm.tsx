'use client';

/**
 * Sign In Form Component
 * Handles user authentication with email and password
 */

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '../../hooks/useAuth';
import { validators } from '../../utils/auth';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

export function SignInForm() {
  const { login, isLoading, error } = useAuth();
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Validation state
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  
  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // Reset errors
    setEmailError(null);
    setPasswordError(null);
    
    // Validate fields
    const emailValidation = validators.email(email);
    const passwordValidation = validators.required(password, 'Password');
    
    if (emailValidation) {
      setEmailError(emailValidation);
      return;
    }
    
    if (passwordValidation) {
      setPasswordError(passwordValidation);
      return;
    }
    
    // Submit login
    try {
      await login({
        email,
        password,
        rememberMe
      });
    } catch (error) {
      // Error is handled by the auth context
      console.error('Login error:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Global error message */}
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

      {/* Email field */}
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
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailError(null);
            }}
            className="appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm transition-colors duration-200"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: emailError ? 'var(--color-error)' : 'var(--color-outline)',
              color: 'var(--color-text-primary)'
            }}
            placeholder="Enter your email"
            disabled={isLoading}
          />
          {emailError && (
            <p className="mt-2 text-sm" style={{ color: 'var(--color-error)' }}>
              {emailError}
            </p>
          )}
        </div>
      </div>

      {/* Password field */}
      <div>
        <label 
          htmlFor="password" 
          className="block text-sm font-medium transition-colors duration-200"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Password
        </label>
        <div className="mt-1 relative">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setPasswordError(null);
            }}
            className="appearance-none block w-full px-3 py-2 pr-10 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm transition-colors duration-200"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: passwordError ? 'var(--color-error)' : 'var(--color-outline)',
              color: 'var(--color-text-primary)'
            }}
            placeholder="Enter your password"
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
                aria-hidden="true"
              />
            ) : (
              <EyeIcon 
                className="h-5 w-5 transition-colors duration-200" 
                style={{ color: 'var(--color-text-secondary)' }}
                aria-hidden="true"
              />
            )}
          </button>
          {passwordError && (
            <p className="mt-2 text-sm" style={{ color: 'var(--color-error)' }}>
              {passwordError}
            </p>
          )}
        </div>
      </div>

      {/* Remember me and forgot password */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <input
            id="remember-me"
            name="remember-me"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 rounded focus:ring-2 focus:ring-offset-2 transition-colors duration-200"
            style={{
              borderColor: 'var(--color-outline)',
              color: 'var(--color-primary)'
            }}
            disabled={isLoading}
          />
          <label 
            htmlFor="remember-me" 
            className="ml-2 block text-sm transition-colors duration-200"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Remember me
          </label>
        </div>

        <div className="text-sm">
          <Link
            href="/auth/forgot-password"
            className="font-medium hover:underline transition-colors duration-200"
            style={{ color: 'var(--color-primary)' }}
          >
            Forgot your password?
          </Link>
        </div>
      </div>

      {/* Submit button */}
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
              Signing in...
            </span>
          ) : (
            'Sign in'
          )}
        </button>
      </div>

      {/* Sign up link */}
      <div className="text-center">
        <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Don&apos;t have an account?{' '}
        </span>
        <Link
          href="/auth/signup"
          className="font-medium hover:underline transition-colors duration-200"
          style={{ color: 'var(--color-primary)' }}
        >
          Sign up
        </Link>
      </div>
    </form>
  );
}