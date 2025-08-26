-- Complete Schema Fixes Migration
-- Description: Add missing fields to InvoiceMapping and fix remaining schema issues
-- Date: 2024-12-26
-- Safe operation: Only adds new columns and indexes, preserves existing data

-- Add any remaining missing fields to InvoiceMapping table (if not already present)
ALTER TABLE invoice_mapping ADD COLUMN IF NOT EXISTS hubspot_raw_data JSONB;
ALTER TABLE invoice_mapping ADD COLUMN IF NOT EXISTS balance_due DECIMAL;
ALTER TABLE invoice_mapping ADD COLUMN IF NOT EXISTS subtotal DECIMAL;
ALTER TABLE invoice_mapping ADD COLUMN IF NOT EXISTS hubspot_invoice_number TEXT;
ALTER TABLE invoice_mapping ADD COLUMN IF NOT EXISTS detected_currency TEXT;
ALTER TABLE invoice_mapping ADD COLUMN IF NOT EXISTS line_items_count INTEGER DEFAULT 0;

-- Add missing timestamp fields if not already present
ALTER TABLE invoice_mapping ADD COLUMN IF NOT EXISTS hubspot_created_at TIMESTAMPTZ;
ALTER TABLE invoice_mapping ADD COLUMN IF NOT EXISTS hubspot_modified_at TIMESTAMPTZ;
ALTER TABLE invoice_mapping ADD COLUMN IF NOT EXISTS hubspot_closed_at TIMESTAMPTZ;
ALTER TABLE invoice_mapping ADD COLUMN IF NOT EXISTS invoice_sent_at TIMESTAMPTZ;
ALTER TABLE invoice_mapping ADD COLUMN IF NOT EXISTS payment_due_date TIMESTAMPTZ;
ALTER TABLE invoice_mapping ADD COLUMN IF NOT EXISTS first_payment_at TIMESTAMPTZ;
ALTER TABLE invoice_mapping ADD COLUMN IF NOT EXISTS fully_paid_at TIMESTAMPTZ;
ALTER TABLE invoice_mapping ADD COLUMN IF NOT EXISTS first_sync_at TIMESTAMPTZ;
ALTER TABLE invoice_mapping ADD COLUMN IF NOT EXISTS last_webhook_at TIMESTAMPTZ;
ALTER TABLE invoice_mapping ADD COLUMN IF NOT EXISTS last_periodic_check_at TIMESTAMPTZ;

-- Add metadata fields if not already present
ALTER TABLE invoice_mapping ADD COLUMN IF NOT EXISTS hubspot_object_id TEXT;
ALTER TABLE invoice_mapping ADD COLUMN IF NOT EXISTS hubspot_object_type TEXT;
ALTER TABLE invoice_mapping ADD COLUMN IF NOT EXISTS sync_source TEXT;

-- Add performance indexes for new fields
CREATE INDEX IF NOT EXISTS idx_invoice_mapping_hubspot_created_at ON invoice_mapping(hubspot_created_at);
CREATE INDEX IF NOT EXISTS idx_invoice_mapping_hubspot_modified_at ON invoice_mapping(hubspot_modified_at);
CREATE INDEX IF NOT EXISTS idx_invoice_mapping_first_sync_at ON invoice_mapping(first_sync_at);
CREATE INDEX IF NOT EXISTS idx_invoice_mapping_last_sync_at ON invoice_mapping(last_sync_at);
CREATE INDEX IF NOT EXISTS idx_invoice_mapping_status_currency ON invoice_mapping(status, currency);
CREATE INDEX IF NOT EXISTS idx_invoice_mapping_balance_due ON invoice_mapping(balance_due) WHERE balance_due IS NOT NULL;

-- Add GIN indexes for JSON fields for better query performance
CREATE INDEX IF NOT EXISTS idx_invoice_mapping_hubspot_raw_data_gin ON invoice_mapping USING GIN(hubspot_raw_data);

-- Add indexes for business query patterns
CREATE INDEX IF NOT EXISTS idx_invoice_mapping_outstanding_invoices 
    ON invoice_mapping(tenant_id, status, due_date) 
    WHERE status IN ('SENT', 'PARTIALLY_PAID') AND due_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoice_mapping_recent_invoices 
    ON invoice_mapping(tenant_id, created_at DESC, status);

