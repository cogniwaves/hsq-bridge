/**
 * API Key Input Component
 * Secure API key input with masking, validation, and strength indicator
 * Material Design 3 styling with platform-specific validation patterns
 */

'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useTheme } from '../../design-system/themes/themeProvider';
import { APIKeyInputProps, APIKeyValidation } from './types';
import { validateAPIKey, maskAPIKey, getPlatformInfo, debounce } from './utils';
import {
  EyeIcon,
  EyeSlashIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  ShieldCheckIcon,
  KeyIcon,
  ClipboardDocumentIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';

export function APIKeyInput({
  value,
  onChange,
  onBlur,
  platform,
  label,
  placeholder,
  description,
  required = false,
  disabled = false,
  showStrength = true,
  maskInput = true,
  validateOnChange = true,
  className = '',
  error,
}: APIKeyInputProps) {
  const { theme, resolvedMode } = useTheme();
  const [isVisible, setIsVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [validation, setValidation] = useState<APIKeyValidation | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [showCopyFeedback, setShowCopyFeedback] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const copyTimeoutRef = useRef<NodeJS.Timeout>();

  const platformInfo = getPlatformInfo(platform);
  const colors = theme.colors;
  const isDark = resolvedMode === 'dark';

  // Validation with debouncing
  const debouncedValidation = useCallback(
    debounce((apiKey: string) => {
      if (!apiKey) {
        setValidation(null);
        setIsValidating(false);
        return;
      }

      setIsValidating(true);
      const result = validateAPIKey(platform, apiKey);
      setValidation(result);
      setIsValidating(false);
    }, 300),
    [platform]
  );

  // Effect for validation
  useEffect(() => {
    if (validateOnChange && value) {
      debouncedValidation(value);
    } else {
      setValidation(null);
    }
  }, [value, validateOnChange, debouncedValidation]);

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  // Handle input change
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    onChange(newValue);
  };

  // Handle input focus
  const handleFocus = () => {
    setIsFocused(true);
  };

  // Handle input blur
  const handleBlur = () => {
    setIsFocused(false);
    if (onBlur) onBlur();
    
    // Run validation on blur if not already validating on change
    if (!validateOnChange && value) {
      const result = validateAPIKey(platform, value);
      setValidation(result);
    }
  };

  // Handle visibility toggle
  const handleVisibilityToggle = () => {
    setIsVisible(!isVisible);
  };

  // Handle copy to clipboard
  const handleCopy = async () => {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setShowCopyFeedback(true);
      
      copyTimeoutRef.current = setTimeout(() => {
        setShowCopyFeedback(false);
      }, 2000);
    } catch (error) {
      console.warn('Failed to copy to clipboard:', error);
    }
  };

  // Determine display value
  const displayValue = !isVisible && maskInput && value ? maskAPIKey(value, 4) : value;

  // Determine validation state
  const hasError = !!(error || (validation && !validation.isValid));
  const hasValidation = !!validation;
  const isValid = validation?.isValid ?? false;

  // Component styles
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing?.component?.sm || '8px',
    width: '100%',
  };

  const labelStyle: React.CSSProperties = {
    ...theme.typography?.labelMedium,
    color: hasError ? colors.error : colors.onSurface,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const inputContainerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 16px',
    paddingRight: '120px', // Space for buttons
    backgroundColor: colors.surfaceVariant,
    border: `2px solid ${hasError ? colors.error : isFocused ? colors.primary : colors.outlineVariant}`,
    borderRadius: '8px',
    ...theme.typography?.bodyLarge,
    color: colors.onSurface,
    transition: `all ${theme.motion?.duration?.short2 || '150ms'} ${theme.motion?.easing?.standard || 'ease'}`,
    outline: 'none',
    fontFamily: 'monospace',
    letterSpacing: '0.5px',
  };

  const buttonsContainerStyle: React.CSSProperties = {
    position: 'absolute',
    right: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  };

  const buttonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    color: colors.onSurfaceVariant,
    transition: `all ${theme.motion?.duration?.short2 || '150ms'} ${theme.motion?.easing?.standard || 'ease'}`,
    ':hover': {
      backgroundColor: colors.surfaceContainer,
    },
  };

  // Strength indicator component
  const StrengthIndicator = () => {
    if (!showStrength || !validation) return null;

    const strengthColors = {
      weak: colors.error,
      medium: colors.warning,
      strong: '#10b981',
    };

    const strengthLabels = {
      weak: 'Weak',
      medium: 'Medium', 
      strong: 'Strong',
    };

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing?.component?.sm || '8px',
          padding: '8px 12px',
          backgroundColor: colors.surfaceContainer,
          borderRadius: '6px',
          border: `1px solid ${colors.outlineVariant}`,
        }}
      >
        <ShieldCheckIcon
          style={{
            width: '16px',
            height: '16px',
            color: strengthColors[validation.strength],
          }}
        />
        <span
          style={{
            ...theme.typography?.labelSmall,
            color: strengthColors[validation.strength],
            fontWeight: 600,
          }}
        >
          {strengthLabels[validation.strength]}
        </span>
        <div
          style={{
            display: 'flex',
            gap: '2px',
            marginLeft: '8px',
          }}
        >
          {[1, 2, 3].map(level => (
            <div
              key={level}
              style={{
                width: '20px',
                height: '4px',
                backgroundColor: 
                  level <= (['weak', 'medium', 'strong'].indexOf(validation.strength) + 1)
                    ? strengthColors[validation.strength]
                    : colors.outlineVariant,
                borderRadius: '2px',
                transition: 'background-color 200ms ease',
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  // Validation feedback component
  const ValidationFeedback = () => {
    if (isValidating) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing?.component?.xs || '6px',
            ...theme.typography?.bodySmall,
            color: colors.onSurfaceVariant,
          }}
        >
          <div
            style={{
              width: '14px',
              height: '14px',
              border: `2px solid ${colors.outlineVariant}`,
              borderTop: `2px solid ${colors.primary}`,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          Validating...
        </div>
      );
    }

    if (error) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing?.component?.xs || '6px',
            ...theme.typography?.bodySmall,
            color: colors.error,
          }}
        >
          <ExclamationCircleIcon style={{ width: '14px', height: '14px' }} />
          {error}
        </div>
      );
    }

    if (validation && !validation.isValid && validation.errors.length > 0) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          {validation.errors.map((error, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing?.component?.xs || '6px',
                ...theme.typography?.bodySmall,
                color: colors.error,
              }}
            >
              <ExclamationCircleIcon style={{ width: '14px', height: '14px' }} />
              {error}
            </div>
          ))}
        </div>
      );
    }

    if (validation && validation.isValid) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing?.component?.xs || '6px',
            ...theme.typography?.bodySmall,
            color: '#10b981',
          }}
        >
          <CheckCircleIcon style={{ width: '14px', height: '14px' }} />
          Valid {platformInfo.name} API key
        </div>
      );
    }

    if (description) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing?.component?.xs || '6px',
            ...theme.typography?.bodySmall,
            color: colors.onSurfaceVariant,
            opacity: 0.8,
          }}
        >
          <InformationCircleIcon style={{ width: '14px', height: '14px' }} />
          {description}
        </div>
      );
    }

    return null;
  };

  return (
    <div
      className={`api-key-input api-key-input-${platform.toLowerCase()} ${className}`}
      style={containerStyle}
      data-testid={`api-key-input-${platform.toLowerCase()}`}
    >
      {/* Label */}
      {label && (
        <label htmlFor={`api-key-${platform}`} style={labelStyle}>
          <KeyIcon style={{ width: '16px', height: '16px' }} />
          {label}
          {required && <span style={{ color: colors.error }}> *</span>}
          
          {/* Platform documentation link */}
          <a
            href={platformInfo.docs}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: colors.primary,
              textDecoration: 'none',
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              opacity: 0.8,
            }}
            title={`${platformInfo.name} API documentation`}
          >
            <ArrowTopRightOnSquareIcon style={{ width: '14px', height: '14px' }} />
            Docs
          </a>
        </label>
      )}

      {/* Input Container */}
      <div style={inputContainerStyle}>
        <input
          ref={inputRef}
          id={`api-key-${platform}`}
          type={isVisible ? 'text' : 'password'}
          value={isVisible ? value : displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder || `Enter your ${platformInfo.name} API key`}
          disabled={disabled}
          required={required}
          style={inputStyle}
          autoComplete="off"
          spellCheck={false}
          aria-describedby={`api-key-${platform}-help`}
          aria-invalid={hasError}
        />

        {/* Action Buttons */}
        <div style={buttonsContainerStyle}>
          {/* Copy Button */}
          {value && (
            <button
              type="button"
              onClick={handleCopy}
              style={buttonStyle}
              title="Copy to clipboard"
              aria-label="Copy API key to clipboard"
            >
              <ClipboardDocumentIcon style={{ width: '16px', height: '16px' }} />
            </button>
          )}

          {/* Visibility Toggle */}
          <button
            type="button"
            onClick={handleVisibilityToggle}
            style={buttonStyle}
            title={isVisible ? 'Hide API key' : 'Show API key'}
            aria-label={isVisible ? 'Hide API key' : 'Show API key'}
          >
            {isVisible ? (
              <EyeSlashIcon style={{ width: '16px', height: '16px' }} />
            ) : (
              <EyeIcon style={{ width: '16px', height: '16px' }} />
            )}
          </button>
        </div>
      </div>

      {/* Copy Feedback */}
      {showCopyFeedback && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: '0',
            marginTop: '4px',
            padding: '6px 12px',
            backgroundColor: colors.inverseSurface,
            color: colors.inverseOnSurface,
            borderRadius: '6px',
            ...theme.typography?.labelSmall,
            zIndex: 1000,
            pointerEvents: 'none',
            animation: 'fadeInOut 2s ease',
          }}
        >
          Copied to clipboard!
        </div>
      )}

      {/* Validation Feedback */}
      <div id={`api-key-${platform}-help`}>
        <ValidationFeedback />
      </div>

      {/* Strength Indicator */}
      <StrengthIndicator />

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes fadeInOut {
          0%, 100% { opacity: 0; transform: translateY(-4px); }
          20%, 80% { opacity: 1; transform: translateY(0); }
        }
        
        .api-key-input button:hover {
          background-color: ${colors.surfaceContainer};
        }
        
        .api-key-input input::placeholder {
          color: ${colors.onSurfaceVariant};
          opacity: 0.6;
        }
        
        .api-key-input input:focus {
          border-color: ${colors.primary};
        }
        
        .api-key-input input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

export default APIKeyInput;