# Database Schema Discrepancy Analysis

This document identifies inconsistencies and discrepancies found within the DATABASE_SCHEMA.md documentation, comparing Prisma schema definitions with actual usage patterns in service layer code examples.

## Executive Summary

Analysis of the DATABASE_SCHEMA.md file reveals several critical discrepancies between the documented Prisma schema definitions and the actual usage patterns shown in service examples. These inconsistencies could lead to runtime errors, failed deployments, and data integrity issues.

### Critical Issues Found:
- **15+ missing fields** referenced in code but absent from Prisma schema
- **5 relationship mapping errors** with incorrect or missing foreign key definitions
- **3 unique constraint mismatches** between schema and service usage
- **Multiple enum inconsistencies** and missing constraint definitions

## Detailed Discrepancy Analysis

### 1. InvoiceMapping Model Discrepancies

#### Missing Fields in Prisma Schema
The documented Prisma schema is missing several fields that are referenced in service examples:

**Missing from Prisma Schema:**
```prisma
// These fields are used in service code but missing from schema definition:
hubspotRawData           Json?     @map("hubspot_raw_data")
firstSyncAt              DateTime? @map("first_sync_at")
balanceDue               Decimal?  @map("balance_due")
subtotal                 Decimal?
hubspotInvoiceNumber     String?   @map("hubspot_invoice_number")

// Multiple HubSpot timestamps mentioned in docs but missing from schema:
hubspotCreatedAt         DateTime? @map("hubspot_created_at")
hubspotModifiedAt        DateTime? @map("hubspot_modified_at")
hubspotClosedAt          DateTime? @map("hubspot_closed_at")

// Business timestamps mentioned but not in Prisma schema:
invoiceSentAt            DateTime? @map("invoice_sent_at")
paymentDueDate           DateTime? @map("payment_due_date")
firstPaymentAt           DateTime? @map("first_payment_at")
fullyPaidAt              DateTime? @map("fully_paid_at")

// System timestamps mentioned in docs but missing:
lastWebhookAt            DateTime? @map("last_webhook_at")
lastPeriodicCheckAt      DateTime? @map("last_periodic_check_at")

// Metadata fields referenced but not defined:
hubspotObjectId          String?   @map("hubspot_object_id")
hubspotObjectType        String?   @map("hubspot_object_type")
syncSource               String?   @map("sync_source")
```

**Evidence from Service Code:**
```typescript
// From line 537 in service example:
hubspotRawData: invoice

// From line 549 in service example:
firstSyncAt: new Date(),

// From line 95 in documentation:
"Raw data storage (hubspot_raw_data) for debugging"
"Balance tracking with balance_due field"
```

#### Impact:
- Service code will fail at runtime when trying to access these fields
- Database operations referencing these fields will throw Prisma errors
- Data integrity compromised without proper field definitions

### 2. Contact Model Discrepancies

#### Missing Fields in Prisma Schema
```prisma
// Referenced in service code but missing from schema:
lastSyncAt               DateTime? @map("last_sync_at")
```

**Evidence from Service Code:**
```typescript
// From line 487 in ContactService example:
lastSyncAt: new Date()

// From line 25 in service pattern:
lastSyncAt: new Date()
```

#### Impact:
- Contact upsert operations will fail
- Sync tracking functionality broken

### 3. Relationship Mapping Discrepancies

#### InvoiceAssociation Unique Constraint Mismatch

**Service Code Expects:**
```typescript
// From line 582-587 in service example:
where: {
  invoiceId_contactId_companyId: {
    invoiceId,
    contactId: assoc.contactId,
    companyId: assoc.companyId || null
  }
}
```

**Prisma Schema Shows:**
```prisma
// From line 296:
@@unique([invoiceId, contactId, companyId])
```

**Issue:** The service code references a composite unique constraint named `invoiceId_contactId_companyId` but the Prisma schema shows the constraint defined differently.

### 4. OAuth Token Model Discrepancies

#### Composite Unique Constraint Mismatch

