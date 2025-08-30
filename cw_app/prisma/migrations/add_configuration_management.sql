-- ============================================================================
-- Migration: Add Configuration Management System
-- Description: Extends schema to support comprehensive configuration management
--              for QuickBooks, HubSpot, and Stripe integrations
-- Author: Prisma Database Schema Architect
-- Date: 2025-08-29
-- ============================================================================

-- Step 1: Extend oauth_tokens table with platform-specific fields
-- Note: These are additive changes that won't affect existing data

ALTER TABLE oauth_tokens
ADD COLUMN IF NOT EXISTS hubspot_portal_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS hubspot_user_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS hubspot_app_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_user_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_livemode BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS revoked_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS revoked_reason TEXT,
ADD COLUMN IF NOT EXISTS encryption_key_version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS metadata JSONB,
ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);

-- Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_tenant_active ON oauth_tokens(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_stripe_account ON oauth_tokens(stripe_account_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_hubspot_portal ON oauth_tokens(hubspot_portal_id);

-- Step 2: Create integration_configs table
CREATE TABLE IF NOT EXISTS integration_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('HUBSPOT', 'STRIPE', 'QUICKBOOKS')),
    config_type VARCHAR(50) NOT NULL CHECK (config_type IN ('API_KEY', 'WEBHOOK', 'OAUTH', 'SETTINGS')),
    is_active BOOLEAN DEFAULT TRUE,
    is_primary BOOLEAN DEFAULT FALSE,
    
    -- API Configuration (encrypted)
    api_key TEXT,
    api_secret TEXT,
    api_endpoint TEXT,
    api_version VARCHAR(50),
    
    -- Platform-specific identifiers
    hubspot_portal_id VARCHAR(255),
    hubspot_account_id VARCHAR(255),
    stripe_account_id VARCHAR(255),
    quickbooks_company_id VARCHAR(255),
    
    -- Connection settings
    environment VARCHAR(50) DEFAULT 'production',
    rate_limit_per_minute INTEGER,
    timeout_ms INTEGER DEFAULT 30000,
    max_retries INTEGER DEFAULT 3,
    
    -- Sync configuration
    sync_enabled BOOLEAN DEFAULT TRUE,
    sync_interval INTEGER, -- minutes
    last_sync_at TIMESTAMP,
    next_sync_at TIMESTAMP,
    sync_direction VARCHAR(50) DEFAULT 'BIDIRECTIONAL' CHECK (sync_direction IN ('INBOUND', 'OUTBOUND', 'BIDIRECTIONAL')),
    
    -- Feature flags and rules
    features JSONB,
    mapping_rules JSONB,
    filter_rules JSONB,
    transform_rules JSONB,
    
    -- Validation and health
    last_health_check_at TIMESTAMP,
    health_status VARCHAR(50) DEFAULT 'UNKNOWN' CHECK (health_status IN ('HEALTHY', 'DEGRADED', 'UNHEALTHY', 'UNKNOWN')),
    health_message TEXT,
    validated_at TIMESTAMP,
    validated_by VARCHAR(255),
    
    -- Encryption metadata
    encryption_method VARCHAR(50) DEFAULT 'AES-256-GCM',
    encryption_key_version INTEGER DEFAULT 1,
    
    -- Audit fields
    metadata JSONB,
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(255),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    
    CONSTRAINT uk_integration_config UNIQUE (tenant_id, platform, config_type, environment)
);

-- Add indexes for integration_configs
CREATE INDEX idx_integration_configs_tenant_platform ON integration_configs(tenant_id, platform, is_active);
CREATE INDEX idx_integration_configs_tenant_primary ON integration_configs(tenant_id, is_primary);
CREATE INDEX idx_integration_configs_health ON integration_configs(platform, health_status);
CREATE INDEX idx_integration_configs_next_sync ON integration_configs(next_sync_at) WHERE next_sync_at IS NOT NULL;

-- Step 3: Create webhook_configurations table
CREATE TABLE IF NOT EXISTS webhook_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    integration_config_id UUID NOT NULL,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('HUBSPOT', 'STRIPE', 'QUICKBOOKS')),
    webhook_type VARCHAR(50) NOT NULL CHECK (webhook_type IN ('INBOUND', 'OUTBOUND')),
    
    -- Webhook endpoint configuration
    endpoint_url TEXT NOT NULL,
    http_method VARCHAR(10) DEFAULT 'POST',
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Security (encrypted)
    signing_secret TEXT,
    auth_type VARCHAR(50) DEFAULT 'SIGNATURE' CHECK (auth_type IN ('NONE', 'SIGNATURE', 'BEARER', 'API_KEY', 'BASIC', 'CUSTOM')),
    auth_token TEXT,
    custom_headers JSONB,
    
    -- Event configuration
    subscribed_events JSONB NOT NULL,
    event_filters JSONB,
    payload_template JSONB,
    
    -- Retry configuration
    max_retries INTEGER DEFAULT 3,
    retry_delay_ms INTEGER DEFAULT 1000,
    retry_backoff_multiplier NUMERIC(4,2) DEFAULT 2.0,
    timeout_ms INTEGER DEFAULT 30000,
    
    -- Monitoring
    last_trigger_at TIMESTAMP,
    last_success_at TIMESTAMP,
    last_failure_at TIMESTAMP,
    last_error_message TEXT,
    consecutive_failures INTEGER DEFAULT 0,
    total_trigger_count INTEGER DEFAULT 0,
    total_success_count INTEGER DEFAULT 0,
    total_failure_count INTEGER DEFAULT 0,
    
    -- Circuit breaker
    circuit_breaker_enabled BOOLEAN DEFAULT TRUE,
    circuit_breaker_threshold INTEGER DEFAULT 5,
    circuit_breaker_reset_after_ms INTEGER DEFAULT 300000,
    circuit_breaker_status VARCHAR(50) DEFAULT 'CLOSED' CHECK (circuit_breaker_status IN ('CLOSED', 'OPEN', 'HALF_OPEN')),
    circuit_breaker_opened_at TIMESTAMP,
    
    -- Platform-specific fields
    hubspot_app_id VARCHAR(255),
    hubspot_subscription_id VARCHAR(255),
    stripe_webhook_endpoint_id VARCHAR(255),
    quickbooks_webhook_token VARCHAR(255),
    
    -- Encryption metadata
    encryption_method VARCHAR(50) DEFAULT 'AES-256-GCM',
    encryption_key_version INTEGER DEFAULT 1,
    
    -- Audit fields
    metadata JSONB,
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(255),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    
    CONSTRAINT fk_webhook_integration_config FOREIGN KEY (integration_config_id) 
        REFERENCES integration_configs(id) ON DELETE CASCADE,
    CONSTRAINT uk_webhook_config UNIQUE (tenant_id, platform, endpoint_url, webhook_type)
);

