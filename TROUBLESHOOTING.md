# QuickBooks Sync Troubleshooting Guide

## Issue: "QuickBooks Sync Error: Sync failed" (Resolved)

**Date**: August 24, 2025  
**Status**: ✅ RESOLVED  
**Severity**: High - Blocking invoice sync functionality  

### Problem Description

When clicking "Sync Now" for a new invoice, users encountered the error:
```
QuickBooks Sync Error
Sync failed: QuickBooks sync failed

Contact your administrator to reauthorize QuickBooks if the issue persists.
```

### Investigation Process

#### 1. Initial System Health Check
- ✅ All Docker containers running and healthy
  - `cw_hsq_app` (API): Port 13000, healthy
  - `cw_hsq_dashboard` (Dashboard): Port 13001, healthy  
  - `cw_hsq_postgres` (Database): Port 15432, healthy
  - `cw_hsq_redis` (Cache): Port 16379, healthy

#### 2. Authentication Verification
- ✅ QuickBooks OAuth tokens valid
- ✅ Connection test successful (`authenticated: true, connectionTest: "success"`)
- ✅ Basic authentication working (`admin:admin123`)

#### 3. Database Analysis
- Empty `sync_logs` table indicated sync process wasn't starting
- `invoice_mapping` table showed invoices without `quickbooks_invoice_id`

#### 4. API Endpoint Investigation
- Traced "Sync Now" button to `/api/invoices/{id}/sync` endpoint
- Found error in QuickBooks API call: HTTP 400 "Duplicate Document Number Error"

### Root Cause Analysis

**Primary Issue**: QuickBooks API returned error code 6140 - "Duplicate Document Number Error"
- The system was attempting to create invoices that already existed in QuickBooks
- No duplicate detection logic existed before invoice creation
- Previous sync attempts may have partially succeeded, creating invoices in QuickBooks without updating local database

**Error Details**:
```json
{
  "Fault": {
    "Error": [
      {
        "code": "6140",
        "Detail": "Duplicate Document Number Error: You must specify a different number. This number has already been used.",
        "element": "DocNumber"
      }
    ]
  }
}
```

### Solution Implemented

#### Code Changes Made

**File**: `/cw_app/src/services/quickbooksService.ts`

1. **Added Duplicate Detection Method**:
```typescript
async findInvoiceByDocNumber(docNumber: string): Promise<any> {
  const query = `SELECT * FROM Invoice WHERE DocNumber='${docNumber}'`;
  const response = await this.makeRequest('GET', `/v3/companyid/${this.config.realmId}/query?query=${encodeURIComponent(query)}`);
  return response?.QueryResponse?.Invoice?.[0] || null;
}
```

2. **Enhanced Invoice Creation Logic**:
```typescript
async createInvoice(invoiceData: any): Promise<any> {
  try {
    // Check if invoice already exists
    const existingInvoice = await this.findInvoiceByDocNumber(invoiceData.DocNumber);
    if (existingInvoice) {
      logger.info(`Invoice with DocNumber ${invoiceData.DocNumber} already exists in QuickBooks (ID: ${existingInvoice.Id})`);
      return { Invoice: existingInvoice };
    }

    // Create new invoice
    const response = await this.makeRequest('POST', `/v3/companyid/${this.config.realmId}/invoice`, invoiceData);
    return response;

  } catch (error: any) {
    // Handle duplicate error gracefully
    if (error.message?.includes('6140') || error.message?.includes('Duplicate Document Number')) {
      const existingInvoice = await this.findInvoiceByDocNumber(invoiceData.DocNumber);
      if (existingInvoice) {
        return { Invoice: existingInvoice };
      }
    }
    throw error;
  }
}
```

#### Key Improvements
- **Proactive Duplicate Detection**: Check for existing invoices before creation attempt
- **Graceful Error Handling**: Handle duplicate errors and return existing invoice
- **Better Logging**: Detailed error messages for debugging
- **Data Consistency**: Ensure local database stays in sync with QuickBooks

### Testing Results

**Before Fix**:
- ❌ Sync failed with "Duplicate Document Number Error"
- ❌ Invoices stuck without QuickBooks IDs

**After Fix**:
- ✅ Invoice `5234f308-0f0d-40f7-b0f5-ce310004b43c` synced → QuickBooks ID: 218
- ✅ Invoice `9f822c62-3c22-4861-add5-dcee39e6281f` synced → QuickBooks ID: 215
- ✅ Database properly updated with QuickBooks references
- ✅ "Sync Now" button functioning correctly

### Prevention Measures

1. **Duplicate Prevention**: System now checks for existing invoices before creation
2. **Error Recovery**: Gracefully handles partial sync failures
3. **Data Integrity**: Ensures QuickBooks and local database stay synchronized
4. **Monitoring**: Enhanced logging for better troubleshooting

### How to Verify the Fix

1. **Check Sync Status**:
   ```bash
   # Check if containers are healthy
   docker compose ps
   
   # Test QuickBooks connection
   curl -u admin:admin123 http://localhost:13000/api/auth/quickbooks/simple-status
   ```

2. **Manual Sync Test**:
   - Access dashboard: http://localhost:13001
   - Find an invoice without QuickBooks ID
   - Click "Sync Now"
   - Verify success message and QuickBooks ID assignment

3. **Database Verification**:
   ```sql
   -- Check synced invoices
   SELECT id, hubspot_invoice_number, quickbooks_invoice_id, created_at 
   FROM invoice_mapping 
   WHERE quickbooks_invoice_id IS NOT NULL 
   ORDER BY created_at DESC;
   ```

### Related Files Modified

- `/cw_app/src/services/quickbooksService.ts` - Added duplicate detection logic
- Database: `invoice_mapping` table updated with QuickBooks references

### Future Considerations

1. **Batch Sync**: Consider implementing bulk sync for multiple invoices
2. **Retry Logic**: Enhanced retry mechanisms for transient failures
3. **Webhook Integration**: Real-time sync updates from QuickBooks
4. **Performance Optimization**: Cache frequently accessed QuickBooks data

---

## Common QuickBooks Sync Issues

### Authentication Problems

**Symptoms**: "Contact administrator to reauthorize QuickBooks"
**Solution**: 
1. Check `/api/auth/quickbooks/simple-status`
2. If authentication failed, use `/api/auth/quickbooks/oauth-url` to reauthorize
3. Update tokens in environment variables

**Verification**:
```bash
curl -u admin:admin123 http://localhost:13000/api/auth/quickbooks/simple-status
```

### Container Health Issues

**Symptoms**: Connection refused errors
**Solution**:
```bash
# Check container status
docker compose ps

# Restart specific service
docker compose restart cw_hsq_app

# View logs
docker compose logs cw_hsq_app
```

### Database Connection Issues

**Symptoms**: Database connection errors in logs
**Solution**:
```bash
# Check database container
docker compose ps cw_hsq_postgres

# Test database connection
docker compose exec cw_hsq_postgres psql -U hs_bridge_user -d hs_bridge -c "SELECT version();"
```

### API Authentication Issues

**Symptoms**: "Invalid API key" errors
**Workaround**: Use Basic Authentication
```bash
# Instead of API key header, use basic auth
curl -u admin:admin123 http://localhost:13000/api/endpoint
```

---

**Last Updated**: August 24, 2025  
**Next Review**: September 24, 2025