**Service Code Expects:**
```typescript
// From lines 624-628 in TokenStorage example:
where: { 
  provider_tenantId: { 
    provider: config.provider, 
    tenantId: config.tenantId || null 
  } 
}
```

**Prisma Schema Shows:**
```prisma
// From line 487:
@@unique([provider, tenantId])
```

**Issue:** Service code references `provider_tenantId` composite constraint but schema defines it as separate fields.

### 5. SyncLog Relationship Issues

#### Polymorphic Relationship Problems

**Service Code References:**
```typescript
// From lines 136-137 in schema:
invoice: InvoiceMapping? @relation("SyncLogInvoice", fields: [entityId], references: [id])
payment: PaymentMapping? @relation("SyncLogPayment", fields: [entityId], references: [id])
```

**Issues:**
1. **Polymorphic Foreign Keys:** `entityId` cannot reference multiple different tables simultaneously
2. **Relation Naming:** The relation names suggest this should be a polymorphic association but Prisma doesn't natively support this pattern
3. **Data Integrity:** No constraints ensure `entityType` matches the referenced entity

#### Impact:
- Database integrity compromised
- Queries may return incorrect results
- Foreign key constraints will fail

### 6. Missing Database Objects

#### Views and Functions Referenced but Not Defined

**Materialized Views Mentioned:**
```sql
-- From lines 305-315:
mv_invoice_summary
```

**Views Mentioned:**
```sql
-- From lines 319-334:
v_invoice_with_associations
v_payment_reconciliation
```

**Functions Mentioned:**
```sql
-- From lines 338-361:
calculate_canadian_taxes(subtotal, province)
reconcile_invoice_payments(invoice_id)
check_data_quality()
maintenance_cleanup()
refresh_summary_views()
```

**Issue:** These database objects are referenced throughout the documentation but are not defined in the Prisma schema, meaning they don't exist or aren't managed by Prisma.

### 7. Index and Constraint Discrepancies

#### Missing Indexes Referenced in Documentation

**Indexes Mentioned but Not in Schema:**
```sql
-- From lines 367-379:
idx_invoice_status_currency_amount
idx_invoice_dates_status
idx_tax_summary_with_tax
idx_hubspot_raw_data_gin
idx_tax_breakdown_gin
idx_line_items_raw_data_gin
idx_outstanding_invoices
idx_recent_invoices
```

**Triggers Mentioned but Not Defined:**
```sql
-- From lines 389-393:
invoice_currency_consistency_trigger
tax_summary_validation_trigger
line_items_count_trigger
```

### 8. Enum Definition Inconsistencies

#### Complete vs. Partial Enum Definitions

**Documentation shows complete enums but schema section is incomplete:**
- InvoiceStatus, PaymentStatus, PaymentMethod enums are fully defined
- But other enums like EntityType, Platform, SyncOperation appear in some contexts but not others
- ActionType and QueueStatus are referenced in service code but definitions may be incomplete

## Service Layer Code Issues

### 1. Prisma Client Import Inconsistencies

**Multiple Import Patterns:**
```typescript
// Pattern 1 (from line 469):
const prisma = new PrismaClient();

// Pattern 2 (from line 693):
import { prisma } from '../index';

// Pattern 3 (from line 775):
const { prisma } = await import('../index');
```

**Issue:** Inconsistent Prisma client usage could lead to connection pool issues and memory leaks.

### 2. Transaction Type Safety Issues

**Untyped Transaction Parameter:**
```typescript
// From line 573:
private async processInvoiceAssociations(
  tx: any,  // <-- Should be properly typed
  invoiceId: string,
  invoice: HubSpotInvoiceObject
): Promise<void>
```

## Critical Schema Corrections Needed

### 1. InvoiceMapping Model - Complete Definition

