/**
 * Component Type Definitions
 * Comprehensive types for authentication and user management components
 */

import { ReactNode, HTMLAttributes, ButtonHTMLAttributes, InputHTMLAttributes } from 'react';
import { User, Tenant, TenantRole, TenantMembership, InvitationData } from './auth';

// ==================== Common Component Props ====================

export interface BaseComponentProps extends HTMLAttributes<HTMLElement> {
  testId?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

export interface LoadingState {
  isLoading?: boolean;
  loadingText?: string;
}

export interface ErrorState {
  error?: string | null;
  onRetry?: () => void;
}

export interface ValidationState {
  isValid?: boolean;
  validationMessage?: string;
  touched?: boolean;
}

// ==================== Form Component Props ====================

export interface FormFieldProps extends BaseComponentProps, ValidationState {
  label: string;
  name: string;
  required?: boolean;
  disabled?: boolean;
  helpText?: string;
  showLabel?: boolean;
}

export interface TextInputProps extends FormFieldProps, InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  onClear?: () => void;
  showClear?: boolean;
}

export interface PasswordInputProps extends TextInputProps {
  showPasswordToggle?: boolean;
  showStrengthIndicator?: boolean;
  minLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumbers?: boolean;
  requireSpecialChars?: boolean;
}

export interface CheckboxProps extends FormFieldProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  indeterminate?: boolean;
}

export interface SelectOption<T = string> {
  value: T;
  label: string;
  disabled?: boolean;
  icon?: ReactNode;
  description?: string;
}

export interface SelectProps<T = string> extends FormFieldProps {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  searchable?: boolean;
  clearable?: boolean;
  multi?: boolean;
}

// ==================== Authentication Component Props ====================

export interface SignInFormProps extends BaseComponentProps, LoadingState, ErrorState {
  onSubmit?: (data: { email: string; password: string; rememberMe: boolean }) => void | Promise<void>;
  onForgotPassword?: () => void;
  onSignUp?: () => void;
  defaultEmail?: string;
  disableRememberMe?: boolean;
  redirectUrl?: string;
}

export interface SignUpFormProps extends BaseComponentProps, LoadingState, ErrorState {
  onSubmit?: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    tenantName?: string;
    acceptedTerms: boolean;
  }) => void | Promise<void>;
  onSignIn?: () => void;
  requireTenantName?: boolean;
  termsUrl?: string;
  privacyUrl?: string;
  invitation?: InvitationData;
}

export interface PasswordResetFormProps extends BaseComponentProps, LoadingState, ErrorState {
  mode: 'request' | 'reset';
  token?: string;
  onSubmit?: (data: { email?: string; password?: string; token?: string }) => void | Promise<void>;
  onBack?: () => void;
}

export interface EmailVerificationCardProps extends BaseComponentProps, LoadingState {
  email?: string;
  status: 'pending' | 'verified' | 'failed' | 'expired';
  onResend?: () => void | Promise<void>;
  onContinue?: () => void;
  resendCooldown?: number;
}

export interface InvitationCardProps extends BaseComponentProps, LoadingState {
  invitation: InvitationData;
  onAccept?: () => void | Promise<void>;
  onDecline?: () => void | Promise<void>;
  showTeamPreview?: boolean;
}

// ==================== User Profile Component Props ====================

export interface UserProfileCardProps extends BaseComponentProps {
  user: User;
  editable?: boolean;
  onEdit?: (user: Partial<User>) => void | Promise<void>;
  onChangePassword?: () => void;
  onChangeAvatar?: (file: File) => void | Promise<void>;
  showMemberships?: boolean;
  compact?: boolean;
}

export interface UserMenuProps extends BaseComponentProps {
  user: User;
  tenant?: Tenant;
  onProfile?: () => void;
  onSettings?: () => void;
  onSignOut?: () => void;
  onSwitchTenant?: () => void;
  customMenuItems?: Array<{
    label: string;
    icon?: ReactNode;
    onClick: () => void;
    divider?: boolean;
  }>;
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
}

export interface ChangePasswordFormProps extends BaseComponentProps, LoadingState, ErrorState {
  requireCurrentPassword?: boolean;
  onSubmit?: (data: {
    currentPassword?: string;
    newPassword: string;
    confirmPassword: string;
  }) => void | Promise<void>;
  onCancel?: () => void;
  passwordRequirements?: PasswordRequirements;
}

