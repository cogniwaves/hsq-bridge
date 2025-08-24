import { PrismaClient, InvoiceStatus } from '@prisma/client';
import { getHubSpotClient, HubSpotInvoiceObject, HubSpotLineItem } from './hubspotClient';
import { getContactService } from './contactService';
import { getCompanyService } from './companyService';
import { logger } from '../utils/logger';
import { EnhancedInvoiceData, ConvertedLineItemData } from '../types/api';

const prisma = new PrismaClient();

export interface EnhancedExtractionStats {
  totalProcessed: number;
  newInvoices: number;
  updatedInvoices: number;
  skippedInvoices: number;
  newContacts: number;
  updatedContacts: number;
  newCompanies: number;
  updatedCompanies: number;
  newLineItems: number;
  updatedLineItems: number;
  taxSummariesCreated: number;
  currenciesDetected: Record<string, number>;
  errors: string[];
  processingTime: number;
  lastSyncTimestamp: Date;
}

export class EnhancedInvoiceExtractor {
  private contactService = getContactService();
  private companyService = getCompanyService();

  // Main extraction method with line items and tax support
  async performEnhancedExtraction(): Promise<EnhancedExtractionStats> {
    const startTime = Date.now();
    logger.info('Starting enhanced invoice extraction with line items and tax support');

    const stats: EnhancedExtractionStats = {
      totalProcessed: 0,
      newInvoices: 0,
      updatedInvoices: 0,
      skippedInvoices: 0,
      newContacts: 0,
      updatedContacts: 0,
      newCompanies: 0,
      updatedCompanies: 0,
      newLineItems: 0,
      updatedLineItems: 0,
      taxSummariesCreated: 0,
      currenciesDetected: {},
      errors: [],
      processingTime: 0,
      lastSyncTimestamp: new Date()
    };

    try {
      const hubspotClient = getHubSpotClient();
      
      // Test connection
      const isConnected = await hubspotClient.testConnection();
      if (!isConnected) {
        throw new Error('Failed to connect to HubSpot API');
      }

      // Get all invoices from HubSpot
      const hubspotInvoices = await hubspotClient.getAllInvoices();
      logger.info(`Retrieved ${hubspotInvoices.length} invoices from HubSpot`);
      stats.totalProcessed = hubspotInvoices.length;

      // Process invoices in batches
      const batchSize = 5; // Smaller batches for line items processing
      for (let i = 0; i < hubspotInvoices.length; i += batchSize) {
        const batch = hubspotInvoices.slice(i, i + batchSize);
        
        for (const hubspotInvoice of batch) {
          try {
            const result = await this.processEnhancedInvoice(hubspotInvoice, stats);
            if (result === 'created') stats.newInvoices++;
            else if (result === 'updated') stats.updatedInvoices++;
            else stats.skippedInvoices++;
          } catch (error) {
            const errorMsg = `Failed to process invoice ${hubspotInvoice.id}: ${error}`;
            logger.error(errorMsg);
            stats.errors.push(errorMsg);
          }
        }

        // Small pause between batches
        await this.delay(200);
        
        // Log progress every 50 invoices
        if ((i + batchSize) % 50 === 0) {
          logger.info(`Processed ${Math.min(i + batchSize, hubspotInvoices.length)}/${hubspotInvoices.length} invoices`);
        }
      }

      stats.processingTime = Date.now() - startTime;
      
      logger.info(`Enhanced extraction completed: ${stats.newInvoices} new invoices, ${stats.newLineItems} line items, ${stats.taxSummariesCreated} tax summaries in ${stats.processingTime}ms`);
      
    } catch (error) {
      stats.errors.push(`Enhanced extraction failed: ${error}`);
      logger.error('Enhanced extraction failed:', error);
    }

    return stats;
  }

