/**
 * Component Type Definitions
 * Types for UI components
 */

import { ReactNode } from 'react';

export interface ToastNotificationProps {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number; // milliseconds, 0 for no auto-dismiss
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  onClose?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
  testId?: string;
  className?: string;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  footer?: ReactNode;
  children: ReactNode;
  testId?: string;
  className?: string;
}

export interface ConfirmationModalProps extends Omit<ModalProps, 'footer'> {
  type?: 'info' | 'warning' | 'danger';
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
}