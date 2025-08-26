'use client';

/**
 * Password Strength Indicator Component
 * Provides real-time visual feedback on password strength with accessibility support
 */

import { useMemo } from 'react';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/20/solid';

interface PasswordRequirement {
  test: (password: string) => boolean;
  label: string;
  description?: string;
}

interface PasswordStrengthIndicatorProps {
  password: string;
  requirements?: PasswordRequirement[];
  showRequirements?: boolean;
  showStrengthBar?: boolean;
  minLength?: number;
  onStrengthChange?: (strength: number) => void;
  className?: string;
  testId?: string;
}

const defaultRequirements: PasswordRequirement[] = [
  {
    test: (password) => password.length >= 8,
    label: 'At least 8 characters',
    description: 'Password must be at least 8 characters long'
  },
  {
    test: (password) => /[A-Z]/.test(password),
    label: 'One uppercase letter',
    description: 'Include at least one uppercase letter'
  },
  {
    test: (password) => /[a-z]/.test(password),
    label: 'One lowercase letter',
    description: 'Include at least one lowercase letter'
  },
  {
    test: (password) => /[0-9]/.test(password),
    label: 'One number',
    description: 'Include at least one number'
  },
  {
    test: (password) => /[^A-Za-z0-9]/.test(password),
    label: 'One special character',
    description: 'Include at least one special character (!@#$%^&*)'
  }
];

export function PasswordStrengthIndicator({
  password,
  requirements = defaultRequirements,
  showRequirements = true,
  showStrengthBar = true,
  minLength = 8,
  onStrengthChange,
  className = '',
  testId = 'password-strength-indicator'
}: PasswordStrengthIndicatorProps) {
  // Calculate password strength
  const { strength, label, color, requirements: requirementStatus } = useMemo(() => {
    if (!password) {
      return {
        strength: 0,
        label: 'Enter a password',
        color: 'var(--color-text-secondary)',
        requirements: requirements.map(req => ({
          ...req,
          met: false
        }))
      };
    }

    const metRequirements = requirements.map(req => ({
      ...req,
      met: req.test(password)
    }));

    const metCount = metRequirements.filter(req => req.met).length;
    const strengthPercentage = (metCount / requirements.length) * 100;

    let label = 'Very Weak';
    let color = 'var(--color-error)';

    if (strengthPercentage >= 100) {
      label = 'Strong';
      color = 'var(--color-success)';
    } else if (strengthPercentage >= 80) {
      label = 'Good';
      color = 'var(--color-success)';
    } else if (strengthPercentage >= 60) {
      label = 'Fair';
      color = 'var(--color-warning)';
    } else if (strengthPercentage >= 40) {
      label = 'Weak';
      color = 'var(--color-warning)';
    }

    // Bonus points for length
    const lengthBonus = Math.max(0, Math.min(20, (password.length - minLength) * 2));
    const finalStrength = Math.min(100, strengthPercentage + lengthBonus);

    if (onStrengthChange) {
      onStrengthChange(finalStrength);
    }

    return {
      strength: finalStrength,
      label,
      color,
      requirements: metRequirements
    };
  }, [password, requirements, minLength, onStrengthChange]);

  // Don't show anything if no password
  if (!password && !showRequirements) {
    return null;
  }

  return (
    <div 
      className={`space-y-3 ${className}`}
      data-testid={testId}
      role="region"
      aria-label="Password strength indicator"
    >
      {/* Strength Bar */}
      {showStrengthBar && password && (
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span 
              className="text-xs font-medium transition-colors duration-200"
              style={{ color }}
              aria-live="polite"
              aria-atomic="true"
            >
              {label}
            </span>
            <span 
              className="text-xs transition-colors duration-200"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {Math.round(strength)}%
            </span>
          </div>
          
          <div 
            className="w-full h-2 rounded-full overflow-hidden transition-colors duration-200"
            style={{ backgroundColor: 'var(--color-surface-variant)' }}
            role="progressbar"
            aria-valuenow={strength}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Password strength: ${label}`}
          >
            <div 
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${strength}%`,
                backgroundColor: color,
                boxShadow: `0 0 8px ${color}40`
              }}
            />
          </div>
        </div>
      )}

      {/* Requirements List */}
      {showRequirements && (
        <ul 
          className="space-y-1.5"
          role="list"
          aria-label="Password requirements"
        >
          {requirementStatus.map((req, index) => (
            <li
              key={index}
              className="flex items-start gap-2 text-xs transition-all duration-200"
              style={{
                color: password 
                  ? req.met 
                    ? 'var(--color-success)' 
                    : 'var(--color-error)'
                  : 'var(--color-text-secondary)',
                opacity: password ? 1 : 0.7
              }}
            >
              <span className="mt-0.5 flex-shrink-0">
                {password ? (
                  req.met ? (
                    <CheckCircleIcon 
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                  ) : (
                    <XCircleIcon 
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                  )
                ) : (
                  <span 
                    className="block h-4 w-4 rounded-full border-2"
                    style={{ borderColor: 'currentColor' }}
                    aria-hidden="true"
                  />
                )}
              </span>
              <span className="flex-1">
                <span className="font-medium">{req.label}</span>
                {req.description && !password && (
                  <span className="block mt-0.5 opacity-80">
                    {req.description}
                  </span>
                )}
              </span>
              <span className="sr-only">
                {req.met ? 'Requirement met' : 'Requirement not met'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Additional Security Tips */}
      {password && strength === 100 && (
        <div 
          className="mt-3 p-3 rounded-lg transition-colors duration-200"
          style={{ 
            backgroundColor: 'var(--color-success-container)',
            color: 'var(--color-on-success-container)'
          }}
          role="status"
          aria-live="polite"
        >
          <p className="text-xs font-medium flex items-center gap-2">
            <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
            Great password! Your account will be well protected.
          </p>
        </div>
      )}
    </div>
  );
}