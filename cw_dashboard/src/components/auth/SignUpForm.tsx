'use client';

/**
 * Sign Up Form Component
 * Handles new user registration with optional tenant creation
 */

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '../../hooks/useAuth';
import { validators } from '../../utils/auth';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

export function SignUpForm() {
  const { register, isLoading, error } = useAuth();
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Validation state
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Validate email
    const emailError = validators.email(email);
    if (emailError) newErrors.email = emailError;
    
    // Validate password
    const passwordError = validators.password(password);
    if (passwordError) newErrors.password = passwordError;
    
    // Validate confirm password
    const confirmError = validators.confirmPassword(password, confirmPassword);
    if (confirmError) newErrors.confirmPassword = confirmError;
    
    // Validate names
    if (!firstName.trim()) newErrors.firstName = 'First name is required';
    if (!lastName.trim()) newErrors.lastName = 'Last name is required';
    
    // Validate tenant name (optional but if provided, must be valid)
    if (tenantName && tenantName.length < 3) {
      newErrors.tenantName = 'Organization name must be at least 3 characters';
    }
    
    // Validate terms acceptance
    if (!acceptedTerms) {
      newErrors.acceptedTerms = 'You must accept the terms and conditions';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      await register({
        email,
        password,
        firstName,
        lastName,
        tenantName: tenantName || undefined,
        acceptedTerms
      });
    } catch (error) {
      // Error is handled by the auth context
      console.error('Registration error:', error);
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

      {/* Name fields */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label 
            htmlFor="firstName" 
            className="block text-sm font-medium transition-colors duration-200"
            style={{ color: 'var(--color-text-primary)' }}
          >
            First name
          </label>
          <div className="mt-1">
            <input
              id="firstName"
              name="firstName"
              type="text"
              autoComplete="given-name"
              required
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                setErrors(prev => ({ ...prev, firstName: '' }));
              }}
              className="appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm transition-colors duration-200"
              style={{
                backgroundColor: 'var(--color-surface)',
                borderColor: errors.firstName ? 'var(--color-error)' : 'var(--color-outline)',
                color: 'var(--color-text-primary)'
              }}
              disabled={isLoading}
            />
            {errors.firstName && (
              <p className="mt-1 text-xs" style={{ color: 'var(--color-error)' }}>
                {errors.firstName}
              </p>
            )}
          </div>
        </div>

        <div>
          <label 
            htmlFor="lastName" 
            className="block text-sm font-medium transition-colors duration-200"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Last name
          </label>
          <div className="mt-1">
            <input
              id="lastName"
              name="lastName"
              type="text"
              autoComplete="family-name"
              required
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                setErrors(prev => ({ ...prev, lastName: '' }));
              }}
              className="appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm transition-colors duration-200"
              style={{
                backgroundColor: 'var(--color-surface)',
                borderColor: errors.lastName ? 'var(--color-error)' : 'var(--color-outline)',
                color: 'var(--color-text-primary)'
              }}
              disabled={isLoading}
            />
            {errors.lastName && (
              <p className="mt-1 text-xs" style={{ color: 'var(--color-error)' }}>
                {errors.lastName}
              </p>
            )}
          </div>
        </div>
      </div>

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
              setErrors(prev => ({ ...prev, email: '' }));
            }}
            className="appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm transition-colors duration-200"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: errors.email ? 'var(--color-error)' : 'var(--color-outline)',
              color: 'var(--color-text-primary)'
            }}
            placeholder="Enter your email"
            disabled={isLoading}
          />
          {errors.email && (
            <p className="mt-1 text-xs" style={{ color: 'var(--color-error)' }}>
              {errors.email}
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
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setErrors(prev => ({ ...prev, password: '' }));
            }}
            className="appearance-none block w-full px-3 py-2 pr-10 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm transition-colors duration-200"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: errors.password ? 'var(--color-error)' : 'var(--color-outline)',
              color: 'var(--color-text-primary)'
            }}
            placeholder="Create a strong password"
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
          {errors.password && (
            <p className="mt-1 text-xs" style={{ color: 'var(--color-error)' }}>
              {errors.password}
            </p>
          )}
        </div>
        <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Must be 8+ characters with uppercase, lowercase, number, and special character
        </p>
      </div>

      {/* Confirm Password field */}
      <div>
        <label 
          htmlFor="confirmPassword" 
          className="block text-sm font-medium transition-colors duration-200"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Confirm Password
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
              setErrors(prev => ({ ...prev, confirmPassword: '' }));
            }}
            className="appearance-none block w-full px-3 py-2 pr-10 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm transition-colors duration-200"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: errors.confirmPassword ? 'var(--color-error)' : 'var(--color-outline)',
              color: 'var(--color-text-primary)'
            }}
            placeholder="Confirm your password"
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
          {errors.confirmPassword && (
            <p className="mt-1 text-xs" style={{ color: 'var(--color-error)' }}>
              {errors.confirmPassword}
            </p>
          )}
        </div>
      </div>

      {/* Organization name (optional) */}
      <div>
        <label 
          htmlFor="tenantName" 
          className="block text-sm font-medium transition-colors duration-200"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Organization Name <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>(optional)</span>
        </label>
        <div className="mt-1">
          <input
            id="tenantName"
            name="tenantName"
            type="text"
            autoComplete="organization"
            value={tenantName}
            onChange={(e) => {
              setTenantName(e.target.value);
              setErrors(prev => ({ ...prev, tenantName: '' }));
            }}
            className="appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm transition-colors duration-200"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: errors.tenantName ? 'var(--color-error)' : 'var(--color-outline)',
              color: 'var(--color-text-primary)'
            }}
            placeholder="Your company or team name"
            disabled={isLoading}
          />
          {errors.tenantName && (
            <p className="mt-1 text-xs" style={{ color: 'var(--color-error)' }}>
              {errors.tenantName}
            </p>
          )}
        </div>
      </div>

      {/* Terms acceptance */}
      <div className="flex items-start">
        <div className="flex items-center h-5">
          <input
            id="acceptedTerms"
            name="acceptedTerms"
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => {
              setAcceptedTerms(e.target.checked);
              setErrors(prev => ({ ...prev, acceptedTerms: '' }));
            }}
            className="h-4 w-4 rounded focus:ring-2 focus:ring-offset-2 transition-colors duration-200"
            style={{
              borderColor: errors.acceptedTerms ? 'var(--color-error)' : 'var(--color-outline)',
              color: 'var(--color-primary)'
            }}
            disabled={isLoading}
          />
        </div>
        <div className="ml-3 text-sm">
          <label htmlFor="acceptedTerms" style={{ color: 'var(--color-text-secondary)' }}>
            I agree to the{' '}
            <Link
              href="/terms"
              className="font-medium hover:underline transition-colors duration-200"
              style={{ color: 'var(--color-primary)' }}
              target="_blank"
            >
              Terms and Conditions
            </Link>{' '}
            and{' '}
            <Link
              href="/privacy"
              className="font-medium hover:underline transition-colors duration-200"
              style={{ color: 'var(--color-primary)' }}
              target="_blank"
            >
              Privacy Policy
            </Link>
          </label>
          {errors.acceptedTerms && (
            <p className="mt-1 text-xs" style={{ color: 'var(--color-error)' }}>
              {errors.acceptedTerms}
            </p>
          )}
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
              Creating account...
            </span>
          ) : (
            'Create account'
          )}
        </button>
      </div>

      {/* Sign in link */}
      <div className="text-center">
        <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Already have an account?{' '}
        </span>
        <Link
          href="/auth/signin"
          className="font-medium hover:underline transition-colors duration-200"
          style={{ color: 'var(--color-primary)' }}
        >
          Sign in
        </Link>
      </div>
    </form>
  );
}