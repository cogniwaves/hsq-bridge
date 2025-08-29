-- ============================================================================
-- Rollback Migration: Remove Configuration Management System
-- Description: Safely removes configuration management schema extensions
-- Author: Prisma Database Schema Architect
-- Date: 2025-08-29
-- ============================================================================

-- WARNING: This will remove all configuration data. 
-- Ensure you have backed up any important data before running this rollback.

-- Step 1: Drop foreign key constraints first
ALTER TABLE configuration_audit_logs 
    DROP CONSTRAINT IF EXISTS fk_audit_integration_config,
    DROP CONSTRAINT IF EXISTS fk_audit_webhook_config;

ALTER TABLE webhook_configurations 
    DROP CONSTRAINT IF EXISTS fk_webhook_integration_config;

-- Step 2: Drop indexes for configuration_audit_logs
DROP INDEX IF EXISTS idx_config_audit_entity;
DROP INDEX IF EXISTS idx_config_audit_action;
DROP INDEX IF EXISTS idx_config_audit_performed_by;
DROP INDEX IF EXISTS idx_config_audit_risk;
DROP INDEX IF EXISTS idx_config_audit_created;

-- Step 3: Drop indexes for webhook_configurations
DROP INDEX IF EXISTS idx_webhook_configs_tenant_platform;
DROP INDEX IF EXISTS idx_webhook_configs_integration;
DROP INDEX IF EXISTS idx_webhook_configs_last_trigger;
DROP INDEX IF EXISTS idx_webhook_configs_circuit_breaker;

-- Step 4: Drop indexes for integration_configs
DROP INDEX IF EXISTS idx_integration_configs_tenant_platform;
DROP INDEX IF EXISTS idx_integration_configs_tenant_primary;
DROP INDEX IF EXISTS idx_integration_configs_health;
DROP INDEX IF EXISTS idx_integration_configs_next_sync;

-- Step 5: Drop new oauth_tokens indexes
DROP INDEX IF EXISTS idx_oauth_tokens_tenant_active;
DROP INDEX IF EXISTS idx_oauth_tokens_stripe_account;
DROP INDEX IF EXISTS idx_oauth_tokens_hubspot_portal;

-- Step 6: Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS configuration_audit_logs;
DROP TABLE IF EXISTS webhook_configurations;
DROP TABLE IF EXISTS integration_configs;

-- Step 7: Remove columns added to oauth_tokens
-- Note: We only remove columns that were added by this migration
ALTER TABLE oauth_tokens
    DROP COLUMN IF EXISTS hubspot_portal_id,
    DROP COLUMN IF EXISTS hubspot_user_id,
    DROP COLUMN IF EXISTS hubspot_app_id,
    DROP COLUMN IF EXISTS stripe_account_id,
    DROP COLUMN IF EXISTS stripe_user_id,
    DROP COLUMN IF EXISTS stripe_livemode,
    DROP COLUMN IF EXISTS is_active,
    DROP COLUMN IF EXISTS revoked_at,
    DROP COLUMN IF EXISTS revoked_by,
    DROP COLUMN IF EXISTS revoked_reason,
    DROP COLUMN IF EXISTS encryption_key_version,
    DROP COLUMN IF EXISTS metadata,
    DROP COLUMN IF EXISTS created_by;

-- Note: This rollback preserves the original oauth_tokens structure
-- and all existing data in that table.