-- Add indexes for webhook_configurations
CREATE INDEX idx_webhook_configs_tenant_platform ON webhook_configurations(tenant_id, platform, is_active);
CREATE INDEX idx_webhook_configs_integration ON webhook_configurations(integration_config_id);
CREATE INDEX idx_webhook_configs_last_trigger ON webhook_configurations(last_trigger_at) WHERE last_trigger_at IS NOT NULL;
CREATE INDEX idx_webhook_configs_circuit_breaker ON webhook_configurations(circuit_breaker_status);

-- Step 4: Create configuration_audit_logs table
CREATE TABLE IF NOT EXISTS configuration_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('INTEGRATION_CONFIG', 'WEBHOOK_CONFIG', 'OAUTH_TOKEN')),
    entity_id VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'ACTIVATE', 'DEACTIVATE', 'VALIDATE', 'REFRESH', 'REVOKE', 'TEST')),
    
    -- Change tracking
    field_name VARCHAR(255),
    old_value JSONB,
    new_value JSONB,
    change_reason TEXT,
    
    -- Security context
    performed_by VARCHAR(255) NOT NULL,
    performed_by_email VARCHAR(255),
    performed_by_name VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    session_id VARCHAR(255),
    
    -- Risk assessment
    risk_level VARCHAR(50) DEFAULT 'LOW' CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    requires_review BOOLEAN DEFAULT FALSE,
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    
    -- Metadata
    platform VARCHAR(50),
    environment VARCHAR(50),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Optional relationships
    integration_config_id UUID,
    webhook_config_id UUID,
    
    CONSTRAINT fk_audit_integration_config FOREIGN KEY (integration_config_id) 
        REFERENCES integration_configs(id) ON UPDATE NO ACTION,
    CONSTRAINT fk_audit_webhook_config FOREIGN KEY (webhook_config_id) 
        REFERENCES webhook_configurations(id) ON UPDATE NO ACTION
);

-- Add indexes for configuration_audit_logs
CREATE INDEX idx_config_audit_entity ON configuration_audit_logs(tenant_id, entity_type, entity_id);
CREATE INDEX idx_config_audit_action ON configuration_audit_logs(tenant_id, action, created_at);
CREATE INDEX idx_config_audit_performed_by ON configuration_audit_logs(performed_by);
CREATE INDEX idx_config_audit_risk ON configuration_audit_logs(risk_level, requires_review) WHERE requires_review = TRUE;
CREATE INDEX idx_config_audit_created ON configuration_audit_logs(created_at);

-- Step 5: Add comments for documentation
COMMENT ON TABLE integration_configs IS 'Stores non-OAuth configuration data for platform integrations';
COMMENT ON TABLE webhook_configurations IS 'Manages webhook endpoints, signatures, and monitoring';
COMMENT ON TABLE configuration_audit_logs IS 'Tracks all configuration changes for security and compliance';

COMMENT ON COLUMN integration_configs.api_key IS 'Encrypted API key for non-OAuth integrations';
COMMENT ON COLUMN integration_configs.api_secret IS 'Encrypted API secret for non-OAuth integrations';
COMMENT ON COLUMN integration_configs.sync_interval IS 'Minutes between automatic synchronization runs';

COMMENT ON COLUMN webhook_configurations.signing_secret IS 'Encrypted webhook signature secret for verification';
COMMENT ON COLUMN webhook_configurations.auth_token IS 'Encrypted authentication token for outbound webhooks';
COMMENT ON COLUMN webhook_configurations.circuit_breaker_status IS 'Circuit breaker pattern to prevent cascading failures';

COMMENT ON COLUMN configuration_audit_logs.old_value IS 'Previous value (encrypted fields are masked)';
COMMENT ON COLUMN configuration_audit_logs.new_value IS 'New value (encrypted fields are masked)';
COMMENT ON COLUMN configuration_audit_logs.risk_level IS 'Risk assessment for the configuration change';