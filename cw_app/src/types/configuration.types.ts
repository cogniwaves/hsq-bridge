/**
 * Configuration Management Type Definitions
 * Comprehensive types for QuickBooks, HubSpot, and Stripe integration configurations
 */

import { Platform } from '@prisma/client';

// ============================================================================
// Integration Configuration Types
// ============================================================================

export enum ConfigType {
  API_KEY = 'API_KEY',
  WEBHOOK = 'WEBHOOK',
  OAUTH = 'OAUTH',
  SETTINGS = 'SETTINGS'
}

export enum SyncDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
  BIDIRECTIONAL = 'BIDIRECTIONAL'
}

export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  UNHEALTHY = 'UNHEALTHY',
  UNKNOWN = 'UNKNOWN'
}

export interface IntegrationConfig {
  id: string;
  tenantId: string;
  platform: Platform;
  configType: ConfigType;
  isActive: boolean;
  isPrimary: boolean;
  
  // API Configuration
  apiKey?: string | null;
  apiSecret?: string | null;
  apiEndpoint?: string | null;
  apiVersion?: string | null;
  
  // Platform-specific identifiers
  hubspotPortalId?: string | null;
  hubspotAccountId?: string | null;
  stripeAccountId?: string | null;
  quickbooksCompanyId?: string | null;
  
  // Connection settings
  environment: string;
  rateLimitPerMinute?: number | null;
  timeoutMs: number;
  maxRetries: number;
  
  // Sync configuration
  syncEnabled: boolean;
  syncInterval?: number | null;
  lastSyncAt?: Date | null;
  nextSyncAt?: Date | null;
  syncDirection: SyncDirection;
  
  // Feature flags and rules
  features?: Record<string, any> | null;
  mappingRules?: Record<string, any> | null;
  filterRules?: Record<string, any> | null;
  transformRules?: Record<string, any> | null;
  
  // Validation and health
  lastHealthCheckAt?: Date | null;
  healthStatus: HealthStatus;
  healthMessage?: string | null;
  validatedAt?: Date | null;
  validatedBy?: string | null;
  
  // Metadata
  metadata?: Record<string, any> | null;
  createdBy?: string | null;
  createdAt: Date;
  updatedBy?: string | null;
  updatedAt: Date;
  deletedAt?: Date | null;
}

// ============================================================================
// Webhook Configuration Types
// ============================================================================

export enum WebhookType {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND'
}

export enum WebhookAuthType {
  NONE = 'NONE',
  SIGNATURE = 'SIGNATURE',
  BEARER = 'BEARER',
  API_KEY = 'API_KEY',
  BASIC = 'BASIC',
  CUSTOM = 'CUSTOM'
}

export enum CircuitBreakerStatus {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface WebhookConfiguration {
  id: string;
  tenantId: string;
  integrationConfigId: string;
  platform: Platform;
  webhookType: WebhookType;
  
  // Webhook endpoint configuration
  endpointUrl: string;
  httpMethod: string;
  isActive: boolean;
  
  // Security
  signingSecret?: string | null;
  authType: WebhookAuthType;
  authToken?: string | null;
  customHeaders?: Record<string, string> | null;
  
  // Event configuration
  subscribedEvents: string[];
  eventFilters?: Record<string, any> | null;
  payloadTemplate?: Record<string, any> | null;
  
  // Retry configuration
  maxRetries: number;
  retryDelayMs: number;
  retryBackoffMultiplier: number;
  timeoutMs: number;
  
  // Monitoring
  lastTriggerAt?: Date | null;
  lastSuccessAt?: Date | null;
  lastFailureAt?: Date | null;
  lastErrorMessage?: string | null;
  consecutiveFailures: number;
  totalTriggerCount: number;
  totalSuccessCount: number;
  totalFailureCount: number;
  
  // Circuit breaker
  circuitBreakerEnabled: boolean;
  circuitBreakerThreshold: number;
  circuitBreakerResetAfterMs: number;
  circuitBreakerStatus: CircuitBreakerStatus;
  circuitBreakerOpenedAt?: Date | null;
  
  // Platform-specific fields
  hubspotAppId?: string | null;
  hubspotSubscriptionId?: string | null;
  stripeWebhookEndpointId?: string | null;
  quickbooksWebhookToken?: string | null;
  
