# Access Requirements for HubSpot-QuickBooks Integration

This document outlines all required permissions, scopes, and access tokens needed for the HubSpot-QuickBooks Bridge integration.

## HubSpot Private App Configuration (Account: 342306433)

### Required Scopes for HubSpot Private App

#### ✅ Core CRM Scopes (Essential)
- `crm.objects.invoices.read` - Read invoice records
- `crm.objects.contacts.read` - Read contact information  
- `crm.objects.companies.read` - Read company information
- `crm.objects.deals.read` - Read deal associations with invoices

#### ❌ Additional Scopes Needed for Full Functionality
- `crm.objects.line_items.read` - **CRITICAL** - Read line item details with individual tax rates
- `crm.schemas.line_items.read` - Read line item schema and custom properties
- `crm.objects.quotes.read` - Read quote details (source of invoice data)
- `crm.schemas.quotes.read` - Read quote schemas
- `e-commerce` - E-commerce functionality including tax calculations

#### 🔄 Optional Webhook Scopes (for Real-time Updates)
- `crm.objects.invoices.write` - Webhook notifications for invoice changes
- `crm.objects.line_items.write` - Webhook notifications for line item updates
- `crm.objects.quotes.write` - Webhook notifications for quote changes

### How to Configure HubSpot Private App for Account 342306433

1. **Access HubSpot Settings**
   - Log into HubSpot account 342306433
   - Navigate to Settings → Integrations → Private Apps

2. **Create New Private App**
   - Click "Create a private app"
   - Name: "Octogone QuickBooks Bridge"
   - Description: "Integration between HubSpot invoices and QuickBooks accounting"

3. **Configure Scopes**
   Select the following scopes:
   ```
   CRM Scopes:
   ☑ crm.objects.invoices.read
   ☑ crm.objects.contacts.read  
   ☑ crm.objects.companies.read
   ☑ crm.objects.deals.read
   ☑ crm.objects.line_items.read      ← CRITICAL FOR TAX DATA
   ☑ crm.schemas.line_items.read      ← CRITICAL FOR TAX DATA
   ☑ crm.objects.quotes.read
   ☑ crm.schemas.quotes.read
   
   E-commerce Scopes:
   ☑ e-commerce                       ← CRITICAL FOR TAX CALCULATIONS
   
   Optional (for webhooks):
   ☑ crm.objects.invoices.write
   ☑ crm.objects.line_items.write
   ☑ crm.objects.quotes.write
   ```