```prisma
model InvoiceMapping {
  id                   String    @id @default(uuid())
  hubspotDealId        String?   @map("hubspot_deal_id")
  hubspotInvoiceId     String?   @map("hubspot_invoice_id")
  quickbooksInvoiceId  String?   @map("quickbooks_invoice_id")
  stripeInvoiceId      String?   @map("stripe_invoice_id")
  totalAmount          Decimal   @map("total_amount")
  currency             String    @default("USD")
  status               InvoiceStatus
  clientEmail          String?   @map("client_email")
  clientName           String?   @map("client_name")
  dueDate              DateTime? @map("due_date")
  issueDate            DateTime? @map("issue_date")
  description          String?
  
  // MISSING FIELDS THAT NEED TO BE ADDED:
  hubspotRawData       Json?     @map("hubspot_raw_data")
  balanceDue           Decimal?  @map("balance_due")
  subtotal             Decimal?
  hubspotInvoiceNumber String?   @map("hubspot_invoice_number")
  
  // Enhanced fields
  detectedCurrency     String?   @map("detected_currency")
  lineItemsCount       Int       @default(0) @map("line_items_count")
  
  // HubSpot timestamps - MISSING:
  hubspotCreatedAt     DateTime? @map("hubspot_created_at")
  hubspotModifiedAt    DateTime? @map("hubspot_modified_at")
  hubspotClosedAt      DateTime? @map("hubspot_closed_at")
  
  // Business timestamps - MISSING:
  invoiceSentAt        DateTime? @map("invoice_sent_at")
  paymentDueDate       DateTime? @map("payment_due_date")
  firstPaymentAt       DateTime? @map("first_payment_at")
  fullyPaidAt          DateTime? @map("fully_paid_at")
  
  // System timestamps - MISSING:
  firstSyncAt          DateTime? @map("first_sync_at")
  lastWebhookAt        DateTime? @map("last_webhook_at")
  lastPeriodicCheckAt  DateTime? @map("last_periodic_check_at")
  
  // Metadata - MISSING:
  hubspotObjectId      String?   @map("hubspot_object_id")
  hubspotObjectType    String?   @map("hubspot_object_type")
  syncSource           String?   @map("sync_source")
  
  // Standard timestamps
  createdAt            DateTime  @default(now()) @map("created_at")
  updatedAt            DateTime  @updatedAt @map("updated_at")
  lastSyncAt           DateTime? @map("last_sync_at")
  
  // Relations
  payments             InvoicePayment[]
  syncLogs             SyncLog[]       @relation("SyncLogInvoice")
  associations         InvoiceAssociation[]
  lineItems            LineItem[]
  taxSummary           TaxSummary?

  @@unique([hubspotInvoiceId])
  @@unique([quickbooksInvoiceId])
  @@unique([stripeInvoiceId])
  @@map("invoice_mapping")
}
```

### 2. Contact Model - Add Missing Field

```prisma
model Contact {
  id                String    @id @default(uuid())
  hubspotContactId  String    @unique @map("hubspot_contact_id")
  email             String?
  firstName         String?   @map("first_name")
  lastName          String?   @map("last_name")
  fullName          String?   @map("full_name")
  jobTitle          String?   @map("job_title")
  phone             String?
  country           String?
  city              String?
  
  // HubSpot timestamps
  hubspotCreatedAt  DateTime? @map("hubspot_created_at")
  hubspotUpdatedAt  DateTime? @map("hubspot_updated_at")
  
  // System timestamps
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")
  lastSyncAt        DateTime? @map("last_sync_at") // <-- MISSING FIELD
  
  // Relations
  invoiceAssociations InvoiceAssociation[]
  
  @@map("contacts")
}
```

### 3. SyncLog Relationship Fix

**Problem:** Current polymorphic relationship is invalid in Prisma.

**Current Invalid Structure:**
```prisma
model SyncLog {
  // ... other fields ...
  
  // INVALID - Cannot have foreign keys to different tables on same field
  invoice          InvoiceMapping? @relation("SyncLogInvoice", fields: [entityId], references: [id])
  payment          PaymentMapping? @relation("SyncLogPayment", fields: [entityId], references: [id])
}
```

**Recommended Fix - Separate Foreign Keys:**
```prisma
model SyncLog {
  id               String    @id @default(uuid())
  entityType       EntityType @map("entity_type")
  entityId         String    @map("entity_id")  // Generic reference
  
  // Specific foreign keys instead of polymorphic
  invoiceId        String?   @map("invoice_id")
  paymentId        String?   @map("payment_id")
  contactId        String?   @map("contact_id")
  companyId        String?   @map("company_id")
  
  operation        SyncOperation
  platform         Platform
  status           SyncStatus
  errorMessage     String?   @map("error_message")
  requestData      Json?     @map("request_data")
  responseData     Json?     @map("response_data")
  retryCount       Int       @default(0) @map("retry_count")
  nextRetryAt      DateTime? @map("next_retry_at")
  createdAt        DateTime  @default(now()) @map("created_at")
  updatedAt        DateTime  @updatedAt @map("updated_at")

  // Proper foreign key relationships
  invoice          InvoiceMapping? @relation(fields: [invoiceId], references: [id])
  payment          PaymentMapping? @relation(fields: [paymentId], references: [id])
  contact          Contact?        @relation(fields: [contactId], references: [id])
  company          Company?        @relation(fields: [companyId], references: [id])

  @@index([platform, status])
  @@index([entityType, entityId])
  @@index([createdAt])
  @@map("sync_logs")
}
```

## Service Layer Corrections Needed

### 1. Standardize Prisma Client Usage

**Recommendation:** Use centralized import pattern consistently:

```typescript
// Always use this pattern:
import { prisma } from '../index';

// Never create new instances:
// const prisma = new PrismaClient(); // DON'T DO THIS
```

### 2. Fix Transaction Type Safety

```typescript
// Instead of:
private async processInvoiceAssociations(tx: any, ...)

// Use:
import { Prisma } from '@prisma/client';

private async processInvoiceAssociations(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  invoice: HubSpotInvoiceObject
): Promise<void>
```

## Recommended Action Plan

### Phase 1: Critical Schema Fixes (High Priority)
1. **Add missing fields** to InvoiceMapping and Contact models
2. **Fix SyncLog polymorphic relationships** with separate foreign keys
3. **Correct unique constraint naming** for consistent service usage
4. **Add missing OAuth token constraints** for proper service integration

### Phase 2: Service Layer Standardization (Medium Priority)
1. **Standardize Prisma client imports** across all services
2. **Add proper TypeScript typing** for transaction parameters
3. **Implement consistent error handling** patterns
4. **Add missing relationship fields** where referenced in code

### Phase 3: Database Object Management (Lower Priority)
1. **Define materialized views** mentioned in documentation
2. **Create database functions** for business logic
3. **Implement triggers and constraints** for data validation
4. **Add performance indexes** as documented

### Phase 4: Documentation Alignment (Ongoing)
1. **Update schema documentation** to match actual Prisma definitions
2. **Align service examples** with corrected schema
3. **Add migration scripts** for schema updates
4. **Create testing procedures** to prevent future discrepancies

## Risk Assessment

### High Risk Issues:
- **Service failures** due to missing schema fields
- **Data integrity problems** from invalid relationships
- **Runtime errors** in production environments

### Medium Risk Issues:
- **Performance degradation** from missing indexes
- **Inconsistent data** from missing constraints
- **Development confusion** from mismatched documentation

### Low Risk Issues:
- **Missing convenience functions** for complex queries
- **Suboptimal query patterns** in some service code
- **Documentation inconsistencies** that don't affect runtime

## Conclusion

The database schema documentation reveals significant discrepancies that require immediate attention to prevent system failures and data integrity issues. The most critical fixes involve adding missing fields to core models and correcting invalid relationship definitions. A phased approach to resolving these issues will minimize disruption while ensuring system stability.

**Immediate Actions Required:**
1. Update Prisma schema with missing fields
2. Generate and apply database migrations
3. Test all service layer operations
4. Update documentation to reflect actual schema state

Failure to address these discrepancies will result in continued system instability and potential data loss in production environments.