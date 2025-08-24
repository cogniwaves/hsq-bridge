-- Migration: Business Logic Functions
-- Priority: MEDIUM - Business intelligence and utility functions

-- 1. Canadian Tax Calculation Function
CREATE OR REPLACE FUNCTION calculate_canadian_taxes(
  subtotal DECIMAL,
  province TEXT DEFAULT 'QC'
) RETURNS JSONB AS $$
DECLARE
  gst_rate DECIMAL := 5.0;  -- GST/HST federal rate
  pst_rate DECIMAL := 0.0;  -- Provincial tax rate
  tax_breakdown JSONB := '{}';
  gst_amount DECIMAL;
  pst_amount DECIMAL;
BEGIN
  -- Determine provincial tax rates
  CASE UPPER(province)
    WHEN 'QC' THEN pst_rate := 9.975;   -- TVQ Québec
    WHEN 'BC' THEN pst_rate := 7.0;     -- PST British Columbia
    WHEN 'SK' THEN pst_rate := 6.0;     -- PST Saskatchewan
    WHEN 'MB' THEN pst_rate := 7.0;     -- PST Manitoba
    WHEN 'ON' THEN gst_rate := 13.0;    -- HST Ontario (combined)
    WHEN 'NB' THEN gst_rate := 15.0;    -- HST New Brunswick
    WHEN 'NS' THEN gst_rate := 15.0;    -- HST Nova Scotia
    WHEN 'PE' THEN gst_rate := 15.0;    -- HST Prince Edward Island
    WHEN 'NL' THEN gst_rate := 15.0;    -- HST Newfoundland and Labrador
    -- Territories: GST only (5%)
    WHEN 'YT', 'NT', 'NU', 'AB' THEN pst_rate := 0.0;
    ELSE pst_rate := 0.0;  -- Default to GST only
  END CASE;
  
  -- Calculate amounts
  gst_amount := ROUND(subtotal * gst_rate / 100, 2);
  
  -- Build tax breakdown
  IF UPPER(province) IN ('ON', 'NB', 'NS', 'PE', 'NL') THEN
    -- HST provinces (combined tax)
    tax_breakdown := jsonb_build_object(
      'HST', jsonb_build_object(
        'rate', gst_rate,
        'amount', gst_amount
      )
    );
  ELSE
    -- GST + PST provinces
    tax_breakdown := jsonb_build_object(
      'GST', jsonb_build_object(
        'rate', 5.0,
        'amount', ROUND(subtotal * 5.0 / 100, 2)
      )
    );
    
    IF pst_rate > 0 THEN
      pst_amount := ROUND(subtotal * pst_rate / 100, 2);
      tax_breakdown := tax_breakdown || jsonb_build_object(
        CASE UPPER(province) 
          WHEN 'QC' THEN 'TVQ' 
          ELSE 'PST' 
        END,
        jsonb_build_object(
          'rate', pst_rate,
          'amount', pst_amount
        )
      );
    END IF;
  END IF;
  
  RETURN tax_breakdown;
END;
$$ LANGUAGE plpgsql;

-- 2. Payment Reconciliation Function
CREATE OR REPLACE FUNCTION reconcile_invoice_payments(invoice_id_param UUID)
RETURNS JSONB AS $$
DECLARE
  invoice_total DECIMAL;
  allocated_total DECIMAL;
  result JSONB;
