import { PrismaClient, InvoiceStatus } from '@prisma/client';
import { getHubSpotClient, HubSpotInvoiceObject } from './hubspotClient';
import { getContactService } from './contactService';
import { getCompanyService } from './companyService';
import { logger } from '../utils/logger';
import { ConvertedInvoiceData } from '../types/api';

const prisma = new PrismaClient();

export interface NormalizedExtractionStats {
  totalProcessed: number;
  newInvoices: number;
  updatedInvoices: number;
  skippedInvoices: number;
  newContacts: number;
  updatedContacts: number;
  newCompanies: number;
  updatedCompanies: number;
  errors: string[];
  processingTime: number;
  lastSyncTimestamp: Date;
}

export class NormalizedInvoiceExtractor {
  private contactService = getContactService();
  private companyService = getCompanyService();

  // Main extraction method with normalized approach
  async performNormalizedExtraction(): Promise<NormalizedExtractionStats> {
    const startTime = Date.now();
    logger.info('Starting normalized invoice extraction from HubSpot');

    const stats: NormalizedExtractionStats = {
      totalProcessed: 0,
      newInvoices: 0,
      updatedInvoices: 0,
      skippedInvoices: 0,
      newContacts: 0,
      updatedContacts: 0,
      newCompanies: 0,
      updatedCompanies: 0,
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
      const batchSize = 10;
      for (let i = 0; i < hubspotInvoices.length; i += batchSize) {
        const batch = hubspotInvoices.slice(i, i + batchSize);
        
        for (const hubspotInvoice of batch) {
          try {
            const result = await this.processNormalizedInvoice(hubspotInvoice, stats);
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
        await this.delay(100);
        
        // Log progress every 100 invoices
        if ((i + batchSize) % 100 === 0) {
          logger.info(`Processed ${Math.min(i + batchSize, hubspotInvoices.length)}/${hubspotInvoices.length} invoices`);
        }
      }

      stats.processingTime = Date.now() - startTime;
      
      logger.info(`Normalized extraction completed: ${stats.newInvoices} new invoices, ${stats.updatedInvoices} updated, ${stats.newContacts} new contacts, ${stats.newCompanies} new companies in ${stats.processingTime}ms`);
      
    } catch (error) {
      stats.errors.push(`Normalized extraction failed: ${error}`);
      logger.error('Normalized extraction failed:', error);
    }

    return stats;
  }

  // Process a single invoice with normalized approach
  private async processNormalizedInvoice(hubspotInvoice: HubSpotInvoiceObject, stats: NormalizedExtractionStats): Promise<'created' | 'updated' | 'skipped'> {
    try {
      // Convert HubSpot invoice to invoice data
      const invoiceData = this.convertHubSpotInvoiceToInvoiceData(hubspotInvoice);

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
        // Update existing invoice
        await prisma.invoiceMapping.update({
          where: { id: existingInvoice.id },
          data: {
            ...invoiceData,
            updatedAt: now,
            lastSyncAt: now
          }
        });
        invoiceId = existingInvoice.id;
        logger.debug(`Updated existing invoice ${existingInvoice.id}`);
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

      // Process associations (contacts and companies)
      await this.processInvoiceAssociations(invoiceId, hubspotInvoice, stats);

      return existingInvoice ? 'updated' : 'created';
    } catch (error) {
      logger.error(`Error processing normalized invoice ${hubspotInvoice.id}:`, error);
      throw error;
    }
  }

  // Process invoice associations with normalized tables
  private async processInvoiceAssociations(invoiceId: string, hubspotInvoice: HubSpotInvoiceObject, stats: NormalizedExtractionStats): Promise<void> {
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

  // Convert HubSpot invoice to invoice data
  private convertHubSpotInvoiceToInvoiceData(hubspotInvoice: HubSpotInvoiceObject): ConvertedInvoiceData {
    const props = hubspotInvoice.properties;
    
    // Amount conversion - HubSpot uses hs_subtotal
    const amount = props.hs_subtotal ? parseFloat(props.hs_subtotal) : 
                   props.hs_invoice_amount ? parseFloat(props.hs_invoice_amount) : 0;
    
    // Balance due
    const balanceDue = props.hs_balance_due ? parseFloat(props.hs_balance_due) : 0;
    
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
      currency: props.hs_invoice_currency || 'USD',
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
      syncSource: 'normalized-extraction'
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
let normalizedInvoiceExtractor: NormalizedInvoiceExtractor | null = null;

export function getNormalizedInvoiceExtractor(): NormalizedInvoiceExtractor {
  if (!normalizedInvoiceExtractor) {
    normalizedInvoiceExtractor = new NormalizedInvoiceExtractor();
  }
  return normalizedInvoiceExtractor;
}