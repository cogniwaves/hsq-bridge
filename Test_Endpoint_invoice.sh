#!/bin/bash

# Test HubSpot Invoices API - crm.objects.invoices.read scope
# This script tests the HubSpot Invoices API to read invoice data

echo "Testing HubSpot Invoices API..."
echo "==============================="

curl -s "https://api.hubapi.com/crm/v3/objects/invoices?limit=10&properties=hs_invoice_number,hs_invoice_amount,hs_subtotal,hs_invoice_currency,hs_invoice_status,hs_invoice_date,hs_invoice_due_date,hs_invoice_description,createdate,hs_lastmodifieddate,hs_balance_due&associations=contacts,companies,deals" \
  -H "Authorization: Bearer $HUBSPOT_API_KEY" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "Test completed."