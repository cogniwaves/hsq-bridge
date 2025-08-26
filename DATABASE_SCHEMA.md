# Database Schema Documentation - cw_app Perspective

This document describes how the `cw_app` application sees and interacts with the PostgreSQL database through Prisma ORM.

## Database Architecture Overview

The cw_app uses a PostgreSQL database with Prisma ORM for type-safe database access. The database is designed around a normalized schema with clear separation of concerns:

- **Core Business Logic**: Invoice and payment management with cross-platform synchronization
- **Entity Management**: Normalized contact and company storage
- **Synchronization Infrastructure**: Audit trails, watermarks, and transfer queues
- **Security**: Encrypted OAuth token storage with refresh management
- **Event Processing**: Webhook events and background job processing

### Database Connection

```typescript
// src/index.ts
export const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});
```

The Prisma client is exported from the main application and imported across services for database operations.

## Core Database Models

### 1. InvoiceMapping - Central Invoice Hub
**Table**: `invoice_mapping`
**Purpose**: Single source of truth for invoices across all platforms

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
  
  // Enhanced fields
  detectedCurrency     String?   @map("detected_currency")
  lineItemsCount       Int       @default(0) @map("line_items_count")
  
  // Timestamps
  createdAt            DateTime  @default(now()) @map("created_at")
  updatedAt            DateTime  @updatedAt @map("updated_at")
  lastSyncAt           DateTime? @map("last_sync_at")
  
  // Relations
  payments             InvoicePayment[]
  syncLogs             SyncLog[]
  associations         InvoiceAssociation[]
  lineItems            LineItem[]
  taxSummary           TaxSummary?
}
```

**Key Features**:
- Cross-platform ID mapping (HubSpot, QuickBooks, Stripe)
- Rich timestamp tracking for business and technical events
- Raw HubSpot data storage for debugging and future reference
- Currency detection from line items analysis

## Core Tables

### InvoiceMapping
**Primary Purpose**: Central invoice records linking across all platforms

```sql
Table: invoice_mapping
Key Fields:
- id (UUID, Primary Key)
- hubspot_deal_id, hubspot_invoice_id (HubSpot identifiers)
- quickbooks_invoice_id, stripe_invoice_id (Platform identifiers)
- total_amount (Decimal), currency (String, default USD)
- status (InvoiceStatus enum)
- detected_currency (Real currency from line items)
- line_items_count (Auto-updated counter)
```

**Business Context**: This table serves as the single source of truth for invoice data across all platforms. It includes both original currency and detected currency to handle cases where line items reveal the actual currency used.

**Key Features**:
- Unique constraints on all platform-specific IDs
- Support for multiple timestamps (HubSpot, business, system)
- Raw data storage (hubspot_raw_data) for debugging
- Balance tracking with balance_due field

### PaymentMapping  
**Primary Purpose**: Payment records with cross-platform linking

```sql
Table: payment_mapping
Key Fields:
- id (UUID, Primary Key)
- stripe_payment_id, quickbooks_payment_id (Platform identifiers)
- amount (Decimal), currency (String)
- payment_method (PaymentMethod enum)
- status (PaymentStatus enum)
- transaction_date (DateTime)
```

**Business Context**: Tracks payments from Stripe and QuickBooks with metadata for reconciliation.

### InvoicePayment
**Primary Purpose**: Junction table for invoice-payment allocations

```sql
Table: invoice_payments
Key Fields:
- invoice_mapping_id (UUID, FK to invoice_mapping)
- payment_mapping_id (UUID, FK to payment_mapping)  
- allocated_amount (Decimal)
- status (AllocationStatus enum)
```

**Business Context**: Enables partial payments and complex payment allocations. A single payment can be split across multiple invoices, and a single invoice can receive multiple payments.

## Enhanced Tax System

### LineItem
**Primary Purpose**: Product-level invoice details with comprehensive tax information

```sql
Table: line_items
Key Fields:
- hubspot_line_item_id (Unique identifier)
- invoice_id (FK to invoice_mapping)
- product_name, hubspot_product_id, sku (Product identification)
- quantity, unit_price, amount (Pricing)
- tax_amount, tax_rate, tax_label, tax_category (Tax details)
- discount_amount, discount_percentage (Discount handling)
```

**Business Context**: Provides granular invoice breakdown for accurate tax calculations. Supports Canadian tax systems (GST, HST, PST, TVQ) and international currencies.

### TaxSummary
**Primary Purpose**: Aggregated tax calculations per invoice

```sql
Table: tax_summary  
Key Fields:
- invoice_id (UUID, Unique FK to invoice_mapping)
- currency (String)
- subtotal_before_tax, total_tax_amount, total_after_tax (Decimal)
- tax_breakdown (JSONB) - Structured tax details by type
- total_discount_amount (Decimal)
```

**Business Context**: Provides quick access to tax totals without recalculating from line items. The tax_breakdown JSONB field stores detailed tax information like:
```json
{
  "GST": {"rate": 5.0, "amount": 25.00},
  "TVQ": {"rate": 9.975, "amount": 49.88}
}
```

## Entity Management

### Contact
**Primary Purpose**: Normalized contact storage (single source of truth)

```sql
Table: contacts
Key Fields:  
- hubspot_contact_id (Unique identifier)
- email, first_name, last_name, full_name (Contact details)
- job_title, phone, country, city (Additional info)
- hubspot_created_at, hubspot_updated_at (HubSpot timestamps)
```

### Company
**Primary Purpose**: Normalized company storage (single source of truth)

```sql
Table: companies
Key Fields:
- hubspot_company_id (Unique identifier)  
- name, domain, industry (Company details)
- country, city, state, zip (Location info)
- hubspot_created_at, hubspot_updated_at (HubSpot timestamps)
```

### InvoiceAssociation
**Primary Purpose**: Many-to-many relationships between invoices and entities

```sql
Table: invoice_associations
Key Fields:
- invoice_id (FK to invoice_mapping)
- contact_id (Optional FK to contacts)
- company_id (Optional FK to companies)  
- is_primary_contact, is_primary_company (Boolean flags)
```

**Business Context**: Allows invoices to be associated with multiple contacts and companies while maintaining primary relationships for reporting.

## System Infrastructure

### SyncLog
**Primary Purpose**: Complete audit trail for synchronization operations

```sql
Table: sync_logs
Key Fields:
- entity_type (EntityType enum: INVOICE, PAYMENT, CONTACT, etc.)
- entity_id (String - references various entity tables)
- operation (SyncOperation: CREATE, UPDATE, DELETE, SYNC)
- platform (Platform: HUBSPOT, STRIPE, QUICKBOOKS)
- status (SyncStatus: PENDING, COMPLETED, FAILED, etc.)
- request_data, response_data (JSONB for debugging)
- retry_count, next_retry_at (Retry mechanism)
```

### WebhookEvent  
**Primary Purpose**: Real-time event processing with retry logic

```sql
Table: webhook_events
Key Fields:
- platform (Platform enum)
- event_type, event_id (Event identification)
- payload (JSONB with full event data)
- processed (Boolean), processed_at (DateTime)
- error_message, retry_count (Error handling)
```

### SyncWatermark
**Primary Purpose**: Track incremental sync progress by entity type

```sql
Table: sync_watermarks
Key Fields:
- entity_type (EntityType enum)
- last_sync_at (DateTime)
- entity_count (Integer - entities processed)
- sync_duration (Integer milliseconds)
- error_count, last_error_message (Error tracking)
```

### QuickBooksTransferQueue
**Primary Purpose**: Approval workflow for QuickBooks synchronization

```sql
Table: quickbooks_transfer_queue
Key Fields:
- entity_type, entity_id (Entity to transfer)
- action_type (ActionType: CREATE, UPDATE, DELETE, etc.)
- status (QueueStatus: PENDING_REVIEW, APPROVED, TRANSFERRED, etc.)
- entity_data (JSONB with data to transfer)
- approved_by, approved_at (Approval tracking)
- quickbooks_id (Generated QB ID after transfer)
```

**Business Context**: Implements a manual review process before writing to QuickBooks, preventing data corruption and enabling validation.

## Security & Authentication

### OAuthToken
**Primary Purpose**: Secure OAuth token storage with encryption

```sql
Table: oauth_tokens
Key Fields:
- provider (String: 'quickbooks', 'hubspot', etc.)
- tenant_id (Optional for multi-tenant support)
- access_token, refresh_token (Encrypted strings)
- expires_at, refresh_token_expires_at (DateTime)
- realm_id (QuickBooks specific)
- encryption_method, encryption_iv (AES-256-GCM metadata)
```

**Security Features**:
- All tokens encrypted with AES-256-GCM before storage
- Separate encryption IV per token
- Support for multi-tenant token isolation
- Comprehensive expiry tracking

### TokenRefreshLog
**Primary Purpose**: Audit trail for token refresh operations

```sql
Table: token_refresh_logs
Key Fields:
- token_id (References oauth_tokens)
- refresh_type ('automatic', 'manual', 'on_demand')
- status ('success', 'failed', 'skipped')
- old_expires_at, new_expires_at (Expiry tracking)
- error_code, error_message (Failure analysis)
- request_metadata, response_metadata (JSONB debugging info)
```

## Business Intelligence Features

### Materialized Views

#### mv_invoice_summary
**Purpose**: Pre-aggregated invoice statistics for dashboard queries

```sql
Columns:
- currency, status, month (Grouping dimensions)  
- invoice_count, total_amount, total_tax (Aggregates)
- avg_amount, outstanding_count, outstanding_amount (Calculations)
```

**Refresh**: Updated via `refresh_summary_views()` function during maintenance.

### Views

#### v_invoice_with_associations  
**Purpose**: Complete invoice view with related entities and tax data

Joins invoice_mapping with:
- Primary contact information (name, email, phone)
- Primary company information (name, domain, industry, location)
- Tax summary data (total_tax_amount, tax_breakdown, discounts)

#### v_payment_reconciliation
**Purpose**: Payment allocation analysis and balance validation

Features:
- Calculated vs. recorded balance comparison
- Payment allocation totals
- Reconciliation status determination
- Balance discrepancy detection

### Database Functions

#### calculate_canadian_taxes(subtotal, province)
**Purpose**: Calculate Canadian tax rates by province
- Supports GST, HST, PST, TVQ variations
- Returns structured JSONB tax breakdown
- Handles provincial tax rate variations

#### reconcile_invoice_payments(invoice_id)  
**Purpose**: Real-time payment reconciliation
- Calculates total allocated payments
- Determines payment status
- Returns comprehensive reconciliation data

#### check_data_quality()
**Purpose**: Data quality metrics
- Invoice completeness statistics
- Currency consistency checks  
- Missing data identification

#### maintenance_cleanup()
**Purpose**: Automated database maintenance
- Removes old webhook events (30+ days)
- Cleans successful sync logs (90+ days)
- Refreshes materialized views
- Updates table statistics

## Performance Optimizations

### Indexes

**Composite Indexes**:
- `idx_invoice_status_currency_amount` - Business queries
- `idx_invoice_dates_status` - Date-based filtering
- `idx_tax_summary_with_tax` - Tax analysis queries

**GIN Indexes**:  
- `idx_hubspot_raw_data_gin` - JSON data searches
- `idx_tax_breakdown_gin` - Tax breakdown queries
- `idx_line_items_raw_data_gin` - Line item data searches

**Partial Indexes**:
- `idx_outstanding_invoices` - Unpaid invoices only
- `idx_recent_invoices` - Last 6 months only

### Constraints and Validation

**Check Constraints**:
- Amount fields must be positive/non-negative
- Currency format validation (3-letter codes)
- Tax rates between 0-100%
- Quantity must be positive

**Triggers**:
- `invoice_currency_consistency_trigger` - Currency mismatch warnings
- `tax_summary_validation_trigger` - Tax calculation validation
- `line_items_count_trigger` - Auto-update counters
- Audit triggers on critical tables

## Data Evolution and Migrations

The database has evolved through several phases:

1. **Initial Schema**: Basic invoice and payment mapping
2. **Enhanced Tax Support**: Line items and tax summary tables  
3. **Critical Constraints**: Validation and audit logging
4. **Performance Optimization**: Indexes and materialized views
5. **Business Intelligence**: Functions and analytical views
6. **OAuth Security**: Encrypted token storage system

### Migration Files Applied:
- `add_line_items_and_taxes.sql` - Enhanced tax system
- `01_critical_constraints.sql` - Data validation and audit
- `02_performance_indexes.sql` - Query optimization  
- `03_business_functions.sql` - BI functions and views

## Current Statistics

Based on the implementation status:
- **1,124+ invoices** processed from HubSpot
- **Multi-currency support**: CAD, USD, EUR detection
- **Tax system**: Full Canadian tax support (GST, HST, PST, TVQ)
- **Line items**: Product-level invoice breakdown
- **Security**: AES-256-GCM encrypted OAuth tokens
- **Performance**: Optimized with 20+ specialized indexes

## Usage Patterns

### Common Queries
1. **Invoice Analysis**: Currency, status, date range filtering
2. **Tax Reporting**: Breakdown by tax type and jurisdiction
3. **Payment Reconciliation**: Balance verification and discrepancy detection
4. **Entity Relationships**: Contact/company association queries
5. **Sync Monitoring**: Operation status and error analysis

### Maintenance Schedules
- **Daily**: Token refresh validation, webhook processing
- **Weekly**: Data quality checks, sync watermark updates  
- **Monthly**: Materialized view refresh, cleanup operations
- **Quarterly**: Full database optimization (ANALYZE, REINDEX)

## Integration Points

The database integrates with:
- **HubSpot API**: Contact, company, deal, invoice, and line item data
- **Stripe API**: Payment and invoice synchronization (planned)
- **QuickBooks API**: OAuth token management and transfer queue
- **Redis**: Background job processing and caching
- **Application Services**: Real-time webhook processing and sync operations

This schema provides a robust foundation for multi-platform business data synchronization with strong consistency, comprehensive audit trails, and advanced tax handling capabilities.

## Service Layer Database Access Patterns

### Prisma Client Usage in Services

The application uses a centralized Prisma client instance exported from `src/index.ts`:

```typescript
// src/index.ts
export const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});
```

This client is imported across 20+ services for consistent database access.

### 1. Contact Service Pattern (`src/services/contactService.ts`)

```typescript
import { PrismaClient } from '@prisma/client';
import { HubSpotContact, getHubSpotClient } from './hubspotClient';

