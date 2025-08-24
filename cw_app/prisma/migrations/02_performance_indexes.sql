-- Migration: Critical Performance Indexes
-- Priority: HIGH - Run during low traffic period

-- 1. Composite indexes for frequent business queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoice_status_currency_amount 
ON invoice_mapping (status, currency, total_amount DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoice_dates_status 
ON invoice_mapping (issue_date DESC, due_date, status) 
WHERE issue_date IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoice_company_revenue 
ON invoice_mapping (currency, total_amount DESC, created_at DESC);

-- 2. Indexes for tax analysis queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tax_summary_with_tax 
ON tax_summary (currency, total_tax_amount DESC) 
WHERE total_tax_amount > 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tax_summary_month_currency
ON tax_summary (currency, created_at DESC);

-- 3. Optimize association queries (prevent N+1)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_primary_associations 
ON invoice_associations (invoice_id, is_primary_contact, is_primary_company)
WHERE is_primary_contact = true OR is_primary_company = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_association_contact_company 
ON invoice_associations (contact_id, company_id, invoice_id)
WHERE contact_id IS NOT NULL OR company_id IS NOT NULL;

-- 4. Line items performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_line_items_tax_analysis 
ON line_items (currency, tax_label, tax_amount DESC)
WHERE tax_amount > 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_line_items_product_performance 
ON line_items (product_name, currency, amount DESC)
WHERE product_name IS NOT NULL;

-- 5. Sync and webhook performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sync_logs_platform_status_date 
ON sync_logs (platform, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_events_processing 
ON webhook_events (platform, processed, created_at DESC);

-- 6. GIN indexes for JSON searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_hubspot_raw_data_gin 
ON invoice_mapping USING GIN (hubspot_raw_data);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tax_breakdown_gin 
ON tax_summary USING GIN (tax_breakdown);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_line_items_raw_data_gin 
ON line_items USING GIN (hubspot_raw_data);

-- 7. Partial indexes for common filters
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_outstanding_invoices 
ON invoice_mapping (balance_due DESC, due_date, currency)
WHERE balance_due > 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recent_invoices 
ON invoice_mapping (created_at DESC, status, currency)
WHERE created_at > NOW() - INTERVAL '6 months';

-- 8. Contact and company lookup optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_email_name 
ON contacts (email, first_name, last_name)
WHERE email IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_name_domain 
ON companies (name, domain, country)
WHERE name IS NOT NULL;

-- 9. Materialized view for dashboard queries
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_invoice_summary AS
SELECT 
  im.currency,
  im.status,
  DATE_TRUNC('month', im.issue_date) as month,
  COUNT(*) as invoice_count,
  SUM(im.total_amount) as total_amount,
  SUM(COALESCE(ts.total_tax_amount, 0)) as total_tax,
  AVG(im.total_amount) as avg_amount,
  COUNT(*) FILTER (WHERE im.balance_due > 0) as outstanding_count,
  SUM(COALESCE(im.balance_due, 0)) as outstanding_amount
FROM invoice_mapping im
LEFT JOIN tax_summary ts ON im.id = ts.invoice_id
WHERE im.issue_date IS NOT NULL
GROUP BY im.currency, im.status, DATE_TRUNC('month', im.issue_date);

-- Index on materialized view
CREATE INDEX IF NOT EXISTS idx_mv_invoice_summary_lookup 
ON mv_invoice_summary (currency, status, month DESC);

-- 10. Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_summary_views()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_invoice_summary;
  -- Add other views as they are created
END;
$$ LANGUAGE plpgsql;