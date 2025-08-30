/**
 * Configuration Components Type Definitions
 * TypeScript interfaces for all configuration-related components
 * Integrates with existing API configuration types and theme system
 */

import { ReactNode } from 'react';

// ============================================================================
// Core Configuration Types
// ============================================================================

export type Platform = 'HUBSPOT' | 'STRIPE' | 'QUICKBOOKS';

export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';

export type ConfigType = 'API_KEY' | 'WEBHOOK' | 'OAUTH' | 'SETTINGS';

export type Environment = 'production' | 'test' | 'sandbox' | 'development';

export interface BaseConfiguration {
  id?: string;
  platform: Platform;
  isActive: boolean;
  environment: Environment;
  healthStatus: HealthStatus;
  healthMessage?: string;
  lastHealthCheck?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// ============================================================================
// Connection Status Types
// ============================================================================

export interface ConnectionStatus {
  platform: Platform;
  configured: boolean;
  connected: boolean;
  healthy: boolean;
  lastCheck?: Date;
  message: string;
  details?: Record<string, any>;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: {
    apiReachable?: boolean;
    authValid?: boolean;
    rateLimitOk?: boolean;
    errorCount?: number;
    responseTime?: number;
  };
}

// ============================================================================
// Configuration Card Component Types
// ============================================================================

export interface ConfigurationCardProps {
  platform: Platform;
  title: string;
  description: string;
  status: ConnectionStatus;
  onConfigure: () => void;
  onTest?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
  showActions?: boolean;
  isLoading?: boolean;
}

// ============================================================================
// Configuration Form Types
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings?: ValidationError[];
}

export interface ConfigurationFormProps {
  platform: Platform;
  initialValues?: Record<string, any>;
  onSubmit: (values: Record<string, any>) => Promise<void>;
  onCancel?: () => void;
  onValidate?: (values: Record<string, any>) => Promise<ValidationResult>;
  isLoading?: boolean;
  showAdvanced?: boolean;
  className?: string;
  children?: ReactNode;
}

export interface FormFieldProps {
  name: string;
  label: string;
  type?: 'text' | 'password' | 'email' | 'url' | 'select' | 'textarea' | 'checkbox';
  placeholder?: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
  options?: Array<{ value: string; label: string }>;
  validation?: {
    pattern?: RegExp;
    minLength?: number;
    maxLength?: number;
    custom?: (value: any) => string | null;
  };
  className?: string;
}

// ============================================================================
// API Key Input Types
// ============================================================================

export interface APIKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  platform: Platform;
  label?: string;
  placeholder?: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
  showStrength?: boolean;
  maskInput?: boolean;
  validateOnChange?: boolean;
  className?: string;
  error?: string;
}

export interface APIKeyValidation {
  isValid: boolean;
  strength: 'weak' | 'medium' | 'strong';
  errors: string[];
  format: {
    prefix: string;
    length: number;
    pattern: RegExp;
  };
}

// ============================================================================
// Connection Tester Types
// ============================================================================

export interface ConnectionTesterProps {
  platform: Platform;
  configuration: Record<string, any>;
  onTest: (config: Record<string, any>) => Promise<ConnectionTestResult>;
  onTestComplete?: (result: ConnectionTestResult) => void;
  autoTest?: boolean;
  showHistory?: boolean;
  className?: string;
}

export interface TestHistory {
  id: string;
  timestamp: Date;
  result: ConnectionTestResult;
  config: Record<string, any>;
}

// ============================================================================
// Configuration Wizard Types
// ============================================================================

export interface WizardStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<any>;
  isValid?: (data: Record<string, any>) => boolean;
  isOptional?: boolean;
  canSkip?: boolean;
}

export interface ConfigurationWizardProps {
  platform: Platform;
  steps: WizardStep[];
  onComplete: (data: Record<string, any>) => Promise<void>;
  onCancel?: () => void;
  initialData?: Record<string, any>;
  showProgress?: boolean;
  allowSkip?: boolean;
  className?: string;
}

export interface WizardStepProps {
  data: Record<string, any>;
  onChange: (data: Record<string, any>) => void;
  onValidate?: () => boolean;
  onNext?: () => void;
  onPrevious?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  canProceed?: boolean;
}

// ============================================================================
// Platform-Specific Configuration Types
// ============================================================================

// HubSpot Configuration
export interface HubSpotConfig extends BaseConfiguration {
  apiKey: string;
  portalId?: string;
  accountId?: string;
  scopes?: string[];
  rateLimitPerMinute?: number;
  syncEnabled?: boolean;
  syncInterval?: number;
  features?: Record<string, boolean>;
}

export interface HubSpotConfigFormProps {
  initialConfig?: Partial<HubSpotConfig>;
  onSubmit: (config: HubSpotConfig) => Promise<void>;
  onCancel?: () => void;
  onTest?: (apiKey: string) => Promise<ConnectionTestResult>;
  isLoading?: boolean;
  className?: string;
}

// Stripe Configuration
export interface StripeConfig extends BaseConfiguration {
  secretKey: string;
  publishableKey?: string;
  webhookSecret?: string;
  accountId?: string;
  liveMode: boolean;
  syncEnabled?: boolean;
  features?: Record<string, boolean>;
}