export interface PasswordRequirements {
  minLength?: number;
  maxLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumbers?: boolean;
  requireSpecialChars?: boolean;
  customRules?: Array<{
    test: (password: string) => boolean;
    message: string;
  }>;
}

export interface UserSettingsProps extends BaseComponentProps, LoadingState {
  user: User;
  categories?: Array<{
    id: string;
    label: string;
    icon?: ReactNode;
  }>;
  onSave?: (settings: Record<string, any>) => void | Promise<void>;
  onCancel?: () => void;
}

// ==================== Team Management Component Props ====================

export interface TenantSwitcherProps extends BaseComponentProps, LoadingState {
  currentTenant: Tenant | null;
  memberships: TenantMembership[];
  onSwitch?: (tenantId: string) => void | Promise<void>;
  onCreate?: () => void;
  searchable?: boolean;
  showRole?: boolean;
  compact?: boolean;
}

export interface TenantCardProps extends BaseComponentProps {
  tenant: Tenant;
  membership?: TenantMembership;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  showActions?: boolean;
  selected?: boolean;
  compact?: boolean;
}

export interface MemberListProps extends BaseComponentProps, LoadingState {
  members: Array<{
    id: string;
    user: User;
    role: TenantRole;
    joinedAt: string;
  }>;
  currentUserId?: string;
  onRoleChange?: (memberId: string, newRole: TenantRole) => void | Promise<void>;
  onRemove?: (memberId: string) => void | Promise<void>;
  onInvite?: () => void;
  searchable?: boolean;
  sortable?: boolean;
  pageSize?: number;
}

export interface InviteModalProps extends BaseComponentProps, LoadingState, ErrorState {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: {
    email: string;
    role: TenantRole;
    message?: string;
  }) => void | Promise<void>;
  tenantName?: string;
  availableRoles?: TenantRole[];
  defaultRole?: TenantRole;
}

export interface MemberRoleSelectProps extends BaseComponentProps {
  value: TenantRole;
  onChange: (role: TenantRole) => void;
  availableRoles?: TenantRole[];
  disabled?: boolean;
  showDescription?: boolean;
  compact?: boolean;
}

// ==================== UI Enhancement Props ====================

export interface SkeletonLoaderProps extends BaseComponentProps {
  type?: 'text' | 'title' | 'avatar' | 'thumbnail' | 'card' | 'list';
  lines?: number;
  width?: string | number;
  height?: string | number;
  animate?: boolean;
  rounded?: boolean;
}

export interface ToastNotificationProps extends BaseComponentProps {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  onClose?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
}

export interface ModalProps extends BaseComponentProps {
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
}

export interface ConfirmationModalProps extends ModalProps {
  type?: 'info' | 'warning' | 'danger';
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
}

export interface EmptyStateProps extends BaseComponentProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

export interface ErrorBoundaryProps extends BaseComponentProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
}

// ==================== Animation & Transition Props ====================

export interface TransitionProps extends BaseComponentProps {
  show: boolean;
  enter?: string;
  enterFrom?: string;
  enterTo?: string;
  leave?: string;
  leaveFrom?: string;
  leaveTo?: string;
  duration?: number;
  children: ReactNode;
}

export interface AnimatedPresenceProps extends BaseComponentProps {
  children: ReactNode;
  mode?: 'wait' | 'sync' | 'popLayout';
  initial?: boolean;
  custom?: any;
  onExitComplete?: () => void;
}

// ==================== Accessibility Props ====================

export interface A11yProps {
  role?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  ariaExpanded?: boolean;
  ariaHidden?: boolean;
  ariaLive?: 'off' | 'polite' | 'assertive';
  ariaAtomic?: boolean;
  ariaRelevant?: 'additions' | 'removals' | 'text' | 'all';
  tabIndex?: number;
}

export interface FocusTrapProps extends BaseComponentProps {
  active?: boolean;
  children: ReactNode;
  initialFocus?: string;
  finalFocus?: string;
  returnFocus?: boolean;
  allowOutsideClick?: boolean;
  escapeDeactivates?: boolean;
}

// ==================== Utility Types ====================

export type ComponentSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type ComponentVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger';
export type ComponentStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ComponentTheme {
  size?: ComponentSize;
  variant?: ComponentVariant;
  fullWidth?: boolean;
  rounded?: boolean | 'sm' | 'md' | 'lg' | 'full';
}