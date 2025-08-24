-- EMERGENCY ROLLBACK SCRIPT - Phase 1 Critical Migration
-- À utiliser SEULEMENT en cas de problème critique après migration
-- ⚠️  ATTENTION: Ce script supprime les améliorations appliquées

SELECT 'EMERGENCY ROLLBACK - Phase 1 Critical Migration' as rollback_title;
SELECT 'This will remove all Phase 1 improvements!' as warning;

-- Demander confirmation
\prompt 'Type CONFIRM to proceed with rollback (or Ctrl+C to cancel): ' confirmation

-- ================================================================
-- 1. SUPPRIMER LES TRIGGERS D'AUDIT
-- ================================================================

SELECT 'Removing audit triggers...' as step;

DROP TRIGGER IF EXISTS invoice_mapping_audit_trigger ON invoice_mapping;
DROP TRIGGER IF EXISTS tax_summary_audit_trigger ON tax_summary;
DROP TRIGGER IF EXISTS invoice_currency_consistency_trigger ON invoice_mapping;
DROP TRIGGER IF EXISTS tax_summary_validation_trigger ON tax_summary;

-- ================================================================
-- 2. SUPPRIMER LES FONCTIONS
-- ================================================================

SELECT 'Removing business functions...' as step;

DROP FUNCTION IF EXISTS calculate_canadian_taxes(DECIMAL, TEXT);
DROP FUNCTION IF EXISTS reconcile_invoice_payments(UUID);
DROP FUNCTION IF EXISTS check_data_quality();
DROP FUNCTION IF EXISTS maintenance_cleanup();
DROP FUNCTION IF EXISTS refresh_summary_views();
DROP FUNCTION IF EXISTS validate_invoice_currency_consistency();
DROP FUNCTION IF EXISTS validate_tax_calculations();
DROP FUNCTION IF EXISTS audit_trigger();

-- ================================================================
-- 3. SUPPRIMER LES VUES MÉTIER
-- ================================================================

SELECT 'Removing business views...' as step;

DROP VIEW IF EXISTS v_invoice_with_associations;
DROP VIEW IF EXISTS v_payment_reconciliation;

-- ================================================================
-- 4. SUPPRIMER LA VUE MATÉRIALISÉE ET SES INDEX
-- ================================================================

SELECT 'Removing materialized views...' as step;

DROP INDEX IF EXISTS idx_mv_invoice_summary_lookup;
DROP MATERIALIZED VIEW IF EXISTS mv_invoice_summary;

-- ================================================================
-- 5. SUPPRIMER LES INDEX DE PERFORMANCE
-- ================================================================

SELECT 'Removing performance indexes...' as step;

-- Composite indexes for business queries
DROP INDEX CONCURRENTLY IF EXISTS idx_invoice_status_currency_amount;
DROP INDEX CONCURRENTLY IF EXISTS idx_invoice_dates_status;
DROP INDEX CONCURRENTLY IF EXISTS idx_invoice_company_revenue;

-- Tax analysis indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_tax_summary_with_tax;
DROP INDEX CONCURRENTLY IF EXISTS idx_tax_summary_month_currency;

-- Association indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_primary_associations;
DROP INDEX CONCURRENTLY IF EXISTS idx_association_contact_company;

-- Line items indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_line_items_tax_analysis;
DROP INDEX CONCURRENTLY IF EXISTS idx_line_items_product_performance;

-- Sync and webhook indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_sync_logs_platform_status_date;
DROP INDEX CONCURRENTLY IF EXISTS idx_webhook_events_processing;

-- GIN indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_hubspot_raw_data_gin;
DROP INDEX CONCURRENTLY IF EXISTS idx_tax_breakdown_gin;
DROP INDEX CONCURRENTLY IF EXISTS idx_line_items_raw_data_gin;

-- Partial indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_outstanding_invoices;
DROP INDEX CONCURRENTLY IF EXISTS idx_recent_invoices;

-- Contact and company indexes
DROP INDEX CONCURRENTLY IF EXISTS idx_contacts_email_name;
DROP INDEX CONCURRENTLY IF EXISTS idx_companies_name_domain;

-- ================================================================
-- 6. SUPPRIMER LES CONTRAINTES CHECK
-- ================================================================

SELECT 'Removing CHECK constraints...' as step;

-- Invoice mapping constraints
ALTER TABLE invoice_mapping DROP CONSTRAINT IF EXISTS invoice_amount_positive;
ALTER TABLE invoice_mapping DROP CONSTRAINT IF EXISTS invoice_balance_due_valid;
ALTER TABLE invoice_mapping DROP CONSTRAINT IF EXISTS currency_format;

-- Line items constraints
ALTER TABLE line_items DROP CONSTRAINT IF EXISTS quantity_positive;
ALTER TABLE line_items DROP CONSTRAINT IF EXISTS unit_price_non_negative;
ALTER TABLE line_items DROP CONSTRAINT IF EXISTS amount_non_negative;
ALTER TABLE line_items DROP CONSTRAINT IF EXISTS tax_rate_valid;

-- Payment mapping constraints
ALTER TABLE payment_mapping DROP CONSTRAINT IF EXISTS payment_amount_positive;

-- ================================================================
-- 7. SUPPRIMER LA TABLE D'AUDIT
-- ================================================================

SELECT 'Removing audit table...' as step;

DROP INDEX IF EXISTS idx_audit_log_table_record;
DROP TABLE IF EXISTS audit_log;

-- ================================================================
-- 8. VÉRIFICATION POST-ROLLBACK
-- ================================================================

SELECT 'Verifying rollback completion...' as step;

-- Compter les objets restants
SELECT 
  'Remaining constraints' as object_type,
  COUNT(*) as count
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname IN ('invoice_mapping', 'line_items', 'payment_mapping', 'tax_summary')
  AND contype = 'c'
  AND conname LIKE '%positive%' OR conname LIKE '%valid%'

UNION ALL

SELECT 
  'Remaining indexes' as object_type,
  COUNT(*) as count
FROM pg_indexes 
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
  AND indexname NOT IN (
    'line_items_invoice_id_idx',
    'line_items_hubspot_product_id_idx', 
    'line_items_currency_idx',
    'line_items_tax_label_idx',
    'line_items_created_at_idx',
    'tax_summary_invoice_id_idx',
    'tax_summary_currency_idx'
  )

UNION ALL

SELECT 
  'Remaining functions' as object_type,
  COUNT(*) as count
FROM information_schema.routines 
WHERE routine_schema = 'public'
  AND routine_name IN (
    'calculate_canadian_taxes',
    'reconcile_invoice_payments', 
    'check_data_quality',
    'maintenance_cleanup'
  );

-- Message final
SELECT 
  'ROLLBACK COMPLETED' as status,
  'All Phase 1 Critical improvements have been removed' as result,
  'Database returned to pre-migration state' as state,
  'Review application functionality before proceeding' as recommendation;