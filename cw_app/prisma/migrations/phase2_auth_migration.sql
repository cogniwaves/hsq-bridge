-- ============================================================================
-- Phase 2: Multi-Tenant Authentication System Migration
-- ============================================================================
-- This migration adds comprehensive user authentication and tenant management
-- to the existing HubSpot-QuickBooks bridge system.
--
-- Migration Strategy:
-- 1. Create new tables without foreign key constraints
-- 2. Add indexes for performance
-- 3. Set up proper constraints and relationships
-- 4. Preserve all existing data (no breaking changes)
-- ============================================================================

-- Create ENUMs for role-based access control
CREATE TYPE "TenantRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- ============================================================================
-- USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "avatar_url" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verification_token" TEXT,
    "email_verified_at" TIMESTAMP(3),
    "password_reset_token" TEXT,
    "password_reset_expires_at" TIMESTAMP(3),
    "last_password_change_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_super_admin" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMP(3),
    "last_activity_at" TIMESTAMP(3),
    "login_count" INTEGER NOT NULL DEFAULT 0,
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "preferences" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- Create unique constraints and indexes for users
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_verification_token_key" ON "users"("email_verification_token") WHERE "email_verification_token" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "users_password_reset_token_key" ON "users"("password_reset_token") WHERE "password_reset_token" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "users_is_active_idx" ON "users"("is_active");
CREATE INDEX IF NOT EXISTS "users_last_activity_at_idx" ON "users"("last_activity_at");

-- ============================================================================
-- TENANTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS "tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "domain" TEXT,
    "logo" TEXT,
    "description" TEXT,
    "industry" TEXT,
    "size" TEXT,
    "country" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "billing_email" TEXT,
    "technical_email" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_trial" BOOLEAN NOT NULL DEFAULT true,
    "trial_ends_at" TIMESTAMP(3),
    "subscription_status" TEXT,
    "subscription_plan" TEXT,
    "subscription_started_at" TIMESTAMP(3),
    "max_users" INTEGER NOT NULL DEFAULT 5,
    "settings" JSONB,
    "metadata" JSONB,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    
    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- Create unique constraints and indexes for tenants
CREATE UNIQUE INDEX IF NOT EXISTS "tenants_slug_key" ON "tenants"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "tenants_domain_key" ON "tenants"("domain") WHERE "domain" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "tenants_slug_idx" ON "tenants"("slug");
CREATE INDEX IF NOT EXISTS "tenants_is_active_idx" ON "tenants"("is_active");
CREATE INDEX IF NOT EXISTS "tenants_created_by_id_idx" ON "tenants"("created_by_id");

-- ============================================================================
-- TENANT_MEMBERSHIPS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS "tenant_memberships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "role" "TenantRole" NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_accessed_at" TIMESTAMP(3),
    "permissions" JSONB,
    "metadata" JSONB,
    "invited_by_id" UUID,
    "invitation_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "tenant_memberships_pkey" PRIMARY KEY ("id")
);

-- Create unique constraints and indexes for tenant_memberships
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_memberships_user_id_tenant_id_key" ON "tenant_memberships"("user_id", "tenant_id");
CREATE INDEX IF NOT EXISTS "tenant_memberships_tenant_id_role_idx" ON "tenant_memberships"("tenant_id", "role");
CREATE INDEX IF NOT EXISTS "tenant_memberships_user_id_is_primary_idx" ON "tenant_memberships"("user_id", "is_primary");

-- ============================================================================
-- TENANT_INVITATIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS "tenant_invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "TenantRole" NOT NULL DEFAULT 'MEMBER',
    "invitation_token" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "invited_by_id" UUID NOT NULL,
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "tenant_invitations_pkey" PRIMARY KEY ("id")
);

-- Create unique constraints and indexes for tenant_invitations
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_invitations_invitation_token_key" ON "tenant_invitations"("invitation_token");
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_invitations_tenant_id_email_status_key" ON "tenant_invitations"("tenant_id", "email", "status");
CREATE INDEX IF NOT EXISTS "tenant_invitations_invitation_token_idx" ON "tenant_invitations"("invitation_token");
CREATE INDEX IF NOT EXISTS "tenant_invitations_email_idx" ON "tenant_invitations"("email");
CREATE INDEX IF NOT EXISTS "tenant_invitations_tenant_id_status_idx" ON "tenant_invitations"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "tenant_invitations_expires_at_idx" ON "tenant_invitations"("expires_at");