BEGIN
  -- Get invoice total
  SELECT total_amount INTO invoice_total
  FROM invoice_mapping
  WHERE id = invoice_id_param;
  
  -- Calculate allocated payments
  SELECT COALESCE(SUM(allocated_amount), 0) INTO allocated_total
  FROM invoice_payments
  WHERE invoice_mapping_id = invoice_id_param;
  
  -- Build result
  result := jsonb_build_object(
    'invoice_id', invoice_id_param,
    'total_amount', invoice_total,
    'allocated_amount', allocated_total,
    'remaining_balance', invoice_total - allocated_total,
    'payment_status', CASE 
      WHEN allocated_total >= invoice_total THEN 'FULLY_PAID'
      WHEN allocated_total > 0 THEN 'PARTIALLY_PAID'
      ELSE 'UNPAID'
    END
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 3. Data Quality Check Function
CREATE OR REPLACE FUNCTION check_data_quality()
RETURNS TABLE(
  metric TEXT,
  count BIGINT,
  percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'Total Invoices'::TEXT as metric,
    COUNT(*)::BIGINT as count,
    NULL::NUMERIC as percentage
  FROM invoice_mapping
  
  UNION ALL
  
  SELECT 
    'With Line Items'::TEXT,
    COUNT(*)::BIGINT,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM invoice_mapping), 2)
  FROM invoice_mapping 
  WHERE line_items_count > 0
  
  UNION ALL
  
  SELECT 
    'With Tax Summary'::TEXT,
    COUNT(*)::BIGINT,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM invoice_mapping), 2)
  FROM invoice_mapping im
  WHERE EXISTS (SELECT 1 FROM tax_summary ts WHERE ts.invoice_id = im.id)
  
  UNION ALL
  
  SELECT 
    'Currency Mismatches'::TEXT,
    COUNT(*)::BIGINT,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM invoice_mapping WHERE detected_currency IS NOT NULL), 2)
  FROM invoice_mapping 
  WHERE currency != detected_currency AND detected_currency IS NOT NULL
  
  UNION ALL
  
  SELECT 
    'Missing Essential Data'::TEXT,
    COUNT(*)::BIGINT,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM invoice_mapping), 2)
  FROM invoice_mapping 
  WHERE hubspot_invoice_number IS NULL 
     OR total_amount IS NULL 
     OR total_amount = 0;
END;
$$ LANGUAGE plpgsql;

-- 4. Maintenance Cleanup Function
CREATE OR REPLACE FUNCTION maintenance_cleanup()
RETURNS JSONB AS $$
DECLARE
  webhook_deleted BIGINT := 0;
  sync_logs_deleted BIGINT := 0;
  result JSONB;
BEGIN
  -- Clean up old processed webhooks (older than 30 days)
  DELETE FROM webhook_events 
  WHERE processed = true 
    AND processed_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS webhook_deleted = ROW_COUNT;
  
  -- Clean up old successful sync logs (older than 90 days)
  DELETE FROM sync_logs 
  WHERE status = 'COMPLETED' 
    AND created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS sync_logs_deleted = ROW_COUNT;
  
  -- Refresh materialized views
  PERFORM refresh_summary_views();
  
  -- Update table statistics
  ANALYZE;
  
  -- Build result
  result := jsonb_build_object(
    'webhook_events_deleted', webhook_deleted,
    'sync_logs_deleted', sync_logs_deleted,
    'materialized_views_refreshed', true,
    'statistics_updated', true,
    'timestamp', NOW()
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 5. Business Intelligence Helper Views
CREATE OR REPLACE VIEW v_invoice_with_associations AS
SELECT 
  im.*,
  -- Primary contact
  c.first_name,
  c.last_name,
  c.email as contact_email,
  c.phone as contact_phone,
  -- Primary company
  comp.name as company_name,
  comp.domain as company_domain,
  comp.industry,
  comp.country as company_country,
  comp.city as company_city,
  -- Tax information
  ts.total_tax_amount,
  ts.tax_breakdown,
  ts.total_discount_amount
FROM invoice_mapping im
LEFT JOIN invoice_associations ia_contact ON im.id = ia_contact.invoice_id 
  AND ia_contact.is_primary_contact = true
LEFT JOIN contacts c ON ia_contact.contact_id = c.id
LEFT JOIN invoice_associations ia_company ON im.id = ia_company.invoice_id 
  AND ia_company.is_primary_company = true  
LEFT JOIN companies comp ON ia_company.company_id = comp.id
LEFT JOIN tax_summary ts ON im.id = ts.invoice_id;

-- 6. Payment Reconciliation View
CREATE OR REPLACE VIEW v_payment_reconciliation AS
WITH payment_allocations AS (
  SELECT 
    im.id as invoice_id,
    im.hubspot_invoice_number,
    im.total_amount,
    im.balance_due,
    COALESCE(SUM(ip.allocated_amount), 0) as allocated_total,
    COUNT(ip.id) as payment_count
  FROM invoice_mapping im
  LEFT JOIN invoice_payments ip ON im.id = ip.invoice_mapping_id
  GROUP BY im.id, im.hubspot_invoice_number, im.total_amount, im.balance_due
)
SELECT 
  *,
  CASE 
    WHEN allocated_total >= total_amount THEN 'FULLY_PAID'
    WHEN allocated_total > 0 THEN 'PARTIALLY_PAID'
    ELSE 'UNPAID'
  END as reconciled_status,
  (total_amount - allocated_total) as calculated_balance,
  ABS(balance_due - (total_amount - allocated_total)) as balance_discrepancy
FROM payment_allocations;