  // Process a single invoice with line items and tax details
  private async processEnhancedInvoice(hubspotInvoice: HubSpotInvoiceObject, stats: EnhancedExtractionStats): Promise<'created' | 'updated' | 'skipped'> {
    try {
      // Get line items for this invoice
      const hubspotClient = getHubSpotClient();
      const lineItems = await hubspotClient.getLineItemsForInvoice(hubspotInvoice.id);

      // Convert HubSpot invoice to invoice data with enhanced fields
      const invoiceData = this.convertHubSpotInvoiceToEnhancedData(hubspotInvoice, lineItems);

      // Check if invoice already exists
      const existingInvoice = await prisma.invoiceMapping.findFirst({
        where: {
          OR: [
            { hubspotInvoiceId: hubspotInvoice.id },
            { hubspotObjectId: hubspotInvoice.id }
          ]
        }
      });

      const now = new Date();
      let invoiceId: string;

      if (existingInvoice) {
        // Update existing invoice with enhanced data
        await prisma.invoiceMapping.update({
          where: { id: existingInvoice.id },
          data: {
            ...invoiceData,
            updatedAt: now,
            lastSyncAt: now
          }
        });
        invoiceId = existingInvoice.id;
        logger.debug(`Updated existing invoice ${existingInvoice.id} with enhanced data`);
      } else {
        // Create new invoice
        const newInvoice = await prisma.invoiceMapping.create({
          data: {
            ...invoiceData,
            firstSyncAt: now,
            createdAt: now,
            updatedAt: now,
            lastSyncAt: now
          }
        });
        invoiceId = newInvoice.id;
        logger.debug(`Created new invoice ${newInvoice.id}`);
      }

      // Process line items
      await this.processLineItems(invoiceId, lineItems, stats);

      // Process associations (contacts and companies)
      await this.processInvoiceAssociations(invoiceId, hubspotInvoice, stats);

      // Create tax summary
      await this.createTaxSummary(invoiceId, lineItems, stats);

      return existingInvoice ? 'updated' : 'created';
    } catch (error) {
      logger.error(`Error processing enhanced invoice ${hubspotInvoice.id}:`, error);
      throw error;
    }
  }