-- Ensure Contact and Company models have lastSyncAt (if not already present)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;

-- Add indexes for Contact and Company lastSyncAt
CREATE INDEX IF NOT EXISTS idx_contacts_last_sync_at ON contacts(last_sync_at);
CREATE INDEX IF NOT EXISTS idx_companies_last_sync_at ON companies(last_sync_at);

-- Add performance indexes for sync_logs new foreign keys (these should already exist from previous migration)
CREATE INDEX IF NOT EXISTS sync_logs_invoice_id_idx ON sync_logs(invoice_id);
CREATE INDEX IF NOT EXISTS sync_logs_payment_id_idx ON sync_logs(payment_id);
CREATE INDEX IF NOT EXISTS sync_logs_contact_id_idx ON sync_logs(contact_id);
CREATE INDEX IF NOT EXISTS sync_logs_company_id_idx ON sync_logs(company_id);

-- Add compound indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_sync_logs_entity_type_status_created 
    ON sync_logs(entity_type, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_logs_platform_status_updated 
    ON sync_logs(platform, status, updated_at DESC);

-- Add indexes for webhook events processing
CREATE INDEX IF NOT EXISTS idx_webhook_events_platform_processed_created 
    ON webhook_events(platform, processed, created_at) 
    WHERE processed = false;

-- Add check constraints for data integrity
ALTER TABLE invoice_mapping ADD CONSTRAINT IF NOT EXISTS chk_invoice_mapping_amounts_positive 
    CHECK (total_amount >= 0 AND (balance_due IS NULL OR balance_due >= 0) AND (subtotal IS NULL OR subtotal >= 0));

ALTER TABLE sync_logs ADD CONSTRAINT IF NOT EXISTS chk_sync_logs_single_reference 
    CHECK (
        (CASE WHEN invoice_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN payment_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN contact_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN company_id IS NOT NULL THEN 1 ELSE 0 END) <= 1
    );

-- Add trigger to maintain line_items_count accuracy
CREATE OR REPLACE FUNCTION update_invoice_line_items_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE invoice_mapping 
        SET line_items_count = line_items_count + 1 
        WHERE id = NEW.invoice_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE invoice_mapping 
        SET line_items_count = GREATEST(0, line_items_count - 1) 
        WHERE id = OLD.invoice_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS line_items_count_trigger ON line_items;
CREATE TRIGGER line_items_count_trigger
    AFTER INSERT OR DELETE ON line_items
    FOR EACH ROW EXECUTE FUNCTION update_invoice_line_items_count();

-- Refresh line_items_count for existing records
UPDATE invoice_mapping 
SET line_items_count = (
    SELECT COUNT(*) 
    FROM line_items 
    WHERE line_items.invoice_id = invoice_mapping.id
);

-- Add comments for documentation
COMMENT ON COLUMN invoice_mapping.hubspot_raw_data IS 'Raw HubSpot API response for debugging and data recovery';
COMMENT ON COLUMN invoice_mapping.balance_due IS 'Remaining unpaid amount on the invoice';
COMMENT ON COLUMN invoice_mapping.line_items_count IS 'Cached count of line items for performance';
COMMENT ON COLUMN invoice_mapping.first_sync_at IS 'Timestamp when this invoice was first synchronized';
COMMENT ON COLUMN invoice_mapping.sync_source IS 'Source of the synchronization (webhook, periodic, manual)';

-- Ensure data consistency
UPDATE invoice_mapping SET detected_currency = currency WHERE detected_currency IS NULL;
UPDATE invoice_mapping SET sync_source = 'migration' WHERE sync_source IS NULL;

-- Create materialized view for performance (invoice summary)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_invoice_summary AS
SELECT 
    tenant_id,
    currency,
    status,
    COUNT(*) as invoice_count,
    SUM(total_amount) as total_amount,
    SUM(COALESCE(balance_due, total_amount)) as total_balance_due,
    AVG(total_amount) as avg_amount,
    MIN(created_at) as oldest_invoice,
    MAX(created_at) as newest_invoice
FROM invoice_mapping
GROUP BY tenant_id, currency, status;

-- Create unique index on the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_invoice_summary_unique 
    ON mv_invoice_summary(tenant_id, currency, status);

-- Create function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_summary_views() 
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_invoice_summary;
END;
$$ LANGUAGE plpgsql;