export interface StripeConfigFormProps {
  initialConfig?: Partial<StripeConfig>;
  onSubmit: (config: StripeConfig) => Promise<void>;
  onCancel?: () => void;
  onTest?: (secretKey: string) => Promise<ConnectionTestResult>;
  isLoading?: boolean;
  className?: string;
}

// QuickBooks OAuth Configuration
export interface QuickBooksOAuthState {
  step: 'initiate' | 'authorize' | 'callback' | 'complete';
  authUrl?: string;
  state?: string;
  code?: string;
  realmId?: string;
  companyInfo?: {
    name: string;
    id: string;
    country?: string;
  };
  error?: string;
}

export interface QuickBooksOAuthFlowProps {
  onComplete: (tokens: Record<string, any>) => Promise<void>;
  onCancel?: () => void;
  initialState?: Partial<QuickBooksOAuthState>;
  redirectUri?: string;
  environment?: 'production' | 'sandbox';
  className?: string;
}

// ============================================================================
// Webhook Configuration Types
// ============================================================================

export interface WebhookConfig {
  id?: string;
  platform: Platform;
  endpointUrl: string;
  signingSecret?: string;
  subscribedEvents: string[];
  isActive: boolean;
  authType?: 'SIGNATURE' | 'BEARER' | 'API_KEY' | 'NONE';
  authToken?: string;
  maxRetries?: number;
  timeoutMs?: number;
}

export interface WebhookConfigFormProps {
  platform: Platform;
  initialConfig?: Partial<WebhookConfig>;
  onSubmit: (config: WebhookConfig) => Promise<void>;
  onCancel?: () => void;
  onTestEndpoint?: (url: string) => Promise<ConnectionTestResult>;
  availableEvents?: string[];
  isLoading?: boolean;
  className?: string;
}

// ============================================================================
// Dashboard and Overview Types
// ============================================================================

export interface ConfigurationOverview {
  totalPlatforms: number;
  configuredCount: number;
  healthyCount: number;
  unhealthyCount: number;
  lastUpdated: Date;
  platforms: {
    [K in Platform]: {
      configured: boolean;
      healthy: boolean;
      lastCheck?: Date;
      errorCount: number;
      webhookCount: number;
    };
  };
}

export interface ConfigurationStatusDashboardProps {
  overview: ConfigurationOverview;
  onRefresh?: () => Promise<void>;
  onConfigurePlatform?: (platform: Platform) => void;
  onTestConnections?: () => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

// ============================================================================
// Audit Log Types
// ============================================================================

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: string;
  platform?: Platform;
  entity: string;
  entityId: string;
  performedBy: string;
  performedByEmail?: string;
  ipAddress?: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details?: Record<string, any>;
  changes?: {
    field: string;
    oldValue?: any;
    newValue?: any;
  }[];
}

export interface AuditLogViewerProps {
  logs: AuditLogEntry[];
  onLoadMore?: () => Promise<void>;
  onFilter?: (filters: AuditLogFilters) => Promise<void>;
  onExport?: (format: 'csv' | 'json') => Promise<void>;
  isLoading?: boolean;
  hasMore?: boolean;
  className?: string;
}

export interface AuditLogFilters {
  platform?: Platform;
  action?: string;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  performedBy?: string;
  startDate?: Date;
  endDate?: Date;
  entityType?: string;
}

// ============================================================================
// Backup and Restore Types
// ============================================================================

export interface ConfigurationBackup {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  createdBy: string;
  platforms: Platform[];
  size: number;
  checksum: string;
  configurations: Record<string, any>;
}

export interface BackupRestoreManagerProps {
  onCreateBackup: (name: string, description?: string) => Promise<void>;
  onRestoreBackup: (backupId: string) => Promise<void>;
  onDeleteBackup: (backupId: string) => Promise<void>;
  onExportBackup: (backupId: string) => Promise<void>;
  onImportBackup: (file: File) => Promise<void>;
  backups: ConfigurationBackup[];
  isLoading?: boolean;
  className?: string;
}

// ============================================================================
// Shared Component Props
// ============================================================================

export interface BaseComponentProps {
  className?: string;
  'data-testid'?: string;
  role?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

export interface LoadingStateProps {
  isLoading?: boolean;
  loadingText?: string;
  loadingComponent?: React.ComponentType;
}

export interface ErrorStateProps {
  error?: Error | string | null;
  onRetry?: () => void;
  errorComponent?: React.ComponentType<{ error: Error | string; onRetry?: () => void }>;
}

// ============================================================================
// Theme Integration Types
// ============================================================================

export interface ConfigurationTheme {
  colors: {
    status: {
      healthy: string;
      degraded: string;
      unhealthy: string;
      unknown: string;
    };
    platform: {
      hubspot: string;
      stripe: string;
      quickbooks: string;
    };
  };
  spacing: {
    card: {
      padding: string;
      margin: string;
      gap: string;
    };
    form: {
      fieldSpacing: string;
      sectionSpacing: string;
    };
  };
}

// ============================================================================
// Export Types
// ============================================================================

export type ConfigurationComponentProps =
  | ConfigurationCardProps
  | ConfigurationFormProps
  | APIKeyInputProps
  | ConnectionTesterProps
  | ConfigurationWizardProps
  | HubSpotConfigFormProps
  | StripeConfigFormProps
  | QuickBooksOAuthFlowProps
  | WebhookConfigFormProps
  | ConfigurationStatusDashboardProps
  | AuditLogViewerProps
  | BackupRestoreManagerProps;