4. **Generate Token**
   - Click "Create app"
   - Copy the generated Private App Token (format: `pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
   - **Store this token securely**

### Current Limitations Without Full Scopes

**What we can access with minimal scopes:**
- Basic invoice information (amount, status, dates)
- Associated contact and company data
- Deal associations

**What we CANNOT access without additional scopes:**
- ❌ Individual line item details with products
- ❌ Tax amounts per line item (TPS, TVQ, GST rates)
- ❌ Individual tax rates (14.975% Canadian taxes)
- ❌ Currency information per line item
- ❌ Quote details that generated the invoice

---

## QuickBooks Online Configuration

### Required QuickBooks Permissions

#### ✅ Currently Configured Scopes
- `com.intuit.quickbooks.accounting` - Full accounting access

#### QuickBooks API Capabilities Needed
- **Customer Management**: Create and update customers
- **Invoice Creation**: Create invoices with line items
- **Tax Code Management**: Apply appropriate tax codes (GST, QST, HST, etc.)
- **Item Management**: Create and manage service items
- **Company Information**: Access company settings

### QuickBooks Developer App Setup

1. **Intuit Developer Account**
   - Account: Already configured
   - App ID: AB2IqMF2WoV1gpgfNOtvgF87K1OW8CovUiQg6qxon0yqYL6BjF
   - Company ID: 9341455179116565

2. **OAuth 2.0 Configuration**
   - Redirect URI: `http://localhost:13001/auth/quickbooks/callback`
   - Sandbox Mode: Enabled (`QUICKBOOKS_SANDBOX=true`)

3. **Required Tax Codes in QuickBooks**
   - GST (5%) - Federal tax
   - QST (9.975%) - Quebec provincial tax  
   - GST/QST QC (14.975%) - **CRITICAL** - Combined Quebec taxes
   - HST (13-15%) - Harmonized tax for other provinces

---

## Environment Configuration

### Required Environment Variables

```bash
# HubSpot Configuration (Account 342306433)
HUBSPOT_API_KEY=pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
HUBSPOT_PRIVATE_APP_TOKEN=pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx  
HUBSPOT_ACCOUNT_ID=342306433

# QuickBooks Configuration  
QUICKBOOKS_CLIENT_ID=AB2IqMF2WoV1gpgfNOtvgF87K1OW8CovUiQg6qxon0yqYL6BjF
QUICKBOOKS_CLIENT_SECRET=XADuwx5YDhCgdadDkrs7j03IbB293EAVdHwU90kq
QUICKBOOKS_COMPANY_ID=9341455179116565
QUICKBOOKS_ACCESS_TOKEN=[Generated during OAuth flow]
QUICKBOOKS_REFRESH_TOKEN=[Generated during OAuth flow]
QUICKBOOKS_SANDBOX=true
```

---

## Testing Access After Configuration

### Test HubSpot Access

1. **Test Basic Invoice Access**
   ```bash
   curl -H "Authorization: Bearer YOUR_HUBSPOT_TOKEN" \
        "https://api.hubapi.com/crm/v3/objects/invoices?limit=5"
   ```

2. **Test Line Items Access (Critical)**
   ```bash
   curl -H "Authorization: Bearer YOUR_HUBSPOT_TOKEN" \
        "https://api.hubapi.com/crm/v3/objects/line_items?limit=5"
   ```

3. **Test E-commerce/Tax Data**
   ```bash
   curl -H "Authorization: Bearer YOUR_HUBSPOT_TOKEN" \
        "https://api.hubapi.com/crm/v3/objects/taxes?limit=5"
   ```

### Test QuickBooks Access

1. **Test Connection**
   ```bash
   curl http://localhost:13000/api/quickbooks/test-connection
   ```

2. **Test Customer Creation**
   ```bash
   curl -X POST http://localhost:13000/api/quickbooks/customers/test
   ```

---

## Critical Success Factors

### For HubSpot (Account 342306433)
1. **Must have line_items.read scope** - Without this, no tax details available
2. **Must have e-commerce scope** - Required for tax calculations  
3. **Verify account access** - Ensure token works with new account

### For QuickBooks Integration
1. **Tax Code Mapping** - Ensure GST/QST QC (14.975%) code exists
2. **Customer Management** - Ability to create/update customers
3. **Token Renewal** - Automatic refresh when tokens expire

### For Canadian Tax Compliance
1. **TPS (GST) Recognition** - 5% federal tax
2. **TVQ (QST) Recognition** - 9.975% Quebec tax  
3. **Combined Rate Handling** - 14.975% total rate
4. **Proper Tax Code Application** - Use GST/QST QC code, not adjustments

---

## Next Steps After Access Configuration

1. ✅ **Update HubSpot Private App** - Add all required scopes
2. ✅ **Generate New Token** - For account 342306433
3. ✅ **Update Environment Variables** - New token and account ID
4. ⏳ **Test Data Extraction** - Verify line items and tax data access
5. ⏳ **Verify Tax Mapping** - Ensure TPS + TVQ → GST/QST QC
6. ⏳ **Test End-to-End Sync** - HubSpot invoice → QuickBooks with taxes

---

## Security Considerations

### Token Management
- **Never commit tokens to version control**
- **Rotate tokens regularly** (quarterly recommended)
- **Use environment variables** for all sensitive data
- **Monitor token usage** for unusual activity

### Access Control  
- **Principle of least privilege** - Only request needed scopes
- **Regular access audits** - Review and cleanup unused permissions
- **Separate environments** - Different tokens for dev/staging/production

### Data Protection
- **Encrypt sensitive data** at rest and in transit
- **Audit trail maintenance** - Log all data access and modifications
- **GDPR/Privacy compliance** - Handle customer data appropriately

---

## Support and Troubleshooting

### HubSpot Issues
- **Scope denied errors** - Check private app configuration
- **Token invalid errors** - Regenerate token in HubSpot settings
- **Rate limiting** - Implement proper retry logic with exponential backoff

### QuickBooks Issues  
- **Authentication failures** - Check OAuth token expiration
- **Tax code errors** - Verify Canadian tax codes exist in QuickBooks
- **Validation errors** - Ensure Amount = UnitPrice × Quantity

### Integration Issues
- **Tax mapping failures** - Check TPS + TVQ → GST/QST QC logic
- **Currency issues** - Verify CAD handling in both systems
- **Sync failures** - Review error logs and retry mechanisms

---

**Last Updated**: August 15, 2025  
**Account**: HubSpot 342306433 → QuickBooks Company 9341455179116565