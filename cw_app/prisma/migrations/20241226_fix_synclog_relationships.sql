-- Migration: Fix SyncLog polymorphic relationships
-- Description: Add specific foreign key columns to replace invalid polymorphic pattern
-- Date: 2024-12-26
-- Safe operation: Only adds new columns, preserves existing data

-- Add new foreign key columns to sync_logs table
ALTER TABLE sync_logs ADD COLUMN invoice_id TEXT;
ALTER TABLE sync_logs ADD COLUMN payment_id TEXT;
ALTER TABLE sync_logs ADD COLUMN contact_id TEXT;
ALTER TABLE sync_logs ADD COLUMN company_id TEXT;

-- Add foreign key constraints
ALTER TABLE sync_logs ADD CONSTRAINT sync_logs_invoice_id_fkey 
  FOREIGN KEY (invoice_id) REFERENCES invoice_mapping(id) ON DELETE SET NULL;

ALTER TABLE sync_logs ADD CONSTRAINT sync_logs_payment_id_fkey 
  FOREIGN KEY (payment_id) REFERENCES payment_mapping(id) ON DELETE SET NULL;

ALTER TABLE sync_logs ADD CONSTRAINT sync_logs_contact_id_fkey 
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;

ALTER TABLE sync_logs ADD CONSTRAINT sync_logs_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX sync_logs_invoice_id_idx ON sync_logs(invoice_id);
CREATE INDEX sync_logs_payment_id_idx ON sync_logs(payment_id);
CREATE INDEX sync_logs_contact_id_idx ON sync_logs(contact_id);
CREATE INDEX sync_logs_company_id_idx ON sync_logs(company_id);

-- Optional: Populate new foreign key columns based on existing entity_id and entity_type
-- This can be run later as a data migration if needed
-- UPDATE sync_logs SET invoice_id = entity_id WHERE entity_type = 'INVOICE';
-- UPDATE sync_logs SET payment_id = entity_id WHERE entity_type = 'PAYMENT';
-- UPDATE sync_logs SET contact_id = entity_id WHERE entity_type = 'CONTACT';
-- UPDATE sync_logs SET company_id = entity_id WHERE entity_type = 'COMPANY';

-- Add constraint to ensure only one specific foreign key is set (optional for data integrity)
-- ALTER TABLE sync_logs ADD CONSTRAINT chk_sync_logs_single_reference 
-- CHECK (
--   (CASE WHEN invoice_id IS NOT NULL THEN 1 ELSE 0 END) +
--   (CASE WHEN payment_id IS NOT NULL THEN 1 ELSE 0 END) +
--   (CASE WHEN contact_id IS NOT NULL THEN 1 ELSE 0 END) +
--   (CASE WHEN company_id IS NOT NULL THEN 1 ELSE 0 END) <= 1
-- );