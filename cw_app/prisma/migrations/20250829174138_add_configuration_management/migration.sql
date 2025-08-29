-- CreateEnum
CREATE TYPE "ConfigType" AS ENUM ('API_KEY', 'WEBHOOK', 'OAUTH', 'SETTINGS');

-- CreateEnum
CREATE TYPE "SyncDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'BIDIRECTIONAL');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'UNHEALTHY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "WebhookType" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "WebhookAuthType" AS ENUM ('NONE', 'SIGNATURE', 'BEARER', 'API_KEY', 'BASIC', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CircuitBreakerStatus" AS ENUM ('CLOSED', 'OPEN', 'HALF_OPEN');

-- CreateEnum
CREATE TYPE "ConfigEntityType" AS ENUM ('INTEGRATION_CONFIG', 'WEBHOOK_CONFIG', 'OAUTH_TOKEN');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'ACTIVATE', 'DEACTIVATE', 'VALIDATE', 'REFRESH', 'REVOKE', 'TEST');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('STRIPE_CARD', 'STRIPE_BANK_TRANSFER', 'QUICKBOOKS_CHECK', 'QUICKBOOKS_CASH', 'QUICKBOOKS_CREDIT_CARD', 'QUICKBOOKS_BANK_TRANSFER', 'OTHER');

-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('PENDING', 'ALLOCATED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('INVOICE', 'PAYMENT', 'CONTACT', 'COMPANY', 'LINE_ITEM', 'DEAL');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('HUBSPOT', 'STRIPE', 'QUICKBOOKS');

-- CreateEnum
CREATE TYPE "SyncOperation" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'SYNC');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'RETRYING');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'ASSOCIATE', 'PAYMENT_UPDATE');

