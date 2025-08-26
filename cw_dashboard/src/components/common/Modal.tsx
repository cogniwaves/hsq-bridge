'use client';

/**
 * Modal Component
 * Reusable modal with animations, accessibility, and flexible content
 */

import { Fragment, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { ModalProps, ConfirmationModalProps } from '../../types/components';

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  footer,
  children,
  testId = 'modal',
  className = '',
  ...props
}: ModalProps) {
  // Handle escape key
  useEffect(() => {
    if (!closeOnEscape) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, closeOnEscape]);

  // Get size classes
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'max-w-md';
      case 'md':
        return 'max-w-lg';
      case 'lg':
        return 'max-w-2xl';
      case 'xl':
        return 'max-w-4xl';
      case 'full':
        return 'max-w-7xl';
      default:
        return 'max-w-lg';
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-50"
        onClose={closeOnOverlayClick ? onClose : () => {}}
        data-testid={testId}
        {...props}
      >
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
            aria-hidden="true"
          />
        </Transition.Child>

        {/* Modal container */}
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel 
                className={`w-full ${getSizeClasses()} transform overflow-hidden rounded-lg text-left align-middle shadow-xl transition-all ${className}`}
                style={{
                  backgroundColor: 'var(--color-surface)',
                  color: 'var(--color-text-primary)'
                }}
              >
                {/* Header */}
                {(title || showCloseButton) && (
                  <div 
                    className="px-6 py-4 border-b"
                    style={{ borderColor: 'var(--color-outline)' }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        {title && (
                          <Dialog.Title
                            as="h3"
                            className="text-lg font-semibold leading-6"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            {title}
                          </Dialog.Title>
                        )}
                        {description && (
                          <Dialog.Description
                            as="p"
                            className="mt-1 text-sm"
                            style={{ color: 'var(--color-text-secondary)' }}
                          >
                            {description}
                          </Dialog.Description>
                        )}
                      </div>
                      {showCloseButton && (
                        <button
                          onClick={onClose}
                          className="rounded-md p-1 hover:opacity-70 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-opacity"
                          style={{
                            '--tw-ring-color': 'var(--color-primary)',
                            '--tw-ring-offset-color': 'var(--color-surface)'
                          }}
                          aria-label="Close modal"
                        >
                          <XMarkIcon 
                            className="h-6 w-6"
                            style={{ color: 'var(--color-text-secondary)' }}
                            aria-hidden="true"
                          />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Content */}
                <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
                  {children}
                </div>

                {/* Footer */}
                {footer && (
                  <div 
                    className="px-6 py-4 border-t"
                    style={{ 
                      borderColor: 'var(--color-outline)',
                      backgroundColor: 'var(--color-surface-variant)'
                    }}
                  >
                    {footer}
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

export function ConfirmationModal({
  type = 'info',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  isLoading = false,
  ...modalProps
}: ConfirmationModalProps) {
  // Get colors based on type
  const getButtonColors = () => {
    switch (type) {
      case 'danger':
        return {
          bg: 'var(--color-error)',
          text: 'var(--color-on-error)',
          hoverBg: 'var(--color-error-container)'
        };
      case 'warning':
        return {
          bg: 'var(--color-warning)',
          text: 'var(--color-on-warning)',
          hoverBg: 'var(--color-warning-container)'
        };
      case 'info':
      default:
        return {
          bg: 'var(--color-primary)',
          text: 'var(--color-on-primary)',
          hoverBg: 'var(--color-primary-container)'
        };
    }
  };

  const colors = getButtonColors();

  const handleConfirm = async () => {
    try {
      await onConfirm();
      modalProps.onClose();
    } catch (error) {
      console.error('Confirmation error:', error);
    }
  };

  return (
    <Modal
      {...modalProps}
      footer={
        <div className="flex justify-end gap-3">
          <button
            onClick={modalProps.onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 disabled:opacity-50"
            style={{
              backgroundColor: 'var(--color-surface-variant)',
              color: 'var(--color-text-primary)'
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 disabled:opacity-50 flex items-center gap-2"
            style={{
              backgroundColor: colors.bg,
              color: colors.text
            }}
          >
            {isLoading && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {confirmText}
          </button>
        </div>
      }
    />
  );
}