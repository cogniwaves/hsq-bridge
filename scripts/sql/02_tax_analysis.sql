-- Tax Analysis: Detailed tax breakdown and statistics
-- Usage: Analyze tax patterns, rates, and amounts across invoices

-- 1. Tax Summary by Currency
SELECT 
  ts.currency,
  COUNT(*) as invoice_count,
  SUM(ts.subtotal_before_tax) as total_subtotal,
  SUM(ts.total_tax_amount) as total_taxes,
  SUM(ts.total_after_tax) as total_with_tax,
  AVG(ts.total_tax_amount) as avg_tax_per_invoice,
  ROUND(AVG(ts.total_tax_amount / NULLIF(ts.subtotal_before_tax, 0) * 100), 2) as avg_tax_rate_percent
FROM tax_summary ts
GROUP BY ts.currency
ORDER BY total_with_tax DESC;

-- 2. Tax Types Analysis (from line items)
SELECT 
  li.tax_label,
  li.currency,
  COUNT(*) as line_item_count,
  COUNT(DISTINCT li.invoice_id) as invoice_count,
  AVG(li.tax_rate) as avg_tax_rate,
  SUM(li.tax_amount) as total_tax_amount,
  SUM(li.amount) as total_before_tax,
  ROUND(SUM(li.tax_amount) / NULLIF(SUM(li.amount), 0) * 100, 2) as effective_rate_percent
FROM line_items li
WHERE li.tax_amount > 0 AND li.tax_label IS NOT NULL
GROUP BY li.tax_label, li.currency
ORDER BY total_tax_amount DESC;

-- 3. Monthly Tax Collection
SELECT 
  DATE_TRUNC('month', im.issue_date) as month,
  ts.currency,
  COUNT(*) as invoices,
  SUM(ts.total_tax_amount) as tax_collected,
  SUM(ts.subtotal_before_tax) as revenue_before_tax
FROM tax_summary ts
JOIN invoice_mapping im ON ts.invoice_id = im.id
WHERE im.issue_date IS NOT NULL
GROUP BY DATE_TRUNC('month', im.issue_date), ts.currency
ORDER BY month DESC, currency;

-- 4. Top Tax Contributors (Companies)
SELECT 
  comp.name as company_name,
  comp.country,
  COUNT(DISTINCT im.id) as invoice_count,
  SUM(ts.total_tax_amount) as total_tax_paid,
  SUM(ts.subtotal_before_tax) as total_revenue,
  ts.currency
FROM companies comp
JOIN invoice_associations ia ON comp.id = ia.company_id AND ia.is_primary_company = true
JOIN invoice_mapping im ON ia.invoice_id = im.id
JOIN tax_summary ts ON im.id = ts.invoice_id
WHERE ts.total_tax_amount > 0
GROUP BY comp.id, comp.name, comp.country, ts.currency
ORDER BY total_tax_paid DESC
LIMIT 20;

-- 5. Invoices with Line Item Tax Details
SELECT 
  im.hubspot_invoice_number,
  comp.name as company_name,
  li.product_name,
  li.quantity,
  li.unit_price,
  li.amount,
  li.tax_label,
  li.tax_rate,
  li.tax_amount,
  li.currency,
  (li.amount + COALESCE(li.tax_amount, 0)) as total_with_tax
FROM invoice_mapping im
JOIN line_items li ON im.id = li.invoice_id
LEFT JOIN invoice_associations ia ON im.id = ia.invoice_id AND ia.is_primary_company = true
LEFT JOIN companies comp ON ia.company_id = comp.id
WHERE li.tax_amount > 0
ORDER BY im.hubspot_invoice_number, li.created_at;