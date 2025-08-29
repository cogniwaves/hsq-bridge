/**
 * Configuration Wizard Component
 * Multi-step configuration wizard with Material Design 3 styling
 * Progress indicator, step validation, and dynamic navigation
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useTheme } from '../../design-system/themes/themeProvider';
import { ConfigurationWizardProps, WizardStepProps } from './types';
import { getPlatformInfo } from './utils';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

export function ConfigurationWizard({
  platform,
  steps,
  onComplete,
  onCancel,
  initialData = {},
  showProgress = true,
  allowSkip = false,
  className = '',
}: ConfigurationWizardProps) {
  const { theme, resolvedMode } = useTheme();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [wizardData, setWizardData] = useState(initialData);
  const [stepValidation, setStepValidation] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const platformInfo = getPlatformInfo(platform);
  const colors = theme.colors;
  const isDark = resolvedMode === 'dark';

  const currentStep = steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  // Calculate progress
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  // Validate current step
  const validateCurrentStep = useCallback(() => {
    if (!currentStep.isValid) return true;
    
    const isValid = currentStep.isValid(wizardData);
    setStepValidation(prev => ({
      ...prev,
      [currentStep.id]: isValid,
    }));
    return isValid;
  }, [currentStep, wizardData]);

  // Handle data change
  const handleDataChange = useCallback((newData: Record<string, any>) => {
    const updatedData = { ...wizardData, ...newData };
    setWizardData(updatedData);
    
    // Re-validate current step
    if (currentStep.isValid) {
      const isValid = currentStep.isValid(updatedData);
      setStepValidation(prev => ({
        ...prev,
        [currentStep.id]: isValid,
      }));
    }
  }, [wizardData, currentStep]);

  // Navigation handlers
  const goToNextStep = useCallback(() => {
    if (isLastStep) return;
    
    const isCurrentStepValid = validateCurrentStep();
    if (!isCurrentStepValid && !currentStep.canSkip) return;
    
    setCurrentStepIndex(prev => Math.min(prev + 1, steps.length - 1));
  }, [isLastStep, validateCurrentStep, currentStep.canSkip, steps.length]);

  const goToPreviousStep = useCallback(() => {
    if (isFirstStep) return;
    setCurrentStepIndex(prev => Math.max(prev - 1, 0));
  }, [isFirstStep]);

  const goToStep = useCallback((stepIndex: number) => {
    if (stepIndex < 0 || stepIndex >= steps.length) return;
    setCurrentStepIndex(stepIndex);
  }, [steps.length]);

  // Form submission
  const handleComplete = async () => {
    if (isSubmitting) return;
    
    // Validate all steps
    const allStepsValid = steps.every(step => {
      if (!step.isValid) return true;
      return step.isValid(wizardData);
    });

    if (!allStepsValid) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      await onComplete(wizardData);
    } catch (error) {
      console.error('Wizard completion error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Component styles
  const wizardStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: colors.surface,
    borderRadius: theme.components?.card?.borderRadius || '12px',
    border: `1px solid ${colors.outlineVariant}`,
    maxWidth: '800px',
    width: '100%',
    minHeight: '600px',
    overflow: 'hidden',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing?.container?.lg || '32px',
    paddingBottom: theme.spacing?.container?.md || '16px',
    borderBottom: `1px solid ${colors.outlineVariant}`,
  };

  const titleSectionStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing?.component?.md || '16px',
    marginBottom: theme.spacing?.component?.lg || '20px',
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
    ...theme.typography?.headlineLarge,
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

  // Progress indicator component
  const ProgressIndicator = () => {
    if (!showProgress) return null;

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing?.component?.md || '12px',
        }}
      >
        {/* Progress Bar */}
        <div
          style={{
            width: '100%',
            height: '6px',
            backgroundColor: colors.outlineVariant,
            borderRadius: '3px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              backgroundColor: colors.primary,
              transition: `width ${theme.motion?.duration?.medium2 || '300ms'} ${theme.motion?.easing?.emphasized || 'ease-out'}`,
            }}
          />
        </div>

        {/* Step Indicators */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '8px',
          }}
        >
          {steps.map((step, index) => {
            const isPast = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const isValid = stepValidation[step.id] ?? false;
            const canNavigate = index <= currentStepIndex || isPast;

            return (
              <div
                key={step.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  minWidth: 0,
                }}
              >
                <button
                  onClick={() => canNavigate && goToStep(index)}
                  disabled={!canNavigate}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    border: 'none',
                    cursor: canNavigate ? 'pointer' : 'default',
                    backgroundColor: isPast 
                      ? colors.primary 
                      : isCurrent 
                        ? colors.primaryContainer 
                        : colors.surfaceVariant,
                    color: isPast 
                      ? colors.onPrimary 
                      : isCurrent 
                        ? colors.primary 
                        : colors.onSurfaceVariant,
                    transition: `all ${theme.motion?.duration?.short2 || '150ms'} ${theme.motion?.easing?.standard || 'ease'}`,
                    opacity: canNavigate ? 1 : 0.6,
                  }}
                  title={step.title}
                >
                  {isPast ? (
                    isValid || !step.isValid ? (
                      <CheckIcon style={{ width: '16px', height: '16px' }} />
                    ) : (
                      <ExclamationTriangleIcon style={{ width: '16px', height: '16px' }} />
                    )
                  ) : (
                    <span style={{ ...theme.typography?.labelMedium, fontWeight: 600 }}>
                      {index + 1}
                    </span>
                  )}
                </button>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: 0,
                    flex: index === steps.length - 1 ? 0 : 1,
                  }}
                >
                  <span
                    style={{
                      ...theme.typography?.labelMedium,
                      color: isCurrent ? colors.primary : colors.onSurfaceVariant,
                      fontWeight: isCurrent ? 600 : 500,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {step.title}
                  </span>
                  {step.isOptional && (
                    <span
                      style={{
                        ...theme.typography?.labelSmall,
                        color: colors.onSurfaceVariant,
                        opacity: 0.7,
                      }}
                    >
                      Optional
                    </span>
                  )}
                </div>

                {index < steps.length - 1 && (
                  <div
                    style={{
                      width: '24px',
                      height: '2px',
                      backgroundColor: index < currentStepIndex ? colors.primary : colors.outlineVariant,
                      transition: `background-color ${theme.motion?.duration?.short2 || '150ms'} ${theme.motion?.easing?.standard || 'ease'}`,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Step content component
  const StepContent = () => {
    const StepComponent = currentStep.component;
    const isCurrentStepValid = stepValidation[currentStep.id] ?? false;

    const stepProps: WizardStepProps = {
      data: wizardData,
      onChange: handleDataChange,
      onValidate: validateCurrentStep,
      onNext: goToNextStep,
      onPrevious: goToPreviousStep,
      isFirst: isFirstStep,
      isLast: isLastStep,
      canProceed: isCurrentStepValid || currentStep.canSkip,
    };

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          padding: theme.spacing?.container?.lg || '32px',
          gap: theme.spacing?.component?.lg || '24px',
        }}
      >
        {/* Step Header */}
        <div>
          <h3
            style={{
              ...theme.typography?.headlineMedium,
              color: colors.onSurface,
              margin: 0,
              marginBottom: '8px',
              fontWeight: 600,
            }}
          >
            {currentStep.title}
          </h3>
          {currentStep.description && (
            <p
              style={{
                ...theme.typography?.bodyLarge,
                color: colors.onSurfaceVariant,
                margin: 0,
                opacity: 0.8,
              }}
            >
              {currentStep.description}
            </p>
          )}
        </div>

        {/* Step Component */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <StepComponent {...stepProps} />
        </div>
      </div>
    );
  };

  // Actions component
  const Actions = () => {
    const isCurrentStepValid = stepValidation[currentStep.id] ?? false;
    const canProceed = isCurrentStepValid || currentStep.canSkip || currentStep.isOptional;

    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: theme.spacing?.container?.lg || '24px',
          borderTop: `1px solid ${colors.outlineVariant}`,
          gap: theme.spacing?.component?.md || '16px',
        }}
      >
        {/* Cancel Button */}
        <button
          type="button"
          onClick={onCancel}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            backgroundColor: 'transparent',
            color: colors.onSurfaceVariant,
            border: `1px solid ${colors.outlineVariant}`,
            borderRadius: '8px',
            cursor: 'pointer',
            ...theme.typography?.labelLarge,
            fontWeight: 600,
            transition: `all ${theme.motion?.duration?.short2 || '150ms'} ${theme.motion?.easing?.standard || 'ease'}`,
          }}
          disabled={isSubmitting}
        >
          <XMarkIcon style={{ width: '16px', height: '16px' }} />
          Cancel
        </button>

        {/* Navigation Buttons */}
        <div
          style={{
            display: 'flex',
            gap: theme.spacing?.component?.md || '12px',
          }}
        >
          {/* Previous Button */}
          {!isFirstStep && (
            <button
              type="button"
              onClick={goToPreviousStep}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 20px',
                backgroundColor: 'transparent',
                color: colors.primary,
                border: `1px solid ${colors.primary}`,
                borderRadius: '8px',
                cursor: 'pointer',
                ...theme.typography?.labelLarge,
                fontWeight: 600,
                transition: `all ${theme.motion?.duration?.short2 || '150ms'} ${theme.motion?.easing?.standard || 'ease'}`,
              }}
              disabled={isSubmitting}
            >
              <ChevronLeftIcon style={{ width: '16px', height: '16px' }} />
              Previous
            </button>
          )}

          {/* Next/Complete Button */}
          <button
            type="button"
            onClick={isLastStep ? handleComplete : goToNextStep}
            disabled={(!canProceed && !allowSkip) || isSubmitting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              backgroundColor: colors.primary,
              color: colors.onPrimary,
              border: 'none',
              borderRadius: '8px',
              cursor: (!canProceed && !allowSkip) || isSubmitting ? 'not-allowed' : 'pointer',
              ...theme.typography?.labelLarge,
              fontWeight: 600,
              opacity: (!canProceed && !allowSkip) || isSubmitting ? 0.6 : 1,
              transition: `all ${theme.motion?.duration?.short2 || '150ms'} ${theme.motion?.easing?.standard || 'ease'}`,
            }}
          >
            {isSubmitting ? (
              <>
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    border: `2px solid transparent`,
                    borderTop: `2px solid ${colors.onPrimary}`,
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }}
                />
                Completing...
              </>
            ) : isLastStep ? (
              <>
                Complete Setup
                <CheckIcon style={{ width: '16px', height: '16px' }} />
              </>
            ) : (
              <>
                {!canProceed && allowSkip ? 'Skip' : 'Next'}
                <ChevronRightIcon style={{ width: '16px', height: '16px' }} />
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`configuration-wizard configuration-wizard-${platform.toLowerCase()} ${className}`}
      style={wizardStyle}
      data-testid={`configuration-wizard-${platform.toLowerCase()}`}
    >
      {/* Header */}
      <div style={headerStyle}>
        <div style={titleSectionStyle}>
          <div style={platformIconStyle}>
            {platformInfo.icon}
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={titleStyle}>Configure {platformInfo.name}</h1>
            <p style={subtitleStyle}>
              Step {currentStepIndex + 1} of {steps.length}: {currentStep.title}
            </p>
          </div>
        </div>

        <ProgressIndicator />
      </div>

      {/* Step Content */}
      <StepContent />

      {/* Actions */}
      <Actions />

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .configuration-wizard button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .configuration-wizard button:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }
      `}</style>
    </div>
  );
}

export default ConfigurationWizard;