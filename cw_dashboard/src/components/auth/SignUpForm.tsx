'use client';

/**
 * Enhanced Sign Up Form Component
 * Handles new user registration with advanced UX features and accessibility
 */

import { useState, FormEvent, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../hooks/useAuth';
import { validators } from '../../utils/auth';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';
import { 
  EyeIcon, 
  EyeSlashIcon, 
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon 
} from '@heroicons/react/24/outline';
import { SignUpFormProps } from '../../types/components';

export function SignUpForm({
  onSubmit,
  onSignIn,
  requireTenantName = false,
  termsUrl = '/terms',
  privacyUrl = '/privacy',
  invitation,
  testId = 'signup-form',
  className = '',
  ...props
}: SignUpFormProps = {}) {
  const { register, isLoading, error } = useAuth();
  
  // Form state
  const [email, setEmail] = useState(invitation?.email || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [tenantName, setTenantName] = useState(invitation?.tenant?.name || '');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  
  // Validation state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);

  // Auto-focus first empty field
  useEffect(() => {
    if (!invitation?.email) {
      const emailInput = document.getElementById('email') as HTMLInputElement;
      emailInput?.focus();
    } else if (!firstName) {
      const firstNameInput = document.getElementById('firstName') as HTMLInputElement;
      firstNameInput?.focus();
    }
  }, [invitation, firstName]);

  // Mark field as touched
  const markTouched = useCallback((field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  }, []);

  // Real-time validation
  const validateField = useCallback((field: string, value: string): boolean => {
    let error = '';

    switch (field) {
      case 'email':
        const emailError = validators.email(value);
        if (emailError) error = emailError;
        break;
      case 'password':
        const passwordError = validators.password(value);
        if (passwordError) {
          error = passwordError;
        } else if (passwordStrength < 60) {
          error = 'Please choose a stronger password';
        }
        break;
      case 'confirmPassword':
        const confirmError = validators.confirmPassword(password, value);
        if (confirmError) error = confirmError;
        break;
      case 'firstName':
        if (!value.trim()) error = 'First name is required';
        else if (value.length < 2) error = 'First name must be at least 2 characters';
        break;
      case 'lastName':
        if (!value.trim()) error = 'Last name is required';
        else if (value.length < 2) error = 'Last name must be at least 2 characters';
        break;
      case 'tenantName':
        if (requireTenantName && !invitation?.tenant) {
          if (!value.trim()) error = 'Organization name is required';
          else if (value.length < 3) error = 'Organization name must be at least 3 characters';
        }
        break;
    }

    setErrors(prev => ({ ...prev, [field]: error }));
    return !error;
  }, [password, passwordStrength, requireTenantName, invitation]);

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Validate email
    const emailError = validators.email(email);
    if (emailError) newErrors.email = emailError;
    
    // Validate password
    const passwordError = validators.password(password);
    if (passwordError) {
      newErrors.password = passwordError;
    } else if (passwordStrength < 60) {
      newErrors.password = 'Please choose a stronger password';
    }
    
    // Validate confirm password
    const confirmError = validators.confirmPassword(password, confirmPassword);
    if (confirmError) newErrors.confirmPassword = confirmError;
    
    // Validate names
    if (!firstName.trim()) newErrors.firstName = 'First name is required';
    else if (firstName.length < 2) newErrors.firstName = 'First name must be at least 2 characters';
    
    if (!lastName.trim()) newErrors.lastName = 'Last name is required';
    else if (lastName.length < 2) newErrors.lastName = 'Last name must be at least 2 characters';
    
    // Validate tenant name
    if (requireTenantName && !invitation?.tenant) {
      if (!tenantName.trim()) newErrors.tenantName = 'Organization name is required';
      else if (tenantName.length < 3) newErrors.tenantName = 'Organization name must be at least 3 characters';
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
    
    if (isSubmitting) return;
    
    // Mark all fields as touched
    const allFields = ['email', 'password', 'confirmPassword', 'firstName', 'lastName'];
    if (requireTenantName && !invitation?.tenant) {
      allFields.push('tenantName');
    }
    
    const newTouched: Record<string, boolean> = {};
    allFields.forEach(field => {
      newTouched[field] = true;
    });
    setTouched(newTouched);
    
    if (!validateForm()) {
      // Focus first error field
      const firstErrorField = Object.keys(errors)[0];
      if (firstErrorField) {
        const element = document.getElementById(firstErrorField) as HTMLInputElement;
        element?.focus();
      }
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const data = {
        email,
        password,
        firstName,
        lastName,
        tenantName: requireTenantName ? tenantName : tenantName || undefined,
        acceptedTerms
      };
      
      if (onSubmit) {
        await onSubmit(data);
      } else {
        await register(data);
      }
    } catch (error) {
      console.error('Registration error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      className={`space-y-6 ${className}`}
      data-testid={testId}
      noValidate
      aria-label="Sign up form"
      {...props}
    >
      {/* Global error message */}
      {error && (
        <div 
          className="rounded-md p-4 transition-colors duration-200 flex items-start gap-3"
          style={{ 
            backgroundColor: 'var(--color-error-container)',
            color: 'var(--color-on-error-container)'
          }}
          role="alert"
          aria-live="assertive"
        >
          <ExclamationCircleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Invitation info */}
      {invitation && (
        <div 
          className="rounded-md p-4 transition-colors duration-200 flex items-start gap-3"
          style={{ 
            backgroundColor: 'var(--color-primary-container)',
            color: 'var(--color-on-primary-container)'
          }}
          role="status"
          aria-live="polite"
        >
          <InformationCircleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-sm font-medium">
              You've been invited to join {invitation.tenant.name}
            </p>
            <p className="text-sm mt-1 opacity-90">
              Complete your registration to accept the invitation
            </p>
          </div>
        </div>
      )}

      {/* Name fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label 
            htmlFor="firstName" 
            className="block text-sm font-medium transition-colors duration-200"
            style={{ color: 'var(--color-text-primary)' }}
          >
            First name <span className="text-red-500" aria-label="required">*</span>
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
                if (touched.firstName) {
                  validateField('firstName', e.target.value);
                }
              }}
              onBlur={() => {
                markTouched('firstName');
                validateField('firstName', firstName);
              }}
              className="appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm transition-all duration-200"
              style={{
                backgroundColor: 'var(--color-surface)',
                borderColor: touched.firstName && errors.firstName ? 'var(--color-error)' : 'var(--color-outline)',
                color: 'var(--color-text-primary)'
              }}
              placeholder="John"
              disabled={isLoading || isSubmitting}
              aria-invalid={touched.firstName && !!errors.firstName}
              aria-describedby={errors.firstName ? 'firstName-error' : undefined}
            />
            {touched.firstName && errors.firstName && (
              <p 
                id="firstName-error"
                className="mt-2 text-sm flex items-center gap-1" 
                style={{ color: 'var(--color-error)' }}
                role="alert"
              >
                <ExclamationCircleIcon className="h-4 w-4" aria-hidden="true" />
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
            Last name <span className="text-red-500" aria-label="required">*</span>
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
                if (touched.lastName) {
                  validateField('lastName', e.target.value);
                }
              }}
              onBlur={() => {
                markTouched('lastName');
                validateField('lastName', lastName);
              }}
              className="appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm transition-all duration-200"
              style={{
                backgroundColor: 'var(--color-surface)',
                borderColor: touched.lastName && errors.lastName ? 'var(--color-error)' : 'var(--color-outline)',
                color: 'var(--color-text-primary)'
              }}
              placeholder="Doe"
              disabled={isLoading || isSubmitting}
              aria-invalid={touched.lastName && !!errors.lastName}
              aria-describedby={errors.lastName ? 'lastName-error' : undefined}
            />
            {touched.lastName && errors.lastName && (
              <p 
                id="lastName-error"
                className="mt-2 text-sm flex items-center gap-1" 
                style={{ color: 'var(--color-error)' }}
                role="alert"
              >
                <ExclamationCircleIcon className="h-4 w-4" aria-hidden="true" />
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
          Email address <span className="text-red-500" aria-label="required">*</span>
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
              if (touched.email) {
                validateField('email', e.target.value);
              }
            }}
            onBlur={() => {
              markTouched('email');
              validateField('email', email);
            }}
            className="appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm transition-all duration-200"
            style={{
              backgroundColor: invitation?.email ? 'var(--color-surface-variant)' : 'var(--color-surface)',
              borderColor: touched.email && errors.email ? 'var(--color-error)' : 'var(--color-outline)',
              color: 'var(--color-text-primary)'
            }}
            placeholder="john@example.com"
            disabled={isLoading || isSubmitting || !!invitation?.email}
            readOnly={!!invitation?.email}
            aria-invalid={touched.email && !!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
          />
          {touched.email && errors.email && (
            <p 
              id="email-error"
              className="mt-2 text-sm flex items-center gap-1" 
              style={{ color: 'var(--color-error)' }}
              role="alert"
            >
              <ExclamationCircleIcon className="h-4 w-4" aria-hidden="true" />
              {errors.email}
            </p>
          )}
          {email && touched.email && !errors.email && (
            <p className="mt-2 text-sm flex items-center gap-1" style={{ color: 'var(--color-success)' }}>
              <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
              Valid email address
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
          Password <span className="text-red-500" aria-label="required">*</span>
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
              if (touched.password) {
                validateField('password', e.target.value);
              }
            }}
            onFocus={() => setShowPasswordRequirements(true)}
            onBlur={() => {
              markTouched('password');
              validateField('password', password);
              setTimeout(() => setShowPasswordRequirements(false), 200);
            }}
            className="appearance-none block w-full px-3 py-2 pr-10 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm transition-all duration-200"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: touched.password && errors.password ? 'var(--color-error)' : 'var(--color-outline)',
              color: 'var(--color-text-primary)'
            }}
            placeholder="Create a strong password"
            disabled={isLoading || isSubmitting}
            aria-invalid={touched.password && !!errors.password}
            aria-describedby="password-requirements"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
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
        </div>
        
        {/* Password Strength Indicator */}
        {(password || showPasswordRequirements) && (
          <div id="password-requirements" className="mt-3">
            <PasswordStrengthIndicator
              password={password}
              onStrengthChange={setPasswordStrength}
              showRequirements={showPasswordRequirements || !!password}
              showStrengthBar={!!password}
            />
          </div>
        )}
      </div>

      {/* Confirm Password field */}
      <div>
        <label 
          htmlFor="confirmPassword" 
          className="block text-sm font-medium transition-colors duration-200"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Confirm Password <span className="text-red-500" aria-label="required">*</span>
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
              if (touched.confirmPassword) {
                validateField('confirmPassword', e.target.value);
              }
            }}
            onBlur={() => {
              markTouched('confirmPassword');
              validateField('confirmPassword', confirmPassword);
            }}
            className="appearance-none block w-full px-3 py-2 pr-10 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm transition-all duration-200"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: touched.confirmPassword && errors.confirmPassword ? 'var(--color-error)' : 'var(--color-outline)',
              color: 'var(--color-text-primary)'
            }}
            placeholder="Confirm your password"
            disabled={isLoading || isSubmitting || !password}
            aria-invalid={touched.confirmPassword && !!errors.confirmPassword}
            aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
            tabIndex={-1}
            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
          >
            {showConfirmPassword ? (
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
        </div>
        {touched.confirmPassword && errors.confirmPassword && (
          <p 
            id="confirmPassword-error"
            className="mt-2 text-sm flex items-center gap-1" 
            style={{ color: 'var(--color-error)' }}
            role="alert"
          >
            <ExclamationCircleIcon className="h-4 w-4" aria-hidden="true" />
            {errors.confirmPassword}
          </p>
        )}
        {confirmPassword && touched.confirmPassword && !errors.confirmPassword && (
          <p className="mt-2 text-sm flex items-center gap-1" style={{ color: 'var(--color-success)' }}>
            <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
            Passwords match
          </p>
        )}
      </div>

      {/* Organization name (optional or required based on prop) */}
      {(!invitation?.tenant || requireTenantName) && (
        <div>
          <label 
            htmlFor="tenantName" 
            className="block text-sm font-medium transition-colors duration-200"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Organization Name {requireTenantName ? (
              <span className="text-red-500" aria-label="required">*</span>
            ) : (
              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>(optional)</span>
            )}
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
                if (touched.tenantName) {
                  validateField('tenantName', e.target.value);
                }
              }}
              onBlur={() => {
                markTouched('tenantName');
                validateField('tenantName', tenantName);
              }}
              className="appearance-none block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm transition-all duration-200"
              style={{
                backgroundColor: invitation?.tenant ? 'var(--color-surface-variant)' : 'var(--color-surface)',
                borderColor: touched.tenantName && errors.tenantName ? 'var(--color-error)' : 'var(--color-outline)',
                color: 'var(--color-text-primary)'
              }}
              placeholder="Your company or team name"
              disabled={isLoading || isSubmitting || !!invitation?.tenant}
              readOnly={!!invitation?.tenant}
              aria-invalid={touched.tenantName && !!errors.tenantName}
              aria-describedby={errors.tenantName ? 'tenantName-error' : undefined}
            />
            {touched.tenantName && errors.tenantName && (
              <p 
                id="tenantName-error"
                className="mt-2 text-sm flex items-center gap-1" 
                style={{ color: 'var(--color-error)' }}
                role="alert"
              >
                <ExclamationCircleIcon className="h-4 w-4" aria-hidden="true" />
                {errors.tenantName}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Terms acceptance */}
      <div className="space-y-2">
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
              disabled={isLoading || isSubmitting}
              aria-invalid={!!errors.acceptedTerms}
              aria-describedby={errors.acceptedTerms ? 'terms-error' : undefined}
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="acceptedTerms" className="cursor-pointer">
              <span style={{ color: 'var(--color-text-secondary)' }}>
                I agree to the{' '}
              </span>
              <Link
                href={termsUrl}
                className="font-medium hover:underline transition-colors duration-200"
                style={{ color: 'var(--color-primary)' }}
                target="_blank"
                rel="noopener noreferrer"
              >
                Terms and Conditions
              </Link>
              <span style={{ color: 'var(--color-text-secondary)' }}>
                {' '}and{' '}
              </span>
              <Link
                href={privacyUrl}
                className="font-medium hover:underline transition-colors duration-200"
                style={{ color: 'var(--color-primary)' }}
                target="_blank"
                rel="noopener noreferrer"
              >
                Privacy Policy
              </Link>
              <span className="text-red-500 ml-1" aria-label="required">*</span>
            </label>
          </div>
        </div>
        {errors.acceptedTerms && (
          <p 
            id="terms-error"
            className="text-sm flex items-center gap-1 ml-7" 
            style={{ color: 'var(--color-error)' }}
            role="alert"
          >
            <ExclamationCircleIcon className="h-4 w-4" aria-hidden="true" />
            {errors.acceptedTerms}
          </p>
        )}
      </div>

      {/* Submit button */}
      <div>
        <button
          type="submit"
          disabled={isLoading || isSubmitting || (password && passwordStrength < 60)}
          className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
          style={{
            backgroundColor: isLoading || isSubmitting ? 'var(--color-surface-variant)' : 'var(--color-primary)',
            color: 'var(--color-on-primary)'
          }}
          aria-busy={isLoading || isSubmitting}
        >
          {isLoading || isSubmitting ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {invitation ? 'Accepting invitation...' : 'Creating account...'}
            </span>
          ) : (
            invitation ? 'Accept Invitation & Create Account' : 'Create Account'
          )}
        </button>
      </div>

      {/* Sign in link */}
      <div className="text-center">
        <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Already have an account?{' '}
        </span>
        {onSignIn ? (
          <button
            type="button"
            onClick={onSignIn}
            className="font-medium hover:underline transition-colors duration-200"
            style={{ color: 'var(--color-primary)' }}
            disabled={isLoading || isSubmitting}
          >
            Sign in
          </button>
        ) : (
          <Link
            href="/auth/signin"
            className="font-medium hover:underline transition-colors duration-200"
            style={{ color: 'var(--color-primary)' }}
          >
            Sign in
          </Link>
        )}
      </div>
    </form>
  );
}