  // Metadata
  metadata?: Record<string, any> | null;
  createdBy?: string | null;
  createdAt: Date;
  updatedBy?: string | null;
  updatedAt: Date;
  deletedAt?: Date | null;
}

// ============================================================================
// Audit Log Types
// ============================================================================

export enum ConfigEntityType {
  INTEGRATION_CONFIG = 'INTEGRATION_CONFIG',
  WEBHOOK_CONFIG = 'WEBHOOK_CONFIG',
  OAUTH_TOKEN = 'OAUTH_TOKEN'
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  ACTIVATE = 'ACTIVATE',
  DEACTIVATE = 'DEACTIVATE',
  VALIDATE = 'VALIDATE',
  REFRESH = 'REFRESH',
  REVOKE = 'REVOKE',
  TEST = 'TEST'
}

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface ConfigurationAuditLog {
  id: string;
  tenantId: string;
  entityType: ConfigEntityType;
  entityId: string;
  action: AuditAction;
  
  // Change tracking
  fieldName?: string | null;
  oldValue?: any | null;
  newValue?: any | null;
  changeReason?: string | null;
  
  // Security context
  performedBy: string;
  performedByEmail?: string | null;
  performedByName?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  sessionId?: string | null;
  
  // Risk assessment
  riskLevel: RiskLevel;
  requiresReview: boolean;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  reviewNotes?: string | null;
  
  // Metadata
  platform?: Platform | null;
  environment?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: Date;
}

// ============================================================================
// Extended OAuth Token Types
// ============================================================================

export interface ExtendedOAuthToken {
  id: string;
  provider: string;
  tenantId?: string | null;
  accessToken: string;
  refreshToken?: string | null;
  tokenType: string;
  expiresAt: Date;
  refreshTokenExpiresAt?: Date | null;
  scope?: string | null;
  
  // QuickBooks specific
  realmId?: string | null;
  companyId?: string | null;
  
  // HubSpot OAuth specific
  hubspotPortalId?: string | null;
  hubspotUserId?: string | null;
  hubspotAppId?: string | null;
  
  // Stripe OAuth specific
  stripeAccountId?: string | null;
  stripeUserId?: string | null;
  stripeLivemode: boolean;
  
  // Token management
  lastRefreshedAt?: Date | null;
  refreshCount: number;
  failedRefreshCount: number;
  lastRefreshError?: string | null;
  isActive: boolean;
  revokedAt?: Date | null;
  revokedBy?: string | null;
  revokedReason?: string | null;
  
  // Encryption
  encryptionMethod: string;
  encryptionIV?: string | null;
  encryptionKeyVersion: number;
  
  // Metadata
  metadata?: Record<string, any> | null;
  createdBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Helper Types for API Requests
// ============================================================================

export interface CreateIntegrationConfigRequest {
  tenantId: string;
  platform: Platform;
  configType: ConfigType;
  apiKey?: string;
  apiSecret?: string;
  environment?: string;
  syncEnabled?: boolean;
  syncInterval?: number;
  features?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface UpdateIntegrationConfigRequest {
  isActive?: boolean;
  apiKey?: string;
  apiSecret?: string;
  syncEnabled?: boolean;
  syncInterval?: number;
  features?: Record<string, any>;
  mappingRules?: Record<string, any>;
  filterRules?: Record<string, any>;
  transformRules?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface CreateWebhookConfigRequest {
  tenantId: string;
  integrationConfigId: string;
  platform: Platform;
  webhookType: WebhookType;
  endpointUrl: string;
  signingSecret?: string;
  authType?: WebhookAuthType;
  authToken?: string;
  subscribedEvents: string[];
  eventFilters?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface HealthCheckResult {
  platform: Platform;
  status: HealthStatus;
  message?: string;
  lastCheckedAt: Date;
  details?: {
    apiReachable?: boolean;
    authValid?: boolean;
    rateLimitOk?: boolean;
    webhookActive?: boolean;
    lastSyncSuccess?: boolean;
    errorCount?: number;
  };
}

// ============================================================================
// Encryption Helper Types
// ============================================================================

export interface EncryptedField {
  value: string;
  iv: string;
  method: string;
  keyVersion: number;
}

export interface DecryptedConfig {
  apiKey?: string;
  apiSecret?: string;
  signingSecret?: string;
  authToken?: string;
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ConfigValidationResult {
  isValid: boolean;
  errors: ConfigValidationError[];
  warnings: ConfigValidationWarning[];
}

export interface ConfigValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ConfigValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}