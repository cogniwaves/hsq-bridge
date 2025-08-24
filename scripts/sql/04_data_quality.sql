-- Data Quality: Check data integrity and identify issues
-- Usage: Monitor data quality and find anomalies or missing data

-- 1. Invoice Data Quality Overview
SELECT 
  'Total Invoices' as metric,
  COUNT(*) as count,
  NULL as percentage
FROM invoice_mapping

UNION ALL

SELECT 
  'With Line Items',
  COUNT(*),
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM invoice_mapping), 2)
FROM invoice_mapping 
WHERE line_items_count > 0

UNION ALL

SELECT 
  'With Tax Summary',
  COUNT(*),
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM invoice_mapping), 2)
FROM invoice_mapping im
JOIN tax_summary ts ON im.id = ts.invoice_id

UNION ALL

SELECT 
  'With Primary Contact',
  COUNT(*),
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM invoice_mapping), 2)
FROM invoice_mapping im
JOIN invoice_associations ia ON im.id = ia.invoice_id AND ia.is_primary_contact = true

UNION ALL

SELECT 
  'With Primary Company',
  COUNT(*),
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM invoice_mapping), 2)
FROM invoice_mapping im
JOIN invoice_associations ia ON im.id = ia.invoice_id AND ia.is_primary_company = true;

-- 2. Missing or Inconsistent Data
-- Invoices without essential information
SELECT 
  'Missing Invoice Number' as issue,
  COUNT(*) as count,
  ARRAY_AGG(im.id ORDER BY im.created_at DESC)[:5] as sample_ids
FROM invoice_mapping im
WHERE im.hubspot_invoice_number IS NULL OR im.hubspot_invoice_number = ''

UNION ALL

SELECT 
  'Missing Amount',
  COUNT(*),
  ARRAY_AGG(im.id ORDER BY im.created_at DESC)[:5]
FROM invoice_mapping im
WHERE im.total_amount IS NULL OR im.total_amount = 0

UNION ALL

SELECT 
  'Currency Mismatch (USD vs Detected)',
  COUNT(*),
  ARRAY_AGG(im.id ORDER BY im.created_at DESC)[:5]
FROM invoice_mapping im
WHERE im.currency = 'USD' AND im.detected_currency IS NOT NULL AND im.detected_currency != 'USD'

UNION ALL

SELECT 
  'Line Items Count Mismatch',
  COUNT(*),
  ARRAY_AGG(im.id ORDER BY im.created_at DESC)[:5]
FROM invoice_mapping im
WHERE im.line_items_count != (
  SELECT COUNT(*) FROM line_items li WHERE li.invoice_id = im.id
);

-- 3. Tax Calculation Verification
-- Check if line items tax sum matches tax summary
SELECT 
  im.hubspot_invoice_number,
  im.id as invoice_id,
  ts.total_tax_amount as summary_tax,
  COALESCE(SUM(li.tax_amount), 0) as line_items_tax,
  ABS(ts.total_tax_amount - COALESCE(SUM(li.tax_amount), 0)) as difference,
  ts.currency
FROM invoice_mapping im
JOIN tax_summary ts ON im.id = ts.invoice_id
LEFT JOIN line_items li ON im.id = li.invoice_id
GROUP BY im.id, im.hubspot_invoice_number, ts.total_tax_amount, ts.currency
HAVING ABS(ts.total_tax_amount - COALESCE(SUM(li.tax_amount), 0)) > 0.01
ORDER BY difference DESC;

-- 4. Duplicate Detection
-- Potential duplicate invoices (same amount, date, company)
SELECT 
  comp.name as company_name,
  im.total_amount,
  im.issue_date,
  im.currency,
  COUNT(*) as duplicate_count,
  ARRAY_AGG(im.hubspot_invoice_number) as invoice_numbers,
  ARRAY_AGG(im.id) as invoice_ids
FROM invoice_mapping im
JOIN invoice_associations ia ON im.id = ia.invoice_id AND ia.is_primary_company = true
JOIN companies comp ON ia.company_id = comp.id
WHERE im.issue_date IS NOT NULL AND im.total_amount > 0
GROUP BY comp.name, im.total_amount, im.issue_date, im.currency
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, im.total_amount DESC;

-- 5. Contact Information Completeness
SELECT 
  'Contacts with Email' as metric,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM contacts), 2) as percentage
FROM contacts 
WHERE email IS NOT NULL AND email != ''

UNION ALL

SELECT 
  'Contacts with Full Name',
  COUNT(*),
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM contacts), 2)
FROM contacts 
WHERE (first_name IS NOT NULL OR last_name IS NOT NULL)

UNION ALL

SELECT 
  'Contacts with Phone',
  COUNT(*),
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM contacts), 2)
FROM contacts 
WHERE phone IS NOT NULL AND phone != '';

-- 6. Sync Status and Freshness
SELECT 
  im.sync_source,
  COUNT(*) as invoice_count,
  MIN(im.last_sync_at) as oldest_sync,
  MAX(im.last_sync_at) as newest_sync,
  AVG(EXTRACT(EPOCH FROM (NOW() - im.last_sync_at))/3600) as avg_hours_since_sync
FROM invoice_mapping im
WHERE im.last_sync_at IS NOT NULL
GROUP BY im.sync_source
ORDER BY avg_hours_since_sync DESC;

-- 7. Orphaned Records
-- Line items without invoices (shouldn't happen due to FK)
SELECT 'Orphaned Line Items' as issue, COUNT(*) as count
FROM line_items li
LEFT JOIN invoice_mapping im ON li.invoice_id = im.id
WHERE im.id IS NULL

UNION ALL

-- Tax summaries without invoices (shouldn't happen due to FK)
SELECT 'Orphaned Tax Summaries', COUNT(*)
FROM tax_summary ts
LEFT JOIN invoice_mapping im ON ts.invoice_id = im.id
WHERE im.id IS NULL

UNION ALL

-- Invoice associations without invoices (shouldn't happen due to FK)
SELECT 'Orphaned Invoice Associations', COUNT(*)
FROM invoice_associations ia
LEFT JOIN invoice_mapping im ON ia.invoice_id = im.id
WHERE im.id IS NULL;