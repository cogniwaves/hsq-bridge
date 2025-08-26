-- ============================================================================
-- Phase 2: Multi-Tenant Authentication System Rollback Script
-- ============================================================================
-- This script safely rolls back the Phase 2 authentication changes
-- while preserving all existing data and functionality.
--
-- IMPORTANT: This rollback will:
-- 1. Remove all authentication-related tables
-- 2. Remove authentication-related ENUMs
-- 3. Preserve all existing invoice, payment, and sync data
-- 4. Keep tenant_id columns in existing tables (no data loss)
-- ============================================================================

-- ============================================================================
-- DROP FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Drop tenant foreign keys
ALTER TABLE "tenants" DROP CONSTRAINT IF EXISTS "tenants_created_by_id_fkey";

-- Drop tenant membership foreign keys
ALTER TABLE "tenant_memberships" DROP CONSTRAINT IF EXISTS "tenant_memberships_user_id_fkey";
ALTER TABLE "tenant_memberships" DROP CONSTRAINT IF EXISTS "tenant_memberships_tenant_id_fkey";

-- Drop tenant invitation foreign keys
ALTER TABLE "tenant_invitations" DROP CONSTRAINT IF EXISTS "tenant_invitations_tenant_id_fkey";
ALTER TABLE "tenant_invitations" DROP CONSTRAINT IF EXISTS "tenant_invitations_invited_by_id_fkey";

-- Drop user session foreign keys
ALTER TABLE "user_sessions" DROP CONSTRAINT IF EXISTS "user_sessions_user_id_fkey";

-- ============================================================================
-- DROP TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS update_users_updated_at ON "users";
DROP TRIGGER IF EXISTS update_tenants_updated_at ON "tenants";
DROP TRIGGER IF EXISTS update_tenant_memberships_updated_at ON "tenant_memberships";
DROP TRIGGER IF EXISTS update_tenant_invitations_updated_at ON "tenant_invitations";
DROP TRIGGER IF EXISTS update_user_sessions_updated_at ON "user_sessions";

-- ============================================================================
-- DROP TABLES
-- ============================================================================

DROP TABLE IF EXISTS "user_sessions" CASCADE;
DROP TABLE IF EXISTS "tenant_invitations" CASCADE;
DROP TABLE IF EXISTS "tenant_memberships" CASCADE;
DROP TABLE IF EXISTS "tenants" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;

-- ============================================================================
-- DROP ENUMS
-- ============================================================================

DROP TYPE IF EXISTS "InvitationStatus" CASCADE;
DROP TYPE IF EXISTS "TenantRole" CASCADE;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After rollback, verify that existing tables are intact:
-- 
-- SELECT COUNT(*) FROM invoice_mapping;
-- SELECT COUNT(*) FROM payment_mapping;
-- SELECT COUNT(*) FROM contacts;
-- SELECT COUNT(*) FROM companies;
-- SELECT COUNT(*) FROM webhook_events;
-- SELECT COUNT(*) FROM oauth_tokens;
--
-- All these tables should retain their data with tenant_id columns intact.