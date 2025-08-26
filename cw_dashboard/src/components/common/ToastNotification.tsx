'use client';

/**
 * Toast Notification Component
 * Displays success/error/info messages with animations and auto-dismiss
 */

import { Fragment, useEffect, useState } from 'react';
import { Transition } from '@headlessui/react';
import { 
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { ToastNotificationProps } from '../../types/components';

// Toast context for managing multiple toasts
export const ToastContainer: React.FC<{
  toasts: ToastNotificationProps[];
  position?: ToastNotificationProps['position'];
  onClose: (id: string) => void;
}> = ({ toasts, position = 'top-right', onClose }) => {
  // Get position classes
  const getContainerClasses = () => {
    const base = 'fixed z-50 flex flex-col gap-4 p-4 pointer-events-none';
    
    switch (position) {
      case 'top-left':
        return `${base} top-0 left-0 items-start`;
      case 'top-center':
        return `${base} top-0 left-1/2 -translate-x-1/2 items-center`;
      case 'top-right':
        return `${base} top-0 right-0 items-end`;
      case 'bottom-left':
        return `${base} bottom-0 left-0 items-start`;
      case 'bottom-center':
        return `${base} bottom-0 left-1/2 -translate-x-1/2 items-center`;
      case 'bottom-right':
        return `${base} bottom-0 right-0 items-end`;
      default:
        return `${base} top-0 right-0 items-end`;
    }
  };

  return (
    <div className={getContainerClasses()} aria-live="assertive" aria-atomic="true">
      {toasts.map(toast => (
        <ToastNotification
          key={toast.id}
          {...toast}
          onClose={() => onClose(toast.id)}
        />
      ))}
    </div>
  );
};

export function ToastNotification({
  id,
  type,
  title,
  message,
  duration = 5000,
  onClose,
  action,
  position,
  testId = 'toast-notification',
  className = '',
  ...props
}: ToastNotificationProps) {
  const [show, setShow] = useState(true);
  const [progress, setProgress] = useState(100);

  // Auto-dismiss timer
  useEffect(() => {
    if (duration && duration > 0) {
      const timer = setTimeout(() => {
        setShow(false);
        setTimeout(() => onClose?.(), 300); // Wait for animation
      }, duration);

      // Progress bar animation
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          const next = prev - (100 / (duration / 100));
          return next > 0 ? next : 0;
        });
      }, 100);

      return () => {
        clearTimeout(timer);
        clearInterval(progressInterval);
      };
    }
  }, [duration, onClose]);

  // Get icon based on type
  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <CheckCircleIcon 
            className="h-6 w-6 flex-shrink-0"
            style={{ color: 'var(--color-success)' }}
            aria-hidden="true"
          />
        );
      case 'error':
        return (
          <XCircleIcon 
            className="h-6 w-6 flex-shrink-0"
            style={{ color: 'var(--color-error)' }}
            aria-hidden="true"
          />
        );
      case 'warning':
        return (
          <ExclamationTriangleIcon 
            className="h-6 w-6 flex-shrink-0"
            style={{ color: 'var(--color-warning)' }}
            aria-hidden="true"
          />
        );
      case 'info':
        return (
          <InformationCircleIcon 
            className="h-6 w-6 flex-shrink-0"
            style={{ color: 'var(--color-primary)' }}
            aria-hidden="true"
          />
        );
      default:
        return null;
    }
  };

  // Get background color based on type
  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return 'var(--color-success-container)';
      case 'error':
        return 'var(--color-error-container)';
      case 'warning':
        return 'var(--color-warning-container)';
      case 'info':
        return 'var(--color-primary-container)';
      default:
        return 'var(--color-surface)';
    }
  };

  // Get text color based on type
  const getTextColor = () => {
    switch (type) {
      case 'success':
        return 'var(--color-on-success-container)';
      case 'error':
        return 'var(--color-on-error-container)';
      case 'warning':
        return 'var(--color-on-warning-container)';
      case 'info':
        return 'var(--color-on-primary-container)';
      default:
        return 'var(--color-text-primary)';
    }
  };

  return (
    <Transition
      show={show}
      as={Fragment}
      enter="transform ease-out duration-300 transition"
      enterFrom="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
      enterTo="translate-y-0 opacity-100 sm:translate-x-0"
      leave="transition ease-in duration-200"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      <div
        className={`relative max-w-sm w-full shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden ${className}`}
        style={{
          backgroundColor: getBackgroundColor(),
          color: getTextColor()
        }}
        data-testid={testId}
        role={type === 'error' ? 'alert' : 'status'}
        {...props}
      >
        <div className="p-4">
          <div className="flex items-start">
            {getIcon()}
            <div className="ml-3 w-0 flex-1">
              <p className="text-sm font-medium">
                {title}
              </p>
              {message && (
                <p className="mt-1 text-sm opacity-90">
                  {message}
                </p>
              )}
              {action && (
                <div className="mt-3">
                  <button
                    onClick={action.onClick}
                    className="text-sm font-medium underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-offset-2 rounded"
                    style={{
                      '--tw-ring-color': 'currentColor',
                      '--tw-ring-offset-color': getBackgroundColor()
                    }}
                  >
                    {action.label}
                  </button>
                </div>
              )}
            </div>
            <div className="ml-4 flex-shrink-0 flex">
              <button
                className="rounded-md inline-flex text-current hover:opacity-70 focus:outline-none focus:ring-2 focus:ring-offset-2"
                onClick={() => {
                  setShow(false);
                  setTimeout(() => onClose?.(), 300);
                }}
                style={{
                  '--tw-ring-color': 'currentColor',
                  '--tw-ring-offset-color': getBackgroundColor()
                }}
                aria-label="Close notification"
              >
                <XMarkIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        {duration && duration > 0 && (
          <div 
            className="absolute bottom-0 left-0 right-0 h-1"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)' }}
          >
            <div 
              className="h-full transition-all duration-100 ease-linear"
              style={{
                width: `${progress}%`,
                backgroundColor: 'currentColor',
                opacity: 0.3
              }}
            />
          </div>
        )}
      </div>
    </Transition>
  );
}

// Hook for managing toasts
export function useToast() {
  const [toasts, setToasts] = useState<ToastNotificationProps[]>([]);

  const showToast = (toast: Omit<ToastNotificationProps, 'id'>) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { ...toast, id }]);
    return id;
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const showSuccess = (title: string, message?: string, duration?: number) => {
    return showToast({ type: 'success', title, message, duration });
  };

  const showError = (title: string, message?: string, duration?: number) => {
    return showToast({ type: 'error', title, message, duration });
  };

  const showWarning = (title: string, message?: string, duration?: number) => {
    return showToast({ type: 'warning', title, message, duration });
  };

  const showInfo = (title: string, message?: string, duration?: number) => {
    return showToast({ type: 'info', title, message, duration });
  };

  return {
    toasts,
    showToast,
    removeToast,
    showSuccess,
    showError,
    showWarning,
    showInfo
  };
}