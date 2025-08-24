-- Business Intelligence: Revenue analysis and customer insights
-- Usage: Generate business reports and analyze customer patterns

-- 1. Revenue Summary by Status
SELECT 
  im.status,
  im.currency,
  COUNT(*) as invoice_count,
  SUM(im.total_amount) as total_revenue,
  SUM(im.balance_due) as outstanding_balance,
  AVG(im.total_amount) as avg_invoice_amount
FROM invoice_mapping im
GROUP BY im.status, im.currency
ORDER BY total_revenue DESC;

-- 2. Top Customers by Revenue
SELECT 
  comp.name as company_name,
  comp.domain,
  comp.country,
  comp.industry,
  COUNT(DISTINCT im.id) as total_invoices,
  SUM(im.total_amount) as total_revenue,
  AVG(im.total_amount) as avg_invoice_amount,
  SUM(im.balance_due) as outstanding_balance,
  im.currency,
  MAX(im.issue_date) as last_invoice_date
FROM companies comp
JOIN invoice_associations ia ON comp.id = ia.company_id AND ia.is_primary_company = true
JOIN invoice_mapping im ON ia.invoice_id = im.id
GROUP BY comp.id, comp.name, comp.domain, comp.country, comp.industry, im.currency
HAVING SUM(im.total_amount) > 0
ORDER BY total_revenue DESC
LIMIT 25;

-- 3. Customer Activity Timeline
SELECT 
  comp.name as company_name,
  DATE_TRUNC('month', im.issue_date) as month,
  COUNT(*) as invoices_count,
  SUM(im.total_amount) as monthly_revenue,
  im.currency
FROM companies comp
JOIN invoice_associations ia ON comp.id = ia.company_id AND ia.is_primary_company = true
JOIN invoice_mapping im ON ia.invoice_id = im.id
WHERE im.issue_date IS NOT NULL
GROUP BY comp.id, comp.name, DATE_TRUNC('month', im.issue_date), im.currency
ORDER BY comp.name, month DESC;

-- 4. Product Performance (from line items)
SELECT 
  li.product_name,
  COUNT(*) as times_sold,
  SUM(li.quantity) as total_quantity,
  AVG(li.unit_price) as avg_unit_price,
  SUM(li.amount) as total_revenue,
  SUM(COALESCE(li.tax_amount, 0)) as total_tax,
  li.currency,
  COUNT(DISTINCT li.invoice_id) as unique_invoices
FROM line_items li
WHERE li.product_name IS NOT NULL
GROUP BY li.product_name, li.currency
ORDER BY total_revenue DESC
LIMIT 30;

-- 5. Outstanding Invoices (Balance Due)
SELECT 
  im.hubspot_invoice_number,
  comp.name as company_name,
  c.email as contact_email,
  im.total_amount,
  im.balance_due,
  im.currency,
  im.issue_date,
  im.due_date,
  CASE 
    WHEN im.due_date < CURRENT_DATE THEN 'OVERDUE'
    WHEN im.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'DUE_SOON'
    ELSE 'PENDING'
  END as urgency,
  (CURRENT_DATE - im.due_date) as days_overdue
FROM invoice_mapping im
LEFT JOIN invoice_associations ia ON im.id = ia.invoice_id AND ia.is_primary_company = true
LEFT JOIN companies comp ON ia.company_id = comp.id
LEFT JOIN invoice_associations ia2 ON im.id = ia2.invoice_id AND ia2.is_primary_contact = true
LEFT JOIN contacts c ON ia2.contact_id = c.id
WHERE im.balance_due > 0
ORDER BY 
  CASE 
    WHEN im.due_date < CURRENT_DATE THEN 1
    WHEN im.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 2
    ELSE 3
  END,
  im.due_date ASC;

-- 6. Geographic Revenue Distribution
SELECT 
  comp.country,
  comp.city,
  COUNT(DISTINCT comp.id) as unique_customers,
  COUNT(DISTINCT im.id) as total_invoices,
  SUM(im.total_amount) as total_revenue,
  AVG(im.total_amount) as avg_invoice_amount,
  im.currency
FROM companies comp
JOIN invoice_associations ia ON comp.id = ia.company_id AND ia.is_primary_company = true
JOIN invoice_mapping im ON ia.invoice_id = im.id
WHERE comp.country IS NOT NULL
GROUP BY comp.country, comp.city, im.currency
HAVING SUM(im.total_amount) > 0
ORDER BY total_revenue DESC;