-- CreateEnum
CREATE TYPE "QueueStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'TRANSFERRED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TenantRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "invoice_mapping" (
    "id" TEXT NOT NULL,
    "hubspot_deal_id" TEXT,
    "hubspot_invoice_id" TEXT,
    "quickbooks_invoice_id" TEXT,
    "stripe_invoice_id" TEXT,
    "total_amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "InvoiceStatus" NOT NULL,
    "client_email" TEXT,
    "client_name" TEXT,
    "due_date" TIMESTAMP(3),
    "issue_date" TIMESTAMP(3),
    "description" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hubspot_created_at" TIMESTAMP(3),
    "hubspot_modified_at" TIMESTAMP(3),
    "hubspot_closed_at" TIMESTAMP(3),
    "invoice_sent_at" TIMESTAMP(3),
    "payment_due_date" TIMESTAMP(3),
    "first_payment_at" TIMESTAMP(3),
    "fully_paid_at" TIMESTAMP(3),
    "first_sync_at" TIMESTAMP(3),
    "last_webhook_at" TIMESTAMP(3),
    "last_periodic_check_at" TIMESTAMP(3),
    "hubspot_object_id" TEXT,
    "hubspot_object_type" TEXT,
    "sync_source" TEXT,
    "hubspot_invoice_number" TEXT,
    "balance_due" DECIMAL(65,30),
    "subtotal" DECIMAL(65,30),
    "hubspot_raw_data" JSONB,
    "detected_currency" TEXT,
    "line_items_count" INTEGER NOT NULL DEFAULT 0,
    "tenant_id" TEXT NOT NULL,

    CONSTRAINT "invoice_mapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_mapping" (
    "id" TEXT NOT NULL,
    "stripe_payment_id" TEXT,
    "quickbooks_payment_id" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "payment_method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "tenant_id" TEXT NOT NULL,

    CONSTRAINT "payment_mapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_payments" (
    "id" TEXT NOT NULL,
    "invoice_mapping_id" TEXT NOT NULL,
    "payment_mapping_id" TEXT NOT NULL,
    "allocated_amount" DECIMAL(65,30) NOT NULL,
    "allocation_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "AllocationStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "entity_type" "EntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "operation" "SyncOperation" NOT NULL,
    "platform" "Platform" NOT NULL,
    "status" "SyncStatus" NOT NULL,
    "error_message" TEXT,
    "request_data" JSONB,
    "response_data" JSONB,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "invoice_id" TEXT,
    "payment_id" TEXT,
    "contact_id" TEXT,
    "company_id" TEXT,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "tenant_id" TEXT,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "hubspot_contact_id" TEXT NOT NULL,
    "email" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "full_name" TEXT,
    "job_title" TEXT,
    "phone" TEXT,
    "country" TEXT,
    "city" TEXT,
    "hubspot_created_at" TIMESTAMP(3),
    "hubspot_updated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_sync_at" TIMESTAMP(3),
    "tenant_id" TEXT NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "hubspot_company_id" TEXT NOT NULL,
    "name" TEXT,
    "domain" TEXT,
    "industry" TEXT,
    "country" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "hubspot_created_at" TIMESTAMP(3),
    "hubspot_updated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_sync_at" TIMESTAMP(3),
    "tenant_id" TEXT NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_associations" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "contact_id" TEXT,
    "company_id" TEXT,
    "is_primary_contact" BOOLEAN NOT NULL DEFAULT false,
    "is_primary_company" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_associations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "line_items" (
    "id" TEXT NOT NULL,
    "hubspot_line_item_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "product_name" TEXT,
    "hubspot_product_id" TEXT,
    "sku" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" TEXT,
    "discount_amount" DECIMAL(65,30),
    "discount_percentage" DECIMAL(65,30),
    "pre_discount_amount" DECIMAL(65,30),
    "total_discount" DECIMAL(65,30),
    "tax_amount" DECIMAL(65,30),
    "tax_rate" DECIMAL(65,30),
    "tax_label" TEXT,
    "tax_category" TEXT,
    "post_tax_amount" DECIMAL(65,30),
    "external_tax_rate_id" TEXT,
    "hubspot_raw_data" JSONB,
    "hubspot_created_at" TIMESTAMP(3),
    "hubspot_updated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_sync_at" TIMESTAMP(3),

    CONSTRAINT "line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_summary" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "subtotal_before_tax" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total_tax_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "total_after_tax" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "tax_breakdown" JSONB,
    "total_discount_amount" DECIMAL(65,30),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_watermarks" (
    "id" TEXT NOT NULL,
    "entity_type" "EntityType" NOT NULL,
    "last_sync_at" TIMESTAMP(3),
    "entity_count" INTEGER NOT NULL DEFAULT 0,
    "last_modified_id" TEXT,
    "sync_duration" INTEGER,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "last_error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_watermarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quickbooks_transfer_queue" (
    "id" TEXT NOT NULL,
    "entity_type" "EntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action_type" "ActionType" NOT NULL,
    "status" "QueueStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "trigger_reason" TEXT NOT NULL,
    "entity_data" JSONB NOT NULL,
    "original_data" JSONB,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejected_by" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "validation_notes" TEXT,
    "transferred_at" TIMESTAMP(3),
    "quickbooks_id" TEXT,
    "transfer_error" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quickbooks_transfer_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
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
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
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
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "role" "TenantRole" NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_accessed_at" TIMESTAMP(3),
    "permissions" JSONB,
    "metadata" JSONB,
    "invited_by_id" TEXT,
    "invitation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_invitations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "TenantRole" NOT NULL DEFAULT 'MEMBER',
    "invitation_token" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "invited_by_id" TEXT NOT NULL,
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tenant_id" TEXT,
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
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_tokens" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "tenant_id" TEXT,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "token_type" TEXT NOT NULL DEFAULT 'Bearer',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "refresh_token_expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "realm_id" TEXT,
    "company_id" TEXT,
    "hubspot_portal_id" TEXT,
    "hubspot_user_id" TEXT,
    "hubspot_app_id" TEXT,
    "stripe_account_id" TEXT,
    "stripe_user_id" TEXT,
    "stripe_livemode" BOOLEAN NOT NULL DEFAULT false,
    "last_refreshed_at" TIMESTAMP(3),
    "refresh_count" INTEGER NOT NULL DEFAULT 0,
    "failed_refresh_count" INTEGER NOT NULL DEFAULT 0,
    "last_refresh_error" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "revoked_at" TIMESTAMP(3),
    "revoked_by" TEXT,
    "revoked_reason" TEXT,
    "encryption_method" TEXT NOT NULL DEFAULT 'AES-256-GCM',
    "encryption_iv" TEXT,
    "encryption_key_version" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_refresh_logs" (
    "id" TEXT NOT NULL,
    "token_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "tenant_id" TEXT,
    "refresh_type" TEXT NOT NULL,
    "trigger_reason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attempted_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "old_expires_at" TIMESTAMP(3),
    "new_expires_at" TIMESTAMP(3),
    "error_code" TEXT,
    "error_message" TEXT,
    "retry_attempt" INTEGER NOT NULL DEFAULT 0,
    "request_metadata" JSONB,
    "response_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_refresh_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_configs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "config_type" "ConfigType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "api_key" TEXT,
    "api_secret" TEXT,
    "api_endpoint" TEXT,
    "api_version" TEXT,
    "hubspot_portal_id" TEXT,
    "hubspot_account_id" TEXT,
    "stripe_account_id" TEXT,
    "quickbooks_company_id" TEXT,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "rate_limit_per_minute" INTEGER,
    "timeout_ms" INTEGER NOT NULL DEFAULT 30000,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "sync_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sync_interval" INTEGER,
    "last_sync_at" TIMESTAMP(3),
    "next_sync_at" TIMESTAMP(3),
    "sync_direction" "SyncDirection" NOT NULL DEFAULT 'BIDIRECTIONAL',
    "features" JSONB,
    "mapping_rules" JSONB,
    "filter_rules" JSONB,
    "transform_rules" JSONB,
    "last_health_check_at" TIMESTAMP(3),
    "health_status" "HealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "health_message" TEXT,
    "validated_at" TIMESTAMP(3),
    "validated_by" TEXT,
    "encryption_method" TEXT NOT NULL DEFAULT 'AES-256-GCM',
    "encryption_key_version" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "integration_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_configurations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "integration_config_id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "webhook_type" "WebhookType" NOT NULL,
    "endpoint_url" TEXT NOT NULL,
    "http_method" TEXT NOT NULL DEFAULT 'POST',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "signing_secret" TEXT,
    "auth_type" "WebhookAuthType" NOT NULL DEFAULT 'SIGNATURE',
    "auth_token" TEXT,
    "custom_headers" JSONB,
    "subscribed_events" JSONB NOT NULL,
    "event_filters" JSONB,
    "payload_template" JSONB,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "retry_delay_ms" INTEGER NOT NULL DEFAULT 1000,
    "retry_backoff_multiplier" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "timeout_ms" INTEGER NOT NULL DEFAULT 30000,
    "last_trigger_at" TIMESTAMP(3),
    "last_success_at" TIMESTAMP(3),
    "last_failure_at" TIMESTAMP(3),
    "last_error_message" TEXT,
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
    "total_trigger_count" INTEGER NOT NULL DEFAULT 0,
    "total_success_count" INTEGER NOT NULL DEFAULT 0,
    "total_failure_count" INTEGER NOT NULL DEFAULT 0,
    "circuit_breaker_enabled" BOOLEAN NOT NULL DEFAULT true,
    "circuit_breaker_threshold" INTEGER NOT NULL DEFAULT 5,
    "circuit_breaker_reset_after_ms" INTEGER NOT NULL DEFAULT 300000,
    "circuit_breaker_status" "CircuitBreakerStatus" NOT NULL DEFAULT 'CLOSED',
    "circuit_breaker_opened_at" TIMESTAMP(3),
    "hubspot_app_id" TEXT,
    "hubspot_subscription_id" TEXT,
    "stripe_webhook_endpoint_id" TEXT,
    "quickbooks_webhook_token" TEXT,
    "encryption_method" TEXT NOT NULL DEFAULT 'AES-256-GCM',
    "encryption_key_version" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "webhook_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuration_audit_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "entity_type" "ConfigEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "field_name" TEXT,
    "old_value" JSONB,
    "new_value" JSONB,
    "change_reason" TEXT,
    "performed_by" TEXT NOT NULL,
    "performed_by_email" TEXT,
    "performed_by_name" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "session_id" TEXT,
    "risk_level" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "requires_review" BOOLEAN NOT NULL DEFAULT false,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "platform" "Platform",
    "environment" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "integration_config_id" TEXT,
    "webhook_config_id" TEXT,

    CONSTRAINT "configuration_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoice_mapping_tenant_id_idx" ON "invoice_mapping"("tenant_id");

-- CreateIndex
CREATE INDEX "invoice_mapping_tenant_id_status_idx" ON "invoice_mapping"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_mapping_tenant_id_hubspot_invoice_id_key" ON "invoice_mapping"("tenant_id", "hubspot_invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_mapping_tenant_id_quickbooks_invoice_id_key" ON "invoice_mapping"("tenant_id", "quickbooks_invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_mapping_tenant_id_stripe_invoice_id_key" ON "invoice_mapping"("tenant_id", "stripe_invoice_id");

-- CreateIndex
CREATE INDEX "payment_mapping_tenant_id_idx" ON "payment_mapping"("tenant_id");

-- CreateIndex
CREATE INDEX "payment_mapping_tenant_id_status_idx" ON "payment_mapping"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payment_mapping_tenant_id_quickbooks_payment_id_key" ON "payment_mapping"("tenant_id", "quickbooks_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_mapping_tenant_id_stripe_payment_id_key" ON "payment_mapping"("tenant_id", "stripe_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_payments_invoice_mapping_id_payment_mapping_id_key" ON "invoice_payments"("invoice_mapping_id", "payment_mapping_id");

-- CreateIndex
CREATE INDEX "sync_logs_platform_status_idx" ON "sync_logs"("platform", "status");

-- CreateIndex
CREATE INDEX "sync_logs_entity_type_entity_id_idx" ON "sync_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "sync_logs_created_at_idx" ON "sync_logs"("created_at");

-- CreateIndex
CREATE INDEX "sync_logs_invoice_id_idx" ON "sync_logs"("invoice_id");

-- CreateIndex
CREATE INDEX "sync_logs_payment_id_idx" ON "sync_logs"("payment_id");

-- CreateIndex
CREATE INDEX "sync_logs_contact_id_idx" ON "sync_logs"("contact_id");

-- CreateIndex
CREATE INDEX "sync_logs_company_id_idx" ON "sync_logs"("company_id");

-- CreateIndex
CREATE INDEX "webhook_events_processed_created_at_idx" ON "webhook_events"("processed", "created_at");

-- CreateIndex
CREATE INDEX "webhook_events_tenant_id_idx" ON "webhook_events"("tenant_id");

-- CreateIndex
CREATE INDEX "webhook_events_tenant_id_platform_event_type_idx" ON "webhook_events"("tenant_id", "platform", "event_type");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_platform_event_id_tenant_id_key" ON "webhook_events"("platform", "event_id", "tenant_id");

-- CreateIndex
CREATE INDEX "contacts_tenant_id_email_idx" ON "contacts"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "contacts_tenant_id_idx" ON "contacts"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_tenant_id_hubspot_contact_id_key" ON "contacts"("tenant_id", "hubspot_contact_id");

-- CreateIndex
CREATE INDEX "companies_tenant_id_domain_idx" ON "companies"("tenant_id", "domain");

-- CreateIndex
CREATE INDEX "companies_tenant_id_idx" ON "companies"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "companies_tenant_id_hubspot_company_id_key" ON "companies"("tenant_id", "hubspot_company_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_associations_invoice_id_contact_id_company_id_key" ON "invoice_associations"("invoice_id", "contact_id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "line_items_hubspot_line_item_id_key" ON "line_items"("hubspot_line_item_id");

-- CreateIndex
CREATE INDEX "line_items_invoice_id_idx" ON "line_items"("invoice_id");

-- CreateIndex
CREATE INDEX "line_items_hubspot_product_id_idx" ON "line_items"("hubspot_product_id");

-- CreateIndex
CREATE INDEX "line_items_currency_idx" ON "line_items"("currency");

-- CreateIndex
CREATE INDEX "line_items_tax_label_idx" ON "line_items"("tax_label");

-- CreateIndex
CREATE INDEX "line_items_created_at_idx" ON "line_items"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "tax_summary_invoice_id_key" ON "tax_summary"("invoice_id");

-- CreateIndex
CREATE INDEX "tax_summary_currency_idx" ON "tax_summary"("currency");

-- CreateIndex
CREATE UNIQUE INDEX "sync_watermarks_entity_type_key" ON "sync_watermarks"("entity_type");

-- CreateIndex
CREATE INDEX "sync_watermarks_entity_type_last_sync_at_idx" ON "sync_watermarks"("entity_type", "last_sync_at");

-- CreateIndex
CREATE INDEX "quickbooks_transfer_queue_status_entity_type_idx" ON "quickbooks_transfer_queue"("status", "entity_type");

-- CreateIndex
CREATE INDEX "quickbooks_transfer_queue_entity_type_entity_id_idx" ON "quickbooks_transfer_queue"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "quickbooks_transfer_queue_created_at_idx" ON "quickbooks_transfer_queue"("created_at");

-- CreateIndex
CREATE INDEX "quickbooks_transfer_queue_approved_at_idx" ON "quickbooks_transfer_queue"("approved_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_verification_token_key" ON "users"("email_verification_token");

-- CreateIndex
CREATE UNIQUE INDEX "users_password_reset_token_key" ON "users"("password_reset_token");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

-- CreateIndex
CREATE INDEX "users_last_activity_at_idx" ON "users"("last_activity_at");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_domain_key" ON "tenants"("domain");

-- CreateIndex
CREATE INDEX "tenants_slug_idx" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "tenants_is_active_idx" ON "tenants"("is_active");

-- CreateIndex
CREATE INDEX "tenants_created_by_id_idx" ON "tenants"("created_by_id");

-- CreateIndex
CREATE INDEX "tenant_memberships_tenant_id_role_idx" ON "tenant_memberships"("tenant_id", "role");

-- CreateIndex
CREATE INDEX "tenant_memberships_user_id_is_primary_idx" ON "tenant_memberships"("user_id", "is_primary");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_memberships_user_id_tenant_id_key" ON "tenant_memberships"("user_id", "tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_invitations_invitation_token_key" ON "tenant_invitations"("invitation_token");

-- CreateIndex
CREATE INDEX "tenant_invitations_invitation_token_idx" ON "tenant_invitations"("invitation_token");

-- CreateIndex
CREATE INDEX "tenant_invitations_email_idx" ON "tenant_invitations"("email");

-- CreateIndex
CREATE INDEX "tenant_invitations_tenant_id_status_idx" ON "tenant_invitations"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "tenant_invitations_expires_at_idx" ON "tenant_invitations"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_invitations_tenant_id_email_status_key" ON "tenant_invitations"("tenant_id", "email", "status");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_session_token_key" ON "user_sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_refresh_token_key" ON "user_sessions"("refresh_token");

-- CreateIndex
CREATE INDEX "user_sessions_session_token_idx" ON "user_sessions"("session_token");

-- CreateIndex
CREATE INDEX "user_sessions_refresh_token_idx" ON "user_sessions"("refresh_token");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "user_sessions_tenant_id_idx" ON "user_sessions"("tenant_id");

-- CreateIndex
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "oauth_tokens_provider_expires_at_idx" ON "oauth_tokens"("provider", "expires_at");

-- CreateIndex
CREATE INDEX "oauth_tokens_tenant_id_idx" ON "oauth_tokens"("tenant_id");

-- CreateIndex
CREATE INDEX "oauth_tokens_tenant_id_is_active_idx" ON "oauth_tokens"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "oauth_tokens_stripe_account_id_idx" ON "oauth_tokens"("stripe_account_id");

-- CreateIndex
CREATE INDEX "oauth_tokens_hubspot_portal_id_idx" ON "oauth_tokens"("hubspot_portal_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_tokens_provider_tenant_id_key" ON "oauth_tokens"("provider", "tenant_id");

-- CreateIndex
CREATE INDEX "token_refresh_logs_token_id_idx" ON "token_refresh_logs"("token_id");

-- CreateIndex
CREATE INDEX "token_refresh_logs_provider_tenant_id_idx" ON "token_refresh_logs"("provider", "tenant_id");

-- CreateIndex
CREATE INDEX "token_refresh_logs_status_attempted_at_idx" ON "token_refresh_logs"("status", "attempted_at");

-- CreateIndex
CREATE INDEX "integration_configs_tenant_id_platform_is_active_idx" ON "integration_configs"("tenant_id", "platform", "is_active");

-- CreateIndex
CREATE INDEX "integration_configs_tenant_id_is_primary_idx" ON "integration_configs"("tenant_id", "is_primary");

-- CreateIndex
CREATE INDEX "integration_configs_platform_health_status_idx" ON "integration_configs"("platform", "health_status");

-- CreateIndex
CREATE INDEX "integration_configs_next_sync_at_idx" ON "integration_configs"("next_sync_at");

-- CreateIndex
CREATE UNIQUE INDEX "integration_configs_tenant_id_platform_config_type_environm_key" ON "integration_configs"("tenant_id", "platform", "config_type", "environment");

-- CreateIndex
CREATE INDEX "webhook_configurations_tenant_id_platform_is_active_idx" ON "webhook_configurations"("tenant_id", "platform", "is_active");

-- CreateIndex
CREATE INDEX "webhook_configurations_integration_config_id_idx" ON "webhook_configurations"("integration_config_id");

-- CreateIndex
CREATE INDEX "webhook_configurations_last_trigger_at_idx" ON "webhook_configurations"("last_trigger_at");

-- CreateIndex
CREATE INDEX "webhook_configurations_circuit_breaker_status_idx" ON "webhook_configurations"("circuit_breaker_status");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_configurations_tenant_id_platform_endpoint_url_webh_key" ON "webhook_configurations"("tenant_id", "platform", "endpoint_url", "webhook_type");

-- CreateIndex
CREATE INDEX "configuration_audit_logs_tenant_id_entity_type_entity_id_idx" ON "configuration_audit_logs"("tenant_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "configuration_audit_logs_tenant_id_action_created_at_idx" ON "configuration_audit_logs"("tenant_id", "action", "created_at");

-- CreateIndex
CREATE INDEX "configuration_audit_logs_performed_by_idx" ON "configuration_audit_logs"("performed_by");

-- CreateIndex
CREATE INDEX "configuration_audit_logs_risk_level_requires_review_idx" ON "configuration_audit_logs"("risk_level", "requires_review");

-- CreateIndex
CREATE INDEX "configuration_audit_logs_created_at_idx" ON "configuration_audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_mapping_id_fkey" FOREIGN KEY ("invoice_mapping_id") REFERENCES "invoice_mapping"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_payment_mapping_id_fkey" FOREIGN KEY ("payment_mapping_id") REFERENCES "payment_mapping"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice_mapping"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payment_mapping"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "invoice_associations" ADD CONSTRAINT "invoice_associations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_associations" ADD CONSTRAINT "invoice_associations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_associations" ADD CONSTRAINT "invoice_associations_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice_mapping"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice_mapping"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_summary" ADD CONSTRAINT "tax_summary_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice_mapping"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_configurations" ADD CONSTRAINT "webhook_configurations_integration_config_id_fkey" FOREIGN KEY ("integration_config_id") REFERENCES "integration_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuration_audit_logs" ADD CONSTRAINT "configuration_audit_logs_integration_config_id_fkey" FOREIGN KEY ("integration_config_id") REFERENCES "integration_configs"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "configuration_audit_logs" ADD CONSTRAINT "configuration_audit_logs_webhook_config_id_fkey" FOREIGN KEY ("webhook_config_id") REFERENCES "webhook_configurations"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
