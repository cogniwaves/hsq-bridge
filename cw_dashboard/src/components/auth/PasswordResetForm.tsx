'use client';

/**
 * Password Reset Form Component
 * Handles both password reset request and actual reset with new password
 */

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  EnvelopeIcon,
  LockClosedIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import { PasswordResetFormProps } from '../../types/components';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';
import { validators } from '../../utils/auth';

export function PasswordResetForm({
  mode,
  token,
  onSubmit,
  onBack,
  isLoading = false,
  error: externalError = null,
  testId = 'password-reset-form',
  className = '',
  ...props
}: PasswordResetFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Auto-focus email field
  useEffect(() => {
    if (mode === 'request') {
      const emailInput = document.getElementById('reset-email') as HTMLInputElement;
      emailInput?.focus();
    }
  }, [mode]);

  // Validation
  const validateField = (field: string, value: string): boolean => {
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
        if (value !== password) {
          error = 'Passwords do not match';
        }
        break;
    }

    setErrors(prev => ({ ...prev, [field]: error }));
    return !error;
  };

  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    setErrors({});
    
    // Validate based on mode
    if (mode === 'request') {
      if (!validateField('email', email)) {
        return;
      }
    } else {
      const passwordValid = validateField('password', password);
      const confirmValid = validateField('confirmPassword', confirmPassword);
      
      if (!passwordValid || !confirmValid) {
        return;
      }
      
      if (!token) {
        setErrors({ token: 'Reset token is missing' });
        return;
      }
    }
    
    setIsSubmitting(true);
    
    try {
      const data = mode === 'request' 
        ? { email }
        : { password, token };
      
      if (onSubmit) {
        await onSubmit(data);
      }
      
      setIsSuccess(true);
      
      // Redirect after success
      if (mode === 'reset') {
        setTimeout(() => {
          router.push('/auth/signin');
        }, 2000);
      }
    } catch (error) {
      console.error('Password reset error:', error);
      setErrors({ submit: 'An error occurred. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success state for request mode
  if (mode === 'request' && isSuccess) {
    return (
      <div 
        className={`text-center space-y-4 ${className}`}
        data-testid={`${testId}-success`}
        {...props}
      >
        <div 
          className="mx-auto w-16 h-16 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'var(--color-success-container)' }}
        >
          <CheckCircleIcon 
            className="h-8 w-8"
            style={{ color: 'var(--color-on-success-container)' }}
            aria-hidden="true"
          />
        </div>
        <h3 
          className="text-lg font-medium"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Check your email
        </h3>
        <p 
          className="text-sm"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          We've sent a password reset link to <strong>{email}</strong>
        </p>
        <p 
          className="text-xs"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          The link will expire in 1 hour. If you don't see the email, check your spam folder.
        </p>
        {onBack && (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-medium transition-colors duration-200"
            style={{ color: 'var(--color-primary)' }}
          >
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            Back to sign in
          </button>
        )}
      </div>
    );
  }

  // Success state for reset mode
  if (mode === 'reset' && isSuccess) {
    return (
      <div 
        className={`text-center space-y-4 ${className}`}
        data-testid={`${testId}-success`}
        {...props}
      >
        <div 
          className="mx-auto w-16 h-16 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'var(--color-success-container)' }}
        >
          <CheckCircleIcon 
            className="h-8 w-8"
            style={{ color: 'var(--color-on-success-container)' }}
            aria-hidden="true"
          />
        </div>
        <h3 
          className="text-lg font-medium"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Password reset successful
        </h3>
        <p 
          className="text-sm"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Your password has been reset. Redirecting to sign in...
        </p>
        <div className="flex justify-center">
          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      </div>
    );
  }

  return (
    <form 
      onSubmit={handleSubmit}
      className={`space-y-6 ${className}`}
      data-testid={testId}
      noValidate
      {...props}
    >
      {/* Header */}
      <div>
        <h2 
          className="text-2xl font-bold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {mode === 'request' ? 'Forgot your password?' : 'Reset your password'}
        </h2>
        <p 
          className="mt-2 text-sm"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {mode === 'request' 
            ? 'Enter your email address and we'll send you a link to reset your password.'
            : 'Enter your new password below.'}
        </p>
      </div>

      {/* Error message */}
      {(externalError || errors.submit || errors.token) && (
        <div 
          className="rounded-md p-4 flex items-start gap-3"
          style={{ 
            backgroundColor: 'var(--color-error-container)',
            color: 'var(--color-on-error-container)'
          }}
          role="alert"
        >
          <ExclamationCircleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm">
            {externalError || errors.submit || errors.token}
          </p>
        </div>
      )}

      {mode === 'request' ? (
        /* Email field for request mode */
        <div>
          <label 
            htmlFor="reset-email"
            className="block text-sm font-medium"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Email address
          </label>
          <div className="mt-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <EnvelopeIcon 
                className="h-5 w-5"
                style={{ color: 'var(--color-text-secondary)' }}
                aria-hidden="true"
              />
            </div>
            <input
              id="reset-email"
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
                setTouched(prev => ({ ...prev, email: true }));
                validateField('email', email);
              }}
              className="appearance-none block w-full pl-10 pr-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm transition-colors duration-200"
              style={{
                backgroundColor: 'var(--color-surface)',
                borderColor: touched.email && errors.email ? 'var(--color-error)' : 'var(--color-outline)',
                color: 'var(--color-text-primary)'
              }}
              placeholder="Enter your email"
              disabled={isLoading || isSubmitting}
              aria-invalid={touched.email && !!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
            />
          </div>
          {touched.email && errors.email && (
            <p 
              id="email-error"
              className="mt-2 text-sm"
              style={{ color: 'var(--color-error)' }}
              role="alert"
            >
              {errors.email}
            </p>
          )}
        </div>
      ) : (
        /* Password fields for reset mode */
        <>
          <div>
            <label 
              htmlFor="new-password"
              className="block text-sm font-medium"
              style={{ color: 'var(--color-text-primary)' }}
            >
              New Password
            </label>
            <div className="mt-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <LockClosedIcon 
                  className="h-5 w-5"
                  style={{ color: 'var(--color-text-secondary)' }}
                  aria-hidden="true"
                />
              </div>
              <input
                id="new-password"
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
                onBlur={() => {
                  setTouched(prev => ({ ...prev, password: true }));
                  validateField('password', password);
                }}
                className="appearance-none block w-full pl-10 pr-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm transition-colors duration-200"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: touched.password && errors.password ? 'var(--color-error)' : 'var(--color-outline)',
                  color: 'var(--color-text-primary)'
                }}
                placeholder="Enter new password"
                disabled={isLoading || isSubmitting}
                aria-invalid={touched.password && !!errors.password}
                aria-describedby="password-requirements"
              />
            </div>
            
            {/* Password strength indicator */}
            {password && (
              <div id="password-requirements" className="mt-3">
                <PasswordStrengthIndicator
                  password={password}
                  onStrengthChange={setPasswordStrength}
                  showRequirements
                  showStrengthBar
                />
              </div>
            )}
          </div>

          <div>
            <label 
              htmlFor="confirm-password"
              className="block text-sm font-medium"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Confirm New Password
            </label>
            <div className="mt-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <LockClosedIcon 
                  className="h-5 w-5"
                  style={{ color: 'var(--color-text-secondary)' }}
                  aria-hidden="true"
                />
              </div>
              <input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
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
                  setTouched(prev => ({ ...prev, confirmPassword: true }));
                  validateField('confirmPassword', confirmPassword);
                }}
                className="appearance-none block w-full pl-10 pr-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm transition-colors duration-200"
                style={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: touched.confirmPassword && errors.confirmPassword ? 'var(--color-error)' : 'var(--color-outline)',
                  color: 'var(--color-text-primary)'
                }}
                placeholder="Confirm new password"
                disabled={isLoading || isSubmitting || !password}
                aria-invalid={touched.confirmPassword && !!errors.confirmPassword}
                aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
              />
            </div>
            {touched.confirmPassword && errors.confirmPassword && (
              <p 
                id="confirmPassword-error"
                className="mt-2 text-sm"
                style={{ color: 'var(--color-error)' }}
                role="alert"
              >
                {errors.confirmPassword}
              </p>
            )}
            {confirmPassword && !errors.confirmPassword && (
              <p 
                className="mt-2 text-sm flex items-center gap-1"
                style={{ color: 'var(--color-success)' }}
              >
                <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
                Passwords match
              </p>
            )}
          </div>
        </>
      )}

      {/* Actions */}
      <div className="space-y-3">
        <button
          type="submit"
          disabled={isLoading || isSubmitting || (mode === 'reset' && passwordStrength < 60)}
          className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          style={{
            backgroundColor: isLoading || isSubmitting ? 'var(--color-surface-variant)' : 'var(--color-primary)',
            color: 'var(--color-on-primary)'
          }}
        >
          {isLoading || isSubmitting ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {mode === 'request' ? 'Sending...' : 'Resetting...'}
            </span>
          ) : (
            mode === 'request' ? 'Send reset link' : 'Reset password'
          )}
        </button>

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="w-full flex justify-center items-center gap-2 py-2 text-sm font-medium transition-colors duration-200"
            style={{ color: 'var(--color-primary)' }}
            disabled={isLoading || isSubmitting}
          >
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            Back to sign in
          </button>
        )}
      </div>
    </form>
  );
}