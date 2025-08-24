-- Invoice Overview: Complete invoice details with contacts, companies, and tax information
-- Usage: Get comprehensive view of all invoices with associated data

SELECT 
  im.id as invoice_id,
  im.hubspot_invoice_number,
  im.currency,
  im.detected_currency,
  im.total_amount,
  im.subtotal,
  im.balance_due,
  im.status,
  im.line_items_count,
  im.issue_date,
  im.due_date,
  
  -- Contact information (primary)
  c.first_name,
  c.last_name,
  c.email as contact_email,
  c.phone as contact_phone,
  
  -- Company information (primary)
  comp.name as company_name,
  comp.domain as company_domain,
  comp.industry,
  comp.country as company_country,
  comp.city as company_city,
  
  -- Tax summary
  ts.subtotal_before_tax,
  ts.total_tax_amount,
  ts.total_after_tax,
  ts.tax_breakdown,
  ts.total_discount_amount,
  
  -- Metadata
  im.sync_source,
  im.created_at,
  im.last_sync_at

FROM invoice_mapping im
LEFT JOIN invoice_associations ia ON im.id = ia.invoice_id AND ia.is_primary_contact = true
LEFT JOIN contacts c ON ia.contact_id = c.id
LEFT JOIN invoice_associations ia2 ON im.id = ia2.invoice_id AND ia2.is_primary_company = true  
LEFT JOIN companies comp ON ia2.company_id = comp.id
LEFT JOIN tax_summary ts ON im.id = ts.invoice_id

-- Filter examples (uncomment as needed):
-- WHERE im.status = 'SENT'                                    -- Only sent invoices
-- WHERE im.detected_currency = 'CAD'                          -- Only CAD invoices
-- WHERE im.total_amount > 100                                 -- Only invoices > 100
-- WHERE ts.total_tax_amount > 0                              -- Only invoices with taxes
-- WHERE im.created_at >= NOW() - INTERVAL '30 days'         -- Last 30 days
-- WHERE comp.country = 'Canada'                              -- Only Canadian companies

ORDER BY im.created_at DESC
LIMIT 50;