  // Process line items for an invoice
  private async processLineItems(invoiceId: string, lineItems: HubSpotLineItem[], stats: EnhancedExtractionStats): Promise<void> {
    // Clear existing line items
    await prisma.lineItem.deleteMany({
      where: { invoiceId }
    });

    for (const lineItem of lineItems) {
      try {
        const lineItemData = this.convertLineItemToData(lineItem);
        
        await prisma.lineItem.create({
          data: {
            ...lineItemData,
            invoiceId,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        
        stats.newLineItems++;
        
        // Track currency detection
        if (lineItemData.currency) {
          stats.currenciesDetected[lineItemData.currency] = 
            (stats.currenciesDetected[lineItemData.currency] || 0) + 1;
        }
        
      } catch (error) {
        const errorMsg = `Failed to process line item ${lineItem.id}: ${error}`;
        logger.warn(errorMsg);
        stats.errors.push(errorMsg);
      }
    }
  }

  // Create tax summary for an invoice
  private async createTaxSummary(invoiceId: string, lineItems: HubSpotLineItem[], stats: EnhancedExtractionStats): Promise<void> {
    if (lineItems.length === 0) return;

    let subtotalBeforeTax = 0;
    let totalTaxAmount = 0;
    let totalAfterTax = 0;
    let totalDiscountAmount = 0;
    let currency = 'USD'; // default
    const taxBreakdown: Record<string, { rate: number, amount: number }> = {};

    for (const item of lineItems) {
      const props = item.properties;
      
      // Detect currency from first item
      if (props.hs_line_item_currency_code && currency === 'USD') {
        currency = props.hs_line_item_currency_code;
      }
      
      // Calculate amounts
      const preDiscountAmount = props.hs_pre_discount_amount ? parseFloat(props.hs_pre_discount_amount) : 0;
      const amount = props.amount ? parseFloat(props.amount) : 0;
      const taxAmount = props.hs_tax_amount ? parseFloat(props.hs_tax_amount) : 0;
      const postTaxAmount = props.hs_post_tax_amount ? parseFloat(props.hs_post_tax_amount) : 0;
      const discount = props.hs_total_discount ? parseFloat(props.hs_total_discount) : 0;
      
      subtotalBeforeTax += amount;
      totalTaxAmount += taxAmount;
      totalAfterTax += postTaxAmount > 0 ? postTaxAmount : (amount + taxAmount);
      totalDiscountAmount += discount;
      
      // Build tax breakdown by label
      if (props.hs_tax_label && taxAmount > 0) {
        const taxLabel = props.hs_tax_label;
        const taxRate = props.hs_tax_rate ? parseFloat(props.hs_tax_rate) : 0;
        
        if (!taxBreakdown[taxLabel]) {
          taxBreakdown[taxLabel] = { rate: taxRate, amount: 0 };
        }
        taxBreakdown[taxLabel].amount += taxAmount;
      }
    }

    // Upsert tax summary
    await prisma.taxSummary.upsert({
      where: { invoiceId },
      update: {
        currency,
        subtotalBeforeTax,
        totalTaxAmount,
        totalAfterTax,
        totalDiscountAmount,
        taxBreakdown: Object.keys(taxBreakdown).length > 0 ? taxBreakdown : null,
        updatedAt: new Date()
      },
      create: {
        invoiceId,
        currency,
        subtotalBeforeTax,
        totalTaxAmount,
        totalAfterTax,
        totalDiscountAmount,
        taxBreakdown: Object.keys(taxBreakdown).length > 0 ? taxBreakdown : null
      }
    });

    // Update invoice with detected currency and line items count
    await prisma.invoiceMapping.update({
      where: { id: invoiceId },
      data: {
        detectedCurrency: currency,
        lineItemsCount: lineItems.length
      }
    });

    stats.taxSummariesCreated++;
  }

  // Process invoice associations (same as normalized extractor)
  private async processInvoiceAssociations(invoiceId: string, hubspotInvoice: HubSpotInvoiceObject, stats: EnhancedExtractionStats): Promise<void> {
    // Clear existing associations
    await prisma.invoiceAssociation.deleteMany({
      where: { invoiceId }
    });

    const associations: Array<{
      contactId?: string;
      companyId?: string;
      isPrimaryContact: boolean;
      isPrimaryCompany: boolean;
    }> = [];

    // Process contacts
    if (hubspotInvoice.associations?.contacts?.results?.length) {
      for (let i = 0; i < hubspotInvoice.associations.contacts.results.length; i++) {
        const contact = hubspotInvoice.associations.contacts.results[i];
        try {
          // Check if contact exists in our database
          const existingContact = await this.contactService.getContactByHubSpotId(contact.id);
          let contactId: string;

          if (existingContact) {
            contactId = existingContact.id;
            stats.updatedContacts++;
          } else {
            // Fetch and create new contact
            const newContactId = await this.contactService.fetchAndUpsertContact(contact.id);
            if (newContactId) {
              contactId = newContactId;
              stats.newContacts++;
            } else {
              continue; // Skip if contact couldn't be fetched
            }
          }

          associations.push({
            contactId,
            isPrimaryContact: i === 0,
            isPrimaryCompany: false
          });
        } catch (error) {
          logger.warn(`Failed to process contact ${contact.id}:`, error);
        }
      }
    }

    // Process companies
    if (hubspotInvoice.associations?.companies?.results?.length) {
      for (let i = 0; i < hubspotInvoice.associations.companies.results.length; i++) {
        const company = hubspotInvoice.associations.companies.results[i];
        try {
          // Check if company exists in our database
          const existingCompany = await this.companyService.getCompanyByHubSpotId(company.id);
          let companyId: string;

          if (existingCompany) {
            companyId = existingCompany.id;
            stats.updatedCompanies++;
          } else {
            // Fetch and create new company
            const newCompanyId = await this.companyService.fetchAndUpsertCompany(company.id);
            if (newCompanyId) {
              companyId = newCompanyId;
              stats.newCompanies++;
            } else {
              continue; // Skip if company couldn't be fetched
            }
          }

          associations.push({
            companyId,
            isPrimaryContact: false,
            isPrimaryCompany: i === 0
          });
        } catch (error) {
          logger.warn(`Failed to process company ${company.id}:`, error);
        }
      }
    }

    // Create all associations
    if (associations.length > 0) {
      await prisma.invoiceAssociation.createMany({
        data: associations.map(assoc => ({
          invoiceId,
          ...assoc
        }))
      });
    }
  }

  // Convert HubSpot invoice with enhanced data
  private convertHubSpotInvoiceToEnhancedData(hubspotInvoice: HubSpotInvoiceObject, lineItems: HubSpotLineItem[]): EnhancedInvoiceData {
    const props = hubspotInvoice.properties;
    
    // Amount conversion - HubSpot uses hs_subtotal
    const amount = props.hs_subtotal ? parseFloat(props.hs_subtotal) : 
                   props.hs_invoice_amount ? parseFloat(props.hs_invoice_amount) : 0;
    
    // Balance due
    const balanceDue = props.hs_balance_due ? parseFloat(props.hs_balance_due) : 0;
    
    // Detect currency from line items
    let detectedCurrency = props.hs_invoice_currency;
    if (!detectedCurrency && lineItems.length > 0) {
      detectedCurrency = lineItems[0].properties.hs_line_item_currency_code;
    }
    
    // Status conversion
    const status = this.determineInvoiceStatus(props.hs_invoice_status);
    
    // Date conversions
    const createdAt = props.hs_createdate ? new Date(props.hs_createdate) : undefined;
    const modifiedAt = props.hs_lastmodifieddate ? new Date(props.hs_lastmodifieddate) : undefined;
    const invoiceDate = props.hs_invoice_date ? new Date(props.hs_invoice_date) : undefined;
    const dueDate = props.hs_invoice_due_date ? new Date(props.hs_invoice_due_date) : undefined;

    return {
      hubspotInvoiceId: hubspotInvoice.id,
      hubspotObjectId: hubspotInvoice.id,
      hubspotObjectType: 'invoice',
      totalAmount: amount,
      subtotal: amount,
      balanceDue: balanceDue,
      currency: detectedCurrency || 'USD',
      detectedCurrency: detectedCurrency,
      lineItemsCount: lineItems.length,
      status,
      dueDate,
      issueDate: invoiceDate,
      description: props.hs_invoice_description || props.hs_invoice_number,
      hubspotInvoiceNumber: props.hs_invoice_number,
      
      // Store raw HubSpot data
      hubspotRawData: {
        properties: props,
        associations: hubspotInvoice.associations
      },
      
      // HubSpot timestamps
      hubspotCreatedAt: createdAt,
      hubspotModifiedAt: modifiedAt,
      
      // System metadata
      syncSource: 'enhanced-extraction'
    };
  }

  // Convert line item to database format
  private convertLineItemToData(lineItem: HubSpotLineItem): ConvertedLineItemData {
    const props = lineItem.properties;
    
    return {
      hubspotLineItemId: lineItem.id,
      
      // Product Information
      productName: props.name,
      hubspotProductId: props.hs_product_id,
      sku: props.hs_sku,
      
      // Pricing Information
      quantity: props.quantity ? parseInt(props.quantity) : 1,
      unitPrice: props.price ? parseFloat(props.price) : 0,
      amount: props.amount ? parseFloat(props.amount) : 0,
      currency: props.hs_line_item_currency_code,
      
      // Discount Information
      discountAmount: props.discount ? parseFloat(props.discount) : null,
      discountPercentage: props.hs_discount_percentage ? parseFloat(props.hs_discount_percentage) : null,
      preDiscountAmount: props.hs_pre_discount_amount ? parseFloat(props.hs_pre_discount_amount) : null,
      totalDiscount: props.hs_total_discount ? parseFloat(props.hs_total_discount) : null,
      
      // Tax Information
      taxAmount: props.hs_tax_amount ? parseFloat(props.hs_tax_amount) : null,
      taxRate: props.hs_tax_rate ? parseFloat(props.hs_tax_rate) : null,
      taxLabel: props.hs_tax_label,
      taxCategory: props.hs_tax_category,
      postTaxAmount: props.hs_post_tax_amount ? parseFloat(props.hs_post_tax_amount) : null,
      externalTaxRateId: props.hs_external_tax_rate_id,
      
      // HubSpot Raw Data
      hubspotRawData: {
        properties: props
      },
      
      // HubSpot Timestamps
      hubspotCreatedAt: props.createdate ? new Date(props.createdate) : null,
      hubspotUpdatedAt: props.hs_lastmodifieddate ? new Date(props.hs_lastmodifieddate) : null,
      
      // System timestamp
      lastSyncAt: new Date()
    };
  }

  // Determine invoice status from HubSpot status
  private determineInvoiceStatus(invoiceStatus?: string): InvoiceStatus {
    if (!invoiceStatus) return InvoiceStatus.DRAFT;
    
    const status = invoiceStatus.toLowerCase();
    
    switch (status) {
      case 'paid':
        return InvoiceStatus.PAID;
      case 'open':
      case 'sent':
        return InvoiceStatus.SENT;
      case 'draft':
        return InvoiceStatus.DRAFT;
      case 'voided':
      case 'cancelled':
        return InvoiceStatus.CANCELLED;
      case 'overdue':
        return InvoiceStatus.OVERDUE;
      default:
        return InvoiceStatus.DRAFT;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Cleanup
  async cleanup(): Promise<void> {
    await this.contactService.cleanup();
    await this.companyService.cleanup();
    await prisma.$disconnect();
  }
}

// Singleton instance
let enhancedInvoiceExtractor: EnhancedInvoiceExtractor | null = null;

export function getEnhancedInvoiceExtractor(): EnhancedInvoiceExtractor {
  if (!enhancedInvoiceExtractor) {
    enhancedInvoiceExtractor = new EnhancedInvoiceExtractor();
  }
  return enhancedInvoiceExtractor;
}