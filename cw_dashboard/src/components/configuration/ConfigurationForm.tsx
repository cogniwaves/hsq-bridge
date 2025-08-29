/**
 * Configuration Form Component
 * Base form component with Material Design 3 styling, validation, and error handling
 * Provides common form patterns for all configuration forms
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useTheme } from '../../design-system/themes/themeProvider';
import { ConfigurationFormProps, FormFieldProps, ValidationError } from './types';
import { validateFormField, getPlatformInfo, debounce } from './utils';
import {
  EyeIcon,
  EyeSlashIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

export function ConfigurationForm({
  platform,
  initialValues = {},
  onSubmit,
  onCancel,
  onValidate,
  isLoading = false,
  showAdvanced = false,
  className = '',
  children,
}: ConfigurationFormProps) {
  const { theme, resolvedMode } = useTheme();
  const [formData, setFormData] = useState(initialValues);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(showAdvanced);

  const platformInfo = getPlatformInfo(platform);
  const colors = theme.colors;
  const isDark = resolvedMode === 'dark';

  // Debounced validation
  const debouncedValidation = useCallback(
    debounce(async (values: Record<string, any>) => {
      if (onValidate) {
        try {
          const result = await onValidate(values);
          setErrors(result.errors || []);
        } catch (error) {
          console.warn('Validation error:', error);
        }
      }
    }, 300),
    [onValidate]
  );

  // Form data handler
  const handleFieldChange = useCallback((name: string, value: any) => {
    const newData = { ...formData, [name]: value };
    setFormData(newData);
    
    // Trigger debounced validation
    debouncedValidation(newData);
  }, [formData, debouncedValidation]);

  // Form submission handler
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (isSubmitting || isLoading) return;
    
    setIsSubmitting(true);
    
    try {
      // Final validation
      if (onValidate) {
        const validationResult = await onValidate(formData);
        if (!validationResult.isValid) {
          setErrors(validationResult.errors);
          return;
        }
      }
      
      await onSubmit(formData);
    } catch (error) {
      console.error('Form submission error:', error);
      setErrors([{
        field: 'form',
        message: error instanceof Error ? error.message : 'Failed to save configuration',
      }]);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Form styles
  const formStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing?.component?.lg || '24px',
    padding: theme.spacing?.container?.lg || '32px',
    backgroundColor: colors.surface,
    borderRadius: theme.components?.card?.borderRadius || '12px',
    border: `1px solid ${colors.outlineVariant}`,
    maxWidth: '600px',
    width: '100%',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing?.component?.md || '16px',
    marginBottom: theme.spacing?.component?.lg || '24px',
  };

  const platformIconStyle: React.CSSProperties = {
    fontSize: '32px',
    width: '48px',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: platformInfo.color + '20',
    borderRadius: '12px',
    color: platformInfo.color,
  };

  const titleStyle: React.CSSProperties = {
    ...theme.typography?.headlineMedium,
    color: colors.onSurface,
    margin: 0,
    fontWeight: 600,
  };

  const subtitleStyle: React.CSSProperties = {
    ...theme.typography?.bodyLarge,
    color: colors.onSurfaceVariant,
    margin: 0,
    opacity: 0.8,
  };

  // Error display component
  const ErrorDisplay = ({ errors }: { errors: ValidationError[] }) => {
    if (errors.length === 0) return null;

    return (
      <div
        style={{
          padding: theme.spacing?.component?.md || '16px',
          backgroundColor: colors.errorContainer,
          border: `1px solid ${colors.error}`,
          borderRadius: '8px',
          marginBottom: theme.spacing?.component?.md || '16px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing?.component?.sm || '12px',
            marginBottom: errors.length > 1 ? (theme.spacing?.component?.sm || '8px') : 0,
          }}
        >
          <ExclamationCircleIcon
            style={{
              width: '20px',
              height: '20px',
              color: colors.error,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              ...theme.typography?.labelLarge,
              color: colors.error,
              fontWeight: 600,
            }}
          >
            {errors.length === 1 ? 'Validation Error' : `${errors.length} Validation Errors`}
          </span>
        </div>
        {errors.map((error, index) => (
          <div
            key={index}
            style={{
              ...theme.typography?.bodySmall,
              color: colors.error,
              marginLeft: errors.length > 1 ? '32px' : 0,
              marginTop: index > 0 ? (theme.spacing?.component?.xs || '4px') : 0,
            }}
          >
            {error.field !== 'form' && `${error.field}: `}{error.message}
          </div>
        ))}
      </div>
    );
  };

  // Actions section
  const actionsStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing?.component?.md || '16px',
    paddingTop: theme.spacing?.component?.lg || '24px',
    borderTop: `1px solid ${colors.outlineVariant}`,
  };

  const buttonStyle = (variant: 'primary' | 'secondary' | 'tertiary' = 'secondary'): React.CSSProperties => {
    const variants = {
      primary: {
        backgroundColor: colors.primary,
        color: colors.onPrimary,
        border: 'none',
      },
      secondary: {
        backgroundColor: 'transparent',
        color: colors.primary,
        border: `1px solid ${colors.primary}`,
      },
      tertiary: {
        backgroundColor: 'transparent',
        color: colors.onSurfaceVariant,
        border: `1px solid ${colors.outlineVariant}`,
      },
    };

    return {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '12px 24px',
      borderRadius: '8px',
      cursor: 'pointer',
      transition: `all ${theme.motion?.duration?.short2 || '150ms'} ${theme.motion?.easing?.standard || 'ease'}`,
      ...theme.typography?.labelLarge,
      fontWeight: 600,
      minWidth: '120px',
      ...variants[variant],
      ':hover': {
        opacity: 0.9,
        transform: 'scale(1.02)',
      },
      ':disabled': {
        opacity: 0.6,
        cursor: 'not-allowed',
        transform: 'none',
      },
    };
  };

  return (
    <form
      className={`configuration-form configuration-form-${platform.toLowerCase()} ${className}`}
      style={formStyle}
      onSubmit={handleSubmit}
      noValidate
      data-testid={`config-form-${platform.toLowerCase()}`}
    >
      {/* Form Header */}
      <div style={headerStyle}>
        <div style={platformIconStyle}>
          {platformInfo.icon}
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={titleStyle}>Configure {platformInfo.name}</h2>
          <p style={subtitleStyle}>{platformInfo.description}</p>
        </div>
      </div>

      {/* Error Display */}
      <ErrorDisplay errors={errors} />

      {/* Form Fields */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing?.component?.lg || '20px',
        }}
      >
        {children}
      </div>

      {/* Advanced Settings Toggle */}
      {showAdvanced && (
        <button
          type="button"
          onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
          style={{
            ...buttonStyle('tertiary'),
            alignSelf: 'flex-start',
            minWidth: 'auto',
            padding: '8px 16px',
          }}
        >
          {showAdvancedSettings ? 'Hide' : 'Show'} Advanced Settings
        </button>
      )}

      {/* Actions */}
      <div style={actionsStyle}>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={buttonStyle('tertiary')}
            disabled={isSubmitting}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          style={buttonStyle('primary')}
          disabled={isSubmitting || isLoading || errors.length > 0}
        >
          {isSubmitting ? (
            <>
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid transparent',
                  borderTop: `2px solid ${colors.onPrimary}`,
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginRight: '8px',
                }}
              />
              Saving...
            </>
          ) : (
            'Save Configuration'
          )}
        </button>
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .configuration-form button:hover {
          opacity: 0.9;
          transform: scale(1.02);
        }
        
        .configuration-form button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        
        .configuration-form button:disabled:hover {
          transform: none;
        }
      `}</style>
    </form>
  );
}

// Field component for use within ConfigurationForm
export function FormField({
  name,
  label,
  type = 'text',
  placeholder,
  description,
  required = false,
  disabled = false,
  options = [],
  validation,
  className = '',
  value,
  onChange,
  error,
}: FormFieldProps & {
  value: any;
  onChange: (value: any) => void;
  error?: string;
}) {
  const { theme, resolvedMode } = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const colors = theme.colors;
  const isDark = resolvedMode === 'dark';

  // Field validation
  const fieldError = error || (validation ? validateFormField(name, value, validation)?.message : null);
  const hasError = !!fieldError;

  // Field styles
  const fieldContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing?.component?.xs || '6px',
  };

  const labelStyle: React.CSSProperties = {
    ...theme.typography?.labelMedium,
    color: hasError ? colors.error : colors.onSurface,
    fontWeight: 600,
  };

  const inputContainerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: colors.surfaceVariant,
    border: `2px solid ${hasError ? colors.error : isFocused ? colors.primary : colors.outlineVariant}`,
    borderRadius: '8px',
    ...theme.typography?.bodyLarge,
    color: colors.onSurface,
    transition: `all ${theme.motion?.duration?.short2 || '150ms'} ${theme.motion?.easing?.standard || 'ease'}`,
    outline: 'none',
    '::placeholder': {
      color: colors.onSurfaceVariant,
      opacity: 0.6,
    },
  };

  const descriptionStyle: React.CSSProperties = {
    ...theme.typography?.bodySmall,
    color: hasError ? colors.error : colors.onSurfaceVariant,
    opacity: hasError ? 1 : 0.8,
  };

  // Input component based on type
  const renderInput = () => {
    const commonProps = {
      id: name,
      name,
      value: value || '',
      placeholder,
      disabled,
      required,
      style: inputStyle,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => 
        onChange(e.target.value),
      onFocus: () => setIsFocused(true),
      onBlur: () => setIsFocused(false),
    };

    switch (type) {
      case 'textarea':
        return (
          <textarea
            {...commonProps}
            style={{
              ...inputStyle,
              minHeight: '100px',
              resize: 'vertical',
            }}
          />
        );

      case 'select':
        return (
          <select {...commonProps}>
            {!required && <option value="">Select an option</option>}
            {options.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'checkbox':
        return (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing?.component?.sm || '12px',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => onChange(e.target.checked)}
              disabled={disabled}
              style={{
                width: '18px',
                height: '18px',
                accentColor: colors.primary,
              }}
            />
            <span style={labelStyle}>{label}</span>
          </label>
        );

      case 'password':
        return (
          <div style={inputContainerStyle}>
            <input
              {...commonProps}
              type={showPassword ? 'text' : 'password'}
              style={{
                ...inputStyle,
                paddingRight: '48px',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '12px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: colors.onSurfaceVariant,
              }}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeSlashIcon style={{ width: '20px', height: '20px' }} />
              ) : (
                <EyeIcon style={{ width: '20px', height: '20px' }} />
              )}
            </button>
          </div>
        );

      default:
        return <input {...commonProps} type={type} />;
    }
  };

  if (type === 'checkbox') {
    return (
      <div className={`form-field form-field-${type} ${className}`} style={fieldContainerStyle}>
        {renderInput()}
        {description && (
          <span style={descriptionStyle}>
            {description}
          </span>
        )}
        {fieldError && (
          <span
            style={{
              ...descriptionStyle,
              color: colors.error,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <ExclamationCircleIcon style={{ width: '14px', height: '14px' }} />
            {fieldError}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`form-field form-field-${type} ${className}`} style={fieldContainerStyle}>
      <label htmlFor={name} style={labelStyle}>
        {label}
        {required && <span style={{ color: colors.error }}> *</span>}
      </label>
      {renderInput()}
      {description && !fieldError && (
        <span style={descriptionStyle}>
          <InformationCircleIcon 
            style={{ 
              width: '14px', 
              height: '14px', 
              display: 'inline-block', 
              marginRight: '4px',
              verticalAlign: 'top'
            }} 
          />
          {description}
        </span>
      )}
      {fieldError && (
        <span
          style={{
            ...descriptionStyle,
            color: colors.error,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <ExclamationCircleIcon style={{ width: '14px', height: '14px' }} />
          {fieldError}
        </span>
      )}
    </div>
  );
}

export default ConfigurationForm;