-- ============================================================================
-- USER_SESSIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS "user_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "tenant_id" UUID,
    "session_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "device_info" JSONB,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "refresh_expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "revoked_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- Create unique constraints and indexes for user_sessions
CREATE UNIQUE INDEX IF NOT EXISTS "user_sessions_session_token_key" ON "user_sessions"("session_token");
CREATE UNIQUE INDEX IF NOT EXISTS "user_sessions_refresh_token_key" ON "user_sessions"("refresh_token") WHERE "refresh_token" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "user_sessions_session_token_idx" ON "user_sessions"("session_token");
CREATE INDEX IF NOT EXISTS "user_sessions_refresh_token_idx" ON "user_sessions"("refresh_token");
CREATE INDEX IF NOT EXISTS "user_sessions_user_id_idx" ON "user_sessions"("user_id");
CREATE INDEX IF NOT EXISTS "user_sessions_tenant_id_idx" ON "user_sessions"("tenant_id");
CREATE INDEX IF NOT EXISTS "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");

-- ============================================================================
-- ADD FOREIGN KEY RELATIONSHIPS
-- ============================================================================

-- Tenants foreign keys
ALTER TABLE "tenants" 
    ADD CONSTRAINT "tenants_created_by_id_fkey" 
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") 
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tenant memberships foreign keys
ALTER TABLE "tenant_memberships" 
    ADD CONSTRAINT "tenant_memberships_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "users"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tenant_memberships" 
    ADD CONSTRAINT "tenant_memberships_tenant_id_fkey" 
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Tenant invitations foreign keys
ALTER TABLE "tenant_invitations" 
    ADD CONSTRAINT "tenant_invitations_tenant_id_fkey" 
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tenant_invitations" 
    ADD CONSTRAINT "tenant_invitations_invited_by_id_fkey" 
    FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") 
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- User sessions foreign keys
ALTER TABLE "user_sessions" 
    ADD CONSTRAINT "user_sessions_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "users"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- CREATE UPDATE TRIGGERS FOR updated_at COLUMNS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON "users"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON "tenants"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_memberships_updated_at BEFORE UPDATE ON "tenant_memberships"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_invitations_updated_at BEFORE UPDATE ON "tenant_invitations"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_sessions_updated_at BEFORE UPDATE ON "user_sessions"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUTURE MIGRATION: Link existing tables to Tenant model
-- ============================================================================
-- Note: These will be executed in a separate migration after data migration
-- to avoid breaking existing functionality.
--
-- ALTER TABLE "invoice_mapping" 
--     ADD CONSTRAINT "invoice_mapping_tenant_id_fkey" 
--     FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") 
--     ON DELETE CASCADE ON UPDATE CASCADE;
--
-- ALTER TABLE "payment_mapping" 
--     ADD CONSTRAINT "payment_mapping_tenant_id_fkey" 
--     FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") 
--     ON DELETE CASCADE ON UPDATE CASCADE;
--
-- ALTER TABLE "contacts" 
--     ADD CONSTRAINT "contacts_tenant_id_fkey" 
--     FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") 
--     ON DELETE CASCADE ON UPDATE CASCADE;
--
-- ALTER TABLE "companies" 
--     ADD CONSTRAINT "companies_tenant_id_fkey" 
--     FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") 
--     ON DELETE CASCADE ON UPDATE CASCADE;
--
-- ALTER TABLE "webhook_events" 
--     ADD CONSTRAINT "webhook_events_tenant_id_fkey" 
--     FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") 
--     ON DELETE CASCADE ON UPDATE CASCADE;
--
-- ALTER TABLE "oauth_tokens" 
--     ADD CONSTRAINT "oauth_tokens_tenant_id_fkey" 
--     FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") 
--     ON DELETE CASCADE ON UPDATE CASCADE;