const prisma = new PrismaClient();

export class ContactService {
  // Upsert pattern - create or update based on HubSpot ID
  async upsertContact(hubspotContact: HubSpotContact): Promise<string> {
    const props = hubspotContact.properties;
    
    const contactData = {
      email: props.email,
      firstName: props.firstname,
      lastName: props.lastname,
      fullName: this.buildFullName(props.firstname, props.lastname),
      jobTitle: props.jobtitle,
      phone: props.phone,
      country: props.country,
      city: props.city,
      hubspotCreatedAt: this.parseDate(props.createdate),
      hubspotUpdatedAt: this.parseDate(props.lastmodifieddate),
      lastSyncAt: new Date()
    };

    const contact = await prisma.contact.upsert({
      where: { hubspotContactId: hubspotContact.id },
      update: contactData,
      create: {
        hubspotContactId: hubspotContact.id,
        ...contactData
      }
    });

    logger.debug(`Upserted contact ${contact.id} (HubSpot: ${hubspotContact.id})`);
    return contact.id;
  }

  // Fetch and upsert pattern with error handling
  async fetchAndUpsertContact(hubspotContactId: string): Promise<string | null> {
    try {
      const hubspotClient = getHubSpotClient();
      const contact = await hubspotClient.crm.contacts.basicApi.getById(hubspotContactId);
      return await this.upsertContact(contact);
    } catch (error) {
      logger.error(`Failed to fetch contact ${hubspotContactId}`, { error: error.message });
      return null;
    }
  }
}
```

### 2. Invoice Extraction Pattern (`src/services/normalizedInvoiceExtractor.ts`)

```typescript
import { PrismaClient, InvoiceStatus } from '@prisma/client';

const prisma = new PrismaClient();

export class NormalizedInvoiceExtractor {
  // Transaction pattern for complex multi-table operations
  private async processInvoiceWithRelations(invoice: HubSpotInvoiceObject): Promise<void> {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Upsert main invoice record
      const invoiceRecord = await tx.invoiceMapping.upsert({
        where: { hubspotInvoiceId: invoice.id },
        update: {
          totalAmount: this.extractAmount(invoice),
          currency: this.extractCurrency(invoice),
          status: this.mapInvoiceStatus(invoice),
          detectedCurrency: this.detectCurrencyFromLineItems(invoice),
          lastSyncAt: new Date(),
          hubspotRawData: invoice
        },
        create: {
          hubspotInvoiceId: invoice.id,
          hubspotDealId: this.extractDealId(invoice),
          totalAmount: this.extractAmount(invoice),
          currency: this.extractCurrency(invoice),
          status: this.mapInvoiceStatus(invoice),
          clientEmail: this.extractClientEmail(invoice),
          clientName: this.extractClientName(invoice),
          description: this.extractDescription(invoice),
          hubspotRawData: invoice,
          firstSyncAt: new Date(),
          lastSyncAt: new Date()
        }
      });

      // 2. Process associated contacts and companies
      await this.processInvoiceAssociations(tx, invoiceRecord.id, invoice);

      // 3. Process line items if available
      if (invoice.lineItems && invoice.lineItems.length > 0) {
        await this.processLineItems(tx, invoiceRecord.id, invoice.lineItems);
      }

      // 4. Calculate and store tax summary
      await this.processTaxSummary(tx, invoiceRecord.id, invoice);

      return invoiceRecord;
    });

    logger.info(`Processed invoice ${result.id} with all relations`);
  }

  // Association processing within transaction
  private async processInvoiceAssociations(
    tx: any,
    invoiceId: string,
    invoice: HubSpotInvoiceObject
  ): Promise<void> {
    const associations = await this.getInvoiceAssociations(invoice);
    
    for (const assoc of associations) {
      if (assoc.contactId) {
        await tx.invoiceAssociation.upsert({
          where: {
            invoiceId_contactId_companyId: {
              invoiceId,
              contactId: assoc.contactId,
              companyId: assoc.companyId || null
            }
          },
          update: {
            isPrimaryContact: assoc.isPrimary
          },
          create: {
            invoiceId,
            contactId: assoc.contactId,
            companyId: assoc.companyId,
            isPrimaryContact: assoc.isPrimary,
            isPrimaryCompany: assoc.companyId ? assoc.isPrimary : false
          }
        });
      }
    }
  }
}
```

### 3. Token Storage Pattern (`src/services/auth/tokenStorage.ts`)

```typescript
import { PrismaClient, OAuthToken } from '@prisma/client';
import { TokenEncryption, CryptoUtils } from '../../utils/crypto';

export class DatabaseTokenStorage implements ITokenStorage {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  // Encrypted storage pattern
  async saveTokens(tokens: OAuthTokenData, config: TokenStorageConfig): Promise<void> {
    const encryptedTokens = await this.encryptTokens(tokens);
    
    await this.prisma.oAuthToken.upsert({
      where: { 
        provider_tenantId: { 
          provider: config.provider, 
          tenantId: config.tenantId || null 
        } 
      },
      update: {
        accessToken: encryptedTokens.accessToken,
        refreshToken: encryptedTokens.refreshToken,
        expiresAt: encryptedTokens.expiresAt,
        refreshTokenExpiresAt: encryptedTokens.refreshTokenExpiresAt,
        lastRefreshedAt: new Date(),
        refreshCount: { increment: 1 }
      },
      create: {
        provider: config.provider,
        tenantId: config.tenantId,
        accessToken: encryptedTokens.accessToken,
        refreshToken: encryptedTokens.refreshToken,
        tokenType: tokens.tokenType || 'Bearer',
        expiresAt: encryptedTokens.expiresAt,
        refreshTokenExpiresAt: encryptedTokens.refreshTokenExpiresAt,
        scope: tokens.scope,
        realmId: tokens.realmId,
        companyId: tokens.companyId,
        encryptionMethod: 'AES-256-GCM',
        encryptionIV: encryptedTokens.iv
      }
    });

    logger.info('OAuth tokens saved securely', { 
      provider: config.provider, 
      tenantId: config.tenantId 
    });
  }

  // Decryption with error handling
  async getTokens(config: TokenStorageConfig): Promise<OAuthTokenData | null> {
    try {
      const tokenRecord = await this.prisma.oAuthToken.findUnique({
        where: {
          provider_tenantId: {
            provider: config.provider,
            tenantId: config.tenantId || null
          }
        }
      });

      if (!tokenRecord) {
        return null;
      }

      const decryptedTokens = await this.decryptTokens(tokenRecord);
      return decryptedTokens;
    } catch (error) {
      logger.error('Failed to retrieve tokens', { 
        error: error.message, 
        provider: config.provider 
      });
      return null;
    }
  }
}
```

### 4. Transfer Queue Pattern (`src/services/quickbooksTransferQueue.ts`)

```typescript
import { logger } from '../utils/logger';
import { prisma } from '../index';
import { EntityType, ActionType, QueueStatus } from '@prisma/client';

export class QuickBooksTransferQueue {
  // Add to queue with full audit trail
  async addToQueue(
    entityType: EntityType,
    entityId: string,
    actionType: ActionType,
    entityData: any,
    triggerReason: string,
    originalData?: any
  ): Promise<QueueEntry> {
    const queueEntry = await prisma.quickBooksTransferQueue.create({
      data: {
        entityType,
        entityId,
        actionType,
        triggerReason,
        entityData,
        originalData,
        status: 'PENDING_REVIEW'
      }
    });

    logger.info('Added entity to QuickBooks transfer queue', {
      queueId: queueEntry.id,
      entityType,
      entityId,
      actionType,
      triggerReason
    });

    return this.mapToQueueEntry(queueEntry);
  }

  // Approval workflow with validation
  async approveTransfer(
    queueId: string,
    approvedBy: string,
    validationNotes?: string
  ): Promise<QueueEntry> {
    const updated = await prisma.quickBooksTransferQueue.update({
      where: { id: queueId, status: 'PENDING_REVIEW' },
      data: {
        status: 'APPROVED',
        approvedBy,
        approvedAt: new Date(),
        validationNotes
      }
    });

    logger.info('Transfer approved', {
      queueId,
      approvedBy,
      entityType: updated.entityType
    });

    return this.mapToQueueEntry(updated);
  }

  // Batch operations for efficiency
  async getQueueSummary(): Promise<QueueSummary> {
    const summary = await prisma.quickBooksTransferQueue.groupBy({
      by: ['entityType', 'status'],
      _count: true
    });

    return this.buildQueueSummary(summary);
  }
}
```

### 5. Database Connectivity Testing (`src/utils/connectivity.ts`)

```typescript
// Dynamic import pattern to avoid circular dependencies
export async function testDatabaseConnection(): Promise<ConnectivityTest> {
  const startTime = Date.now();
  
  try {
    // Import prisma here to avoid circular dependency
    const { prisma } = await import('../index');
    
    // Test basic connectivity
    await prisma.$queryRaw`SELECT 1 as test`;
    
    // Test write capability
    await prisma.$executeRaw`SELECT COUNT(*) FROM invoice_mapping`;
    
    const responseTime = Date.now() - startTime;
    
    return {
      platform: 'Database',
      status: 'success',
      message: 'PostgreSQL connection successful',
      responseTime,
      details: {
        connectionType: 'Prisma Client',
        database: 'PostgreSQL'
      }
    };
  } catch (error) {
    return {
      platform: 'Database',
      status: 'error',
      message: 'Database connection failed',
      details: {
        error: error.message,
        code: error.code
      }
    };
  }
}
```

## Error Handling and Transaction Patterns

### Prisma Error Handling

```typescript
import { Prisma } from '@prisma/client';

async function handleDatabaseOperation() {
  try {
    const result = await prisma.invoiceMapping.create(data);
    logger.info('Invoice created successfully', { invoiceId: result.id });
    return result;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case 'P2002':
          logger.warn('Unique constraint violation', { 
            constraint: error.meta?.target,
            error: error.message 
          });
          throw new ConflictError('Invoice already exists');
        case 'P2025':
          logger.warn('Record not found', { error: error.message });
          throw new NotFoundError('Invoice not found');
        case 'P2003':
          logger.error('Foreign key constraint failed', { error: error.message });
          throw new ValidationError('Invalid reference');
        default:
          logger.error('Database error', { code: error.code, error: error.message });
          throw new DatabaseError('Database operation failed');
      }
    }
    logger.error('Unexpected database error', { error: error.message });
    throw error;
  }
}
```

### Complex Transaction Pattern

```typescript
async function processInvoiceWithPayments(invoiceData: any, paymentData: any[]) {
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create invoice
    const invoice = await tx.invoiceMapping.create({
      data: invoiceData
    });

    // 2. Create payments
    const payments = await Promise.all(
      paymentData.map(payment => 
        tx.paymentMapping.create({
          data: payment
        })
      )
    );

    // 3. Link payments to invoice
    const invoicePayments = await Promise.all(
      payments.map(payment =>
        tx.invoicePayment.create({
          data: {
            invoiceMappingId: invoice.id,
            paymentMappingId: payment.id,
            allocatedAmount: payment.amount,
            status: 'ALLOCATED'
          }
        })
      )
    );

    // 4. Update invoice status based on payments
    const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);
    const newStatus = totalPayments >= invoice.totalAmount ? 'PAID' : 'PARTIALLY_PAID';
    
    const updatedInvoice = await tx.invoiceMapping.update({
      where: { id: invoice.id },
      data: { status: newStatus }
    });

    return {
      invoice: updatedInvoice,
      payments,
      invoicePayments
    };
  });

  logger.info('Invoice and payments processed successfully', {
    invoiceId: result.invoice.id,
    paymentCount: result.payments.length,
    totalAmount: result.invoice.totalAmount
  });

  return result;
}
```

## Performance Optimization Patterns

### Efficient Relationship Loading

```typescript
// Bad: N+1 query problem
async function getInvoicesWithContactsBad() {
  const invoices = await prisma.invoiceMapping.findMany();
  for (const invoice of invoices) {
    invoice.contact = await prisma.contact.findFirst({
      where: { 
        invoiceAssociations: { 
          some: { invoiceId: invoice.id, isPrimaryContact: true } 
        } 
      }
    });
  }
  return invoices;
}

// Good: Single query with proper includes
async function getInvoicesWithContactsGood() {
  return await prisma.invoiceMapping.findMany({
    include: {
      associations: {
        where: { isPrimaryContact: true },
        include: {
          contact: {
            select: {
              id: true,
              email: true,
              fullName: true,
              phone: true
            }
          }
        }
      },
      lineItems: {
        select: {
          id: true,
          productName: true,
          quantity: true,
          amount: true,
          currency: true
        }
      },
      taxSummary: true
    }
  });
}
```

### Pagination and Filtering

```typescript
interface InvoiceQueryOptions {
  page?: number;
  limit?: number;
  status?: InvoiceStatus[];
  currency?: string;
  dateRange?: { from: Date; to: Date };
  searchTerm?: string;
}

async function getInvoicesWithFilters(options: InvoiceQueryOptions) {
  const page = options.page || 1;
  const limit = Math.min(options.limit || 50, 100); // Max 100 per page
  const skip = (page - 1) * limit;

  const where: Prisma.InvoiceMappingWhereInput = {};

  if (options.status?.length) {
    where.status = { in: options.status };
  }

  if (options.currency) {
    where.OR = [
      { currency: options.currency },
      { detectedCurrency: options.currency }
    ];
  }

  if (options.dateRange) {
    where.createdAt = {
      gte: options.dateRange.from,
      lte: options.dateRange.to
    };
  }

  if (options.searchTerm) {
    where.OR = [
      { clientName: { contains: options.searchTerm, mode: 'insensitive' } },
      { clientEmail: { contains: options.searchTerm, mode: 'insensitive' } },
      { description: { contains: options.searchTerm, mode: 'insensitive' } }
    ];
  }

  const [invoices, total] = await Promise.all([
    prisma.invoiceMapping.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        associations: {
          where: { isPrimaryContact: true },
          include: { contact: true }
        },
        taxSummary: true
      }
    }),
    prisma.invoiceMapping.count({ where })
  ]);

  return {
    data: invoices,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1
    }
  };
}
```

This comprehensive database documentation provides developers with a complete understanding of how the cw_app interacts with the PostgreSQL database, including practical patterns, error handling, and performance optimization techniques used throughout the codebase.