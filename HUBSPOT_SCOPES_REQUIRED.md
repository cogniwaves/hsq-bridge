# HubSpot API Scopes Required for Complete Invoice System

## Current Scopes (Working)
✅ **Currently configured and working:**
- `crm.objects.invoices.read` - Read invoices (1,124 invoices accessible)
- `crm.objects.contacts.read` - Read contacts associated with invoices
- `crm.objects.companies.read` - Read companies associated with invoices

## Missing Scopes for Tax Details

### For Tax Information Access
❌ **Required for taxes API:**
- `crm.objects.line_items.read` - Read line items with tax details
- `crm.schemas.line_items.read` - Read line item schemas/properties
- `e-commerce` - E-commerce functionality (includes tax calculations)

### For Quote Information Access
❌ **Required for quotes API:**
- `crm.objects.quotes.read` - Read quotes (which contain tax details before invoice generation)
- `crm.schemas.quotes.read` - Read quote schemas/properties

### For Complete Webhook Coverage
❌ **Additional webhook scopes:**
- `crm.objects.line_items.write` - Webhook notifications for line item changes
- `crm.objects.quotes.write` - Webhook notifications for quote changes

## Current API Limitations

### What We CAN Access Now:
```json
{
  "invoice_properties": [
    "hs_invoice_status",
    "hs_object_id", 
    "hs_invoice_date",
    "hs_lastmodifieddate",
    "hs_subtotal",
    "hs_balance_due",
    "hs_createdate"
  ],
  "missing_properties": [
    "hs_invoice_currency", // Always null
    "hs_invoice_amount",   // Always null
    "tax_details",         // Not available in invoices
    "line_items",          // Not available in invoices
    "currency_code"        // Not available in invoices
  ]
}
```

### What We CANNOT Access Yet:
- ❌ Tax amounts (TPS, TVQ, GST, VAT, etc.)
- ❌ Line item details (product by product)
- ❌ Real currency information
- ❌ Quote details that generated the invoice
- ❌ Tax rates and calculations

## How to Update Scopes

### Method 1: HubSpot Developer Portal
1. Go to [HubSpot Developer Portal](https://developers.hubspot.com/)
2. Select your app/integration
3. Navigate to "Auth" → "Scopes"
4. Add the required scopes:
   - `crm.objects.line_items.read`
   - `crm.schemas.line_items.read`
   - `e-commerce`
   - `crm.objects.quotes.read`
   - `crm.schemas.quotes.read`

### Method 2: Private App (Recommended)
If using a Private App (which you appear to be using based on `pat-na1-` token):

1. Go to HubSpot Settings → Integrations → Private Apps
2. Find your app (or create a new one)
3. In "Scopes" section, add:

**CRM Scopes:**
- ✅ `crm.objects.invoices.read` (already have)
- ✅ `crm.objects.contacts.read` (already have)  
- ✅ `crm.objects.companies.read` (already have)
- ❌ `crm.objects.quotes.read` (ADD THIS)
- ❌ `crm.objects.line_items.read` (ADD THIS)
- ❌ `crm.schemas.line_items.read` (ADD THIS)

**E-commerce Scopes:**
- ❌ `e-commerce` (ADD THIS)

4. Generate new access token
5. Update `HUBSPOT_API_KEY` in your `.env` file

## Testing After Scope Update

### Test Taxes API
```bash
curl -s "https://api.hubapi.com/crm/v3/objects/taxes?limit=5" \
  -H "Authorization: Bearer YOUR_NEW_TOKEN"
```

### Test Line Items API
```bash
curl -s "https://api.hubapi.com/crm/v3/objects/line_items?limit=5" \
  -H "Authorization: Bearer YOUR_NEW_TOKEN"
```

### Test Quotes API
```bash
curl -s "https://api.hubapi.com/crm/v3/objects/quotes?limit=5" \
  -H "Authorization: Bearer YOUR_NEW_TOKEN"
```

## Expected Benefits After Update

### 1. Tax Details Available
- Individual tax amounts by type
- Tax rates and calculations
- Currency-specific tax rules

### 2. Line Item Details
- Product-by-product breakdown
- Individual pricing and taxes per item
- Discount applications

### 3. Quote Context
- Pre-invoice quote details
- Tax calculations before finalization
- Customer acceptance status

### 4. Better Currency Support
- Real currency detection from quotes/line items
- Multi-currency tax calculations
- Proper currency conversion

## Implementation Plan After Scope Update

1. **Update HubSpot Client** - Add methods for taxes, quotes, line items
2. **Extend Database Schema** - Add tables for taxes and line items
3. **Update Extraction Logic** - Include tax details in invoice processing
4. **Add Webhook Support** - Real-time updates for quotes and line items
5. **Fix Currency Logic** - Remove hardcoded USD default

## Estimated Impact
- **Current**: 1,124 invoices with basic info only
- **After update**: 1,124 invoices with complete tax breakdown, currency, and line-item details

---

**Next Steps:**
1. Update HubSpot App scopes as documented above
2. Get new API token
3. Test APIs with expanded access
4. Implement enhanced data extraction