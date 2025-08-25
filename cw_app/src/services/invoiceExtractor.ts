import { PrismaClient, InvoiceStatus } from '@prisma/client';
import { getHubSpotClient, HubSpotInvoiceObject, HubSpotInvoice, SyncResult } from './hubspotClient';
import { logger } from '../utils/logger';
import { ConvertedInvoiceData } from '../types/api';
import { HubSpotContact, HubSpotCompany } from '../types/hubspot';

const prisma = new PrismaClient();

export interface ExtractionStats {
  totalProcessed: number;
  newInvoices: number;
  updatedInvoices: number;
  skippedInvoices: number;
  errors: string[];
  processingTime: number;
  lastSyncTimestamp: Date;
}

export interface InvoiceData {
  hubspotDealId: string;
  hubspotObjectId: string;
  hubspotObjectType: string;
  totalAmount: number;
  currency: string;
  status: InvoiceStatus;
  clientEmail?: string;
  clientName?: string;
  dueDate?: Date;
  issueDate?: Date;
  description?: string;
  
  // Timestamps HubSpot
  hubspotCreatedAt?: Date;
  hubspotModifiedAt?: Date;
  hubspotClosedAt?: Date;
  
  // Timestamps système
  firstSyncAt: Date;
  syncSource: string;
}

class InvoiceExtractor {
  // Extraction initiale complète avec API HubSpot Invoices (recommended)
  async performInitialInvoiceSync(): Promise<ExtractionStats> {
    const startTime = Date.now();
    logger.info('Starting initial sync using HubSpot Invoices API');

    const stats: ExtractionStats = {
      totalProcessed: 0,
      newInvoices: 0,
      updatedInvoices: 0,
      skippedInvoices: 0,
      errors: [],
      processingTime: 0,
      lastSyncTimestamp: new Date()
    };

    try {
      const hubspotClient = getHubSpotClient();
      
      // Test de connexion
      const isConnected = await hubspotClient.testConnection();
      if (!isConnected) {
        throw new Error('Failed to connect to HubSpot API');
      }

      // Extraction de toutes les factures HubSpot
      const hubspotInvoices = await hubspotClient.getAllInvoices();
      logger.info(`Retrieved ${hubspotInvoices.length} invoices from HubSpot Invoices API`);
      stats.totalProcessed = hubspotInvoices.length;

      // Traitement par lots pour optimiser les performances
      const batchSize = 10;
      for (let i = 0; i < hubspotInvoices.length; i += batchSize) {
        const batch = hubspotInvoices.slice(i, i + batchSize);
        
        for (const hubspotInvoice of batch) {
          try {
            const result = await this.processHubSpotInvoice(hubspotInvoice, 'initial');
            if (result === 'created') stats.newInvoices++;
            else if (result === 'updated') stats.updatedInvoices++;
            else stats.skippedInvoices++;
          } catch (error) {
            const errorMsg = `Failed to process invoice ${hubspotInvoice.id}: ${error}`;
            logger.error(errorMsg);
            stats.errors.push(errorMsg);
          }
        }

        // Petite pause entre les lots pour éviter la surcharge
        await this.delay(100);
      }

      stats.processingTime = Date.now() - startTime;
      
      // Mise à jour du timestamp de synchronisation globale
      await this.updateLastSyncTimestamp(stats.lastSyncTimestamp, 'initial-invoices');

      logger.info(`Initial invoice sync completed: ${stats.newInvoices} new, ${stats.updatedInvoices} updated, ${stats.skippedInvoices} skipped, ${stats.errors.length} errors in ${stats.processingTime}ms`);
      
    } catch (error) {
      stats.errors.push(`Initial invoice sync failed: ${error}`);
      logger.error('Initial invoice sync failed:', error);
    }

    return stats;
  }

  // Extraction initiale complète de toutes les factures (fallback avec deals)
  async performInitialSync(): Promise<ExtractionStats> {
    const startTime = Date.now();
    logger.info('Starting initial sync of all HubSpot invoices');

    const stats: ExtractionStats = {
      totalProcessed: 0,
      newInvoices: 0,
      updatedInvoices: 0,
      skippedInvoices: 0,
      errors: [],
      processingTime: 0,
      lastSyncTimestamp: new Date()
    };

    try {
      const hubspotClient = getHubSpotClient();
      
      // Test de connexion
      const isConnected = await hubspotClient.testConnection();
      if (!isConnected) {
        throw new Error('Failed to connect to HubSpot API');
      }

      // Extraction de tous les deals fermés
      const closedDeals = await hubspotClient.getAllClosedDeals();
      logger.info(`Retrieved ${closedDeals.length} closed deals from HubSpot`);

      // Transformation en format facture
      const hubspotInvoices = await hubspotClient.transformDealsToInvoices(closedDeals);
      stats.totalProcessed = hubspotInvoices.length;

      // Traitement par lots pour optimiser les performances
      const batchSize = 10;
      for (let i = 0; i < hubspotInvoices.length; i += batchSize) {
        const batch = hubspotInvoices.slice(i, i + batchSize);
        
        for (const hubspotInvoice of batch) {
          try {
            const result = await this.processInvoice(hubspotInvoice, 'initial');
            if (result === 'created') stats.newInvoices++;
            else if (result === 'updated') stats.updatedInvoices++;
            else stats.skippedInvoices++;
          } catch (error) {
            const errorMsg = `Failed to process invoice ${hubspotInvoice.id}: ${error}`;
            logger.error(errorMsg);
            stats.errors.push(errorMsg);
          }
        }

        // Petite pause entre les lots pour éviter la surcharge
        await this.delay(100);
      }

      stats.processingTime = Date.now() - startTime;
      
      // Mise à jour du timestamp de synchronisation globale
      await this.updateLastSyncTimestamp(stats.lastSyncTimestamp, 'initial');

      logger.info(`Initial sync completed: ${stats.newInvoices} new, ${stats.updatedInvoices} updated, ${stats.skippedInvoices} skipped, ${stats.errors.length} errors in ${stats.processingTime}ms`);
      
    } catch (error) {
      stats.errors.push(`Initial sync failed: ${error}`);
      logger.error('Initial sync failed:', error);
    }

    return stats;
  }

  // Traitement mise à jour via webhook
  async processWebhookUpdate(hubspotObjectId: string, objectType: string = 'deal'): Promise<ExtractionStats> {
    const startTime = Date.now();
    logger.info(`Processing webhook update for ${objectType} ${hubspotObjectId}`);

    const stats: ExtractionStats = {
      totalProcessed: 1,
      newInvoices: 0,
      updatedInvoices: 0,
      skippedInvoices: 0,
      errors: [],
      processingTime: 0,
      lastSyncTimestamp: new Date()
    };

    try {
      const hubspotClient = getHubSpotClient();
      
      // Récupération du deal spécifique
      const deal = await hubspotClient.getDeal(hubspotObjectId);
      
      if (!deal) {
        stats.skippedInvoices++;
        logger.warn(`Deal ${hubspotObjectId} not found or not accessible`);
        return stats;
      }

      // Vérification si c'est un deal fermé (facture)
      const stage = deal.properties.dealstage?.toLowerCase();
      const isClosed = stage?.includes('closed') && stage?.includes('won');
      
      if (!isClosed) {
        stats.skippedInvoices++;
        logger.debug(`Deal ${hubspotObjectId} is not closed won, skipping`);
        return stats;
      }

      // Transformation en facture
      const hubspotInvoices = await hubspotClient.transformDealsToInvoices([deal]);
      
      if (hubspotInvoices.length > 0) {
        const result = await this.processInvoice(hubspotInvoices[0], 'webhook');
        if (result === 'created') stats.newInvoices++;
        else if (result === 'updated') stats.updatedInvoices++;
        else stats.skippedInvoices++;

        // Mise à jour du timestamp de dernier webhook
        await this.updateInvoiceWebhookTimestamp(hubspotObjectId, stats.lastSyncTimestamp);
      }

      stats.processingTime = Date.now() - startTime;
      
      logger.info(`Webhook processing completed for ${hubspotObjectId}: result=${stats.newInvoices > 0 ? 'created' : stats.updatedInvoices > 0 ? 'updated' : 'skipped'}`);

    } catch (error) {
      stats.errors.push(`Webhook processing failed for ${hubspotObjectId}: ${error}`);
      logger.error(`Webhook processing failed for ${hubspotObjectId}:`, error);
    }

    return stats;
  }

  // Vérification périodique pour factures manquées
  async performPeriodicCheck(): Promise<ExtractionStats> {
    const startTime = Date.now();
    logger.info('Starting periodic check for missed invoices');

    const stats: ExtractionStats = {
      totalProcessed: 0,
      newInvoices: 0,
      updatedInvoices: 0,
      skippedInvoices: 0,
      errors: [],
      processingTime: 0,
      lastSyncTimestamp: new Date()
    };

    try {
      // Récupération du timestamp de dernière vérification
      const lastCheck = await this.getLastPeriodicCheckTimestamp();
      const checkSince = lastCheck || new Date(Date.now() - 4 * 60 * 60 * 1000); // 4h par défaut

      logger.info(`Checking for deals modified since ${checkSince.toISOString()}`);

      const hubspotClient = getHubSpotClient();
      
      // Extraction incrémentielle
      const recentDeals = await hubspotClient.getClosedDealsSince(checkSince);
      stats.totalProcessed = recentDeals.length;

      logger.info(`Found ${recentDeals.length} recently modified closed deals`);

      // Transformation et traitement
      const hubspotInvoices = await hubspotClient.transformDealsToInvoices(recentDeals);

      for (const hubspotInvoice of hubspotInvoices) {
        try {
          const result = await this.processInvoice(hubspotInvoice, 'periodic');
          if (result === 'created') stats.newInvoices++;
          else if (result === 'updated') stats.updatedInvoices++;
          else stats.skippedInvoices++;
        } catch (error) {
          const errorMsg = `Failed to process invoice ${hubspotInvoice.id}: ${error}`;
          logger.error(errorMsg);
          stats.errors.push(errorMsg);
        }
      }

      stats.processingTime = Date.now() - startTime;

      // Mise à jour du timestamp de vérification périodique
      await this.updateLastSyncTimestamp(stats.lastSyncTimestamp, 'periodic');

      logger.info(`Periodic check completed: ${stats.newInvoices} new, ${stats.updatedInvoices} updated, ${stats.skippedInvoices} skipped, ${stats.errors.length} errors in ${stats.processingTime}ms`);

    } catch (error) {
      stats.errors.push(`Periodic check failed: ${error}`);
      logger.error('Periodic check failed:', error);
    }

    return stats;
  }

  // Traitement d'une facture HubSpot Invoices API - version simple
  private async processHubSpotInvoiceSimple(hubspotInvoice: HubSpotInvoiceObject, syncSource: string): Promise<'created' | 'updated' | 'skipped'> {
    try {
      // Conversion des données HubSpot Invoice - version simple
      const invoiceData = this.convertHubSpotInvoiceToInvoiceDataSimple(hubspotInvoice, syncSource);

      // Vérification si la facture existe déjà
      const existingInvoice = await prisma.invoiceMapping.findFirst({
        where: {
          OR: [
            { hubspotInvoiceId: hubspotInvoice.id },
            { hubspotObjectId: hubspotInvoice.id }
          ]
        }
      });

      const now = new Date();

      if (existingInvoice) {
        // Mise à jour de la facture existante
        await prisma.invoiceMapping.update({
          where: { id: existingInvoice.id },
          data: {
            ...invoiceData,
            updatedAt: now,
            lastSyncAt: now,
            lastPeriodicCheckAt: syncSource === 'periodic' ? now : existingInvoice.lastPeriodicCheckAt,
            lastWebhookAt: syncSource === 'webhook' ? now : existingInvoice.lastWebhookAt
          }
        });

        logger.debug(`Updated existing invoice ${existingInvoice.id} from HubSpot Invoice ${hubspotInvoice.id}`);
        return 'updated';
      } else {
        // Création d'une nouvelle facture - include tenant_id for database compatibility
        await prisma.invoiceMapping.create({
          data: {
            ...invoiceData,
            tenantId: 'default-tenant', // Required by database schema
            firstSyncAt: now,
            createdAt: now,
            updatedAt: now,
            lastSyncAt: now,
            lastPeriodicCheckAt: syncSource === 'periodic' ? now : undefined,
            lastWebhookAt: syncSource === 'webhook' ? now : undefined
          } as any // Use 'as any' to bypass Prisma type checking since schema is out of sync
        });

        logger.debug(`Created new invoice from HubSpot Invoice ${hubspotInvoice.id}`);
        return 'created';
      }
    } catch (error) {
      logger.error(`Error processing HubSpot invoice ${hubspotInvoice.id}:`, error);
      throw error;
    }
  }

  // Traitement d'une facture HubSpot Invoices API avec données complètes (disabled for now)
  private async processHubSpotInvoice(hubspotInvoice: HubSpotInvoiceObject, syncSource: string): Promise<'created' | 'updated' | 'skipped'> {
    try {
      // Conversion des données HubSpot Invoice
      const invoiceData = this.convertHubSpotInvoiceToInvoiceData(hubspotInvoice, syncSource);

      // Récupération des contacts et companies associés
      const [contactDetails, companyDetails] = await this.getAssociatedData(hubspotInvoice);

      // Vérification si la facture existe déjà
      const existingInvoice = await prisma.invoiceMapping.findFirst({
        where: {
          OR: [
            { hubspotInvoiceId: hubspotInvoice.id },
            { hubspotObjectId: hubspotInvoice.id }
          ]
        },
        include: {
          associations: {
            include: {
              contact: true,
              company: true
            }
          },
          payments: true,
          syncLogs: true,
          lineItems: true,
          taxSummary: true
        }
      });

      const now = new Date();

      if (existingInvoice) {
        // Mise à jour de la facture existante
        const updatedInvoice = await prisma.invoiceMapping.update({
          where: { id: existingInvoice.id },
          data: {
            ...invoiceData,
            updatedAt: now,
            lastSyncAt: now,
            lastPeriodicCheckAt: syncSource === 'periodic' ? now : existingInvoice.lastPeriodicCheckAt,
            lastWebhookAt: syncSource === 'webhook' ? now : existingInvoice.lastWebhookAt
          }
        });

        // Mise à jour des contacts et companies
        await this.updateAssociatedData(updatedInvoice.id, contactDetails, companyDetails);

        logger.debug(`Updated existing invoice ${existingInvoice.id} from HubSpot Invoice ${hubspotInvoice.id}`);
        return 'updated';
      } else {
        // Création d'une nouvelle facture avec transaction
        const result = await prisma.$transaction(async (tx) => {
          const newInvoice = await tx.invoiceMapping.create({
            data: {
              ...invoiceData,
              firstSyncAt: now,
              createdAt: now,
              updatedAt: now,
              lastSyncAt: now,
              lastPeriodicCheckAt: syncSource === 'periodic' ? now : undefined,
              lastWebhookAt: syncSource === 'webhook' ? now : undefined
            }
          });

          // Création des contacts associés
          if (contactDetails.length > 0) {
            await tx.invoiceContact.createMany({
              data: contactDetails.map((contact, index) => ({
                invoiceId: newInvoice.id,
                hubspotContactId: contact.id,
                email: contact.properties.email,
                firstName: contact.properties.firstname,
                lastName: contact.properties.lastname,
                fullName: contact.properties.firstname && contact.properties.lastname 
                  ? `${contact.properties.firstname} ${contact.properties.lastname}`.trim()
                  : contact.properties.firstname || contact.properties.lastname || null,
                company: contact.properties.company,
                isPrimary: index === 0
              }))
            });
          }

          // Création des companies associées
          if (companyDetails.length > 0) {
            await tx.invoiceCompany.createMany({
              data: companyDetails.map((company, index) => ({
                invoiceId: newInvoice.id,
                hubspotCompanyId: company.id,
                name: company.properties.name,
                domain: company.properties.domain,
                isPrimary: index === 0
              }))
            });
          }

          return newInvoice;
        });

        logger.debug(`Created new invoice from HubSpot Invoice ${hubspotInvoice.id} with ${contactDetails.length} contacts and ${companyDetails.length} companies`);
        return 'created';
      }
    } catch (error) {
      logger.error(`Error processing HubSpot invoice ${hubspotInvoice.id}:`, error);
      throw error;
    }
  }

  // Traitement d'une facture individuelle (deals fallback)
  private async processInvoice(hubspotInvoice: HubSpotInvoice, syncSource: string): Promise<'created' | 'updated' | 'skipped'> {
    try {
      // Conversion des données HubSpot
      const invoiceData = this.convertHubSpotToInvoiceData(hubspotInvoice, syncSource);

      // Vérification si la facture existe déjà
      const existingInvoice = await prisma.invoiceMapping.findFirst({
        where: {
          OR: [
            { hubspotDealId: invoiceData.hubspotDealId },
            { hubspotObjectId: invoiceData.hubspotObjectId }
          ]
        }
      });

      const now = new Date();

      if (existingInvoice) {
        // Mise à jour de la facture existante
        await prisma.invoiceMapping.update({
          where: { id: existingInvoice.id },
          data: {
            ...invoiceData,
            updatedAt: now,
            lastSyncAt: now,
            lastPeriodicCheckAt: syncSource === 'periodic' ? now : existingInvoice.lastPeriodicCheckAt,
            lastWebhookAt: syncSource === 'webhook' ? now : existingInvoice.lastWebhookAt
          }
        });

        logger.debug(`Updated existing invoice ${existingInvoice.id} from HubSpot ${hubspotInvoice.id}`);
        return 'updated';
      } else {
        // Création d'une nouvelle facture - include tenant_id for database compatibility
        await prisma.invoiceMapping.create({
          data: {
            ...invoiceData,
            tenantId: 'default-tenant', // Required by database schema
            firstSyncAt: now,
            createdAt: now,
            updatedAt: now,
            lastSyncAt: now,
            lastPeriodicCheckAt: syncSource === 'periodic' ? now : undefined,
            lastWebhookAt: syncSource === 'webhook' ? now : undefined
          } as any // Use 'as any' to bypass Prisma type checking since schema is out of sync
        });

        logger.debug(`Created new invoice from HubSpot ${hubspotInvoice.id}`);
        return 'created';
      }
    } catch (error) {
      logger.error(`Error processing invoice ${hubspotInvoice.id}:`, error);
      throw error;
    }
  }

  // Récupération des données associées (contacts et companies)
  private async getAssociatedData(hubspotInvoice: HubSpotInvoiceObject): Promise<[any[], any[]]> {
    const contactDetails = [];
    const companyDetails = [];
    
    // Récupération des contacts associés
    if (hubspotInvoice.associations?.contacts?.results?.length) {
      try {
        const hubspotClient = getHubSpotClient();
        const contacts = await Promise.all(
          hubspotInvoice.associations.contacts.results.slice(0, 5).map(contact => 
            hubspotClient.getContact(contact.id)
          )
        );
        contactDetails.push(...contacts.filter(Boolean));
        logger.debug(`Retrieved ${contacts.filter(Boolean).length} contact details for invoice ${hubspotInvoice.id}`);
      } catch (error) {
        logger.warn(`Could not fetch contact details for invoice ${hubspotInvoice.id}:`, error.message);
      }
    }

    // Récupération des companies associées
    if (hubspotInvoice.associations?.companies?.results?.length) {
      try {
        const hubspotClient = getHubSpotClient();
        const companies = await Promise.all(
          hubspotInvoice.associations.companies.results.slice(0, 5).map(company => 
            hubspotClient.getCompany(company.id)
          )
        );
        companyDetails.push(...companies.filter(Boolean));
        logger.debug(`Retrieved ${companies.filter(Boolean).length} company details for invoice ${hubspotInvoice.id}`);
      } catch (error) {
        logger.warn(`Could not fetch company details for invoice ${hubspotInvoice.id}:`, error.message);
      }
    }

    return [contactDetails, companyDetails];
  }

  // Mise à jour des données associées
  private async updateAssociatedData(invoiceId: string, contactDetails: HubSpotContact[], companyDetails: HubSpotCompany[]): Promise<void> {
    // Suppression des anciennes associations
    await prisma.invoiceContact.deleteMany({
      where: { invoiceId }
    });
    await prisma.invoiceCompany.deleteMany({
      where: { invoiceId }
    });

    // Création des nouvelles associations de contacts
    if (contactDetails.length > 0) {
      await prisma.invoiceContact.createMany({
        data: contactDetails.map((contact, index) => ({
          invoiceId,
          hubspotContactId: contact.id,
          email: contact.properties.email,
          firstName: contact.properties.firstname,
          lastName: contact.properties.lastname,
          fullName: contact.properties.firstname && contact.properties.lastname 
            ? `${contact.properties.firstname} ${contact.properties.lastname}`.trim()
            : contact.properties.firstname || contact.properties.lastname || null,
          company: contact.properties.company,
          isPrimary: index === 0
        }))
      });
    }

    // Création des nouvelles associations de companies
    if (companyDetails.length > 0) {
      await prisma.invoiceCompany.createMany({
        data: companyDetails.map((company, index) => ({
          invoiceId,
          hubspotCompanyId: company.id,
          name: company.properties.name,
          domain: company.properties.domain,
          isPrimary: index === 0
        }))
      });
    }
  }

  // Conversion HubSpot Invoice → InvoiceData (simple version)
  private convertHubSpotInvoiceToInvoiceDataSimple(hubspotInvoice: HubSpotInvoiceObject, syncSource: string): ConvertedInvoiceData {
    const props = hubspotInvoice.properties;
    
    // Conversion du montant - HubSpot uses hs_subtotal instead of hs_invoice_amount
    const amount = props.hs_subtotal ? parseFloat(props.hs_subtotal) : 
                   props.hs_invoice_amount ? parseFloat(props.hs_invoice_amount) : 
                   props.amount ? parseFloat(props.amount) : 0;
    
    // Détermination du statut basé sur le statut de la facture HubSpot
    const status = this.determineInvoiceStatusFromHubSpot(props.hs_invoice_status);
    
    // Conversion des dates
    const createdAt = props.createdate ? new Date(props.createdate) : undefined;
    const modifiedAt = props.hs_lastmodifieddate ? new Date(props.hs_lastmodifieddate) : undefined;
    const invoiceDate = props.hs_invoice_date ? new Date(props.hs_invoice_date) : undefined;
    const dueDate = props.hs_invoice_due_date ? new Date(props.hs_invoice_due_date) : undefined;

    return {
      hubspotInvoiceId: hubspotInvoice.id,
      hubspotObjectId: hubspotInvoice.id,
      hubspotObjectType: 'invoice',
      totalAmount: amount,
      currency: props.hs_invoice_currency || 'USD',
      status,
      clientEmail: undefined, // Will be populated from associations later
      clientName: undefined, // Will be populated from associations later  
      dueDate,
      issueDate: invoiceDate,
      description: props.hs_invoice_description || props.hs_invoice_number,
      
      // Timestamps HubSpot
      hubspotCreatedAt: createdAt,
      hubspotModifiedAt: modifiedAt,
      hubspotClosedAt: undefined,
      
      // Timestamps système
      firstSyncAt: new Date(),
      syncSource
    };
  }

  // Conversion HubSpot Invoice → InvoiceData (full version - disabled for now)
  private convertHubSpotInvoiceToInvoiceData(hubspotInvoice: HubSpotInvoiceObject, syncSource: string): ConvertedInvoiceData {
    const props = hubspotInvoice.properties;
    
    // Conversion du montant - HubSpot uses hs_subtotal instead of hs_invoice_amount
    const amount = props.hs_subtotal ? parseFloat(props.hs_subtotal) : 
                   props.hs_invoice_amount ? parseFloat(props.hs_invoice_amount) : 
                   props.amount ? parseFloat(props.amount) : 0;
    
    // Balance due
    const balanceDue = props.hs_balance_due ? parseFloat(props.hs_balance_due) : 0;
    
    // Détermination du statut basé sur le statut de la facture HubSpot
    const status = this.determineInvoiceStatusFromHubSpot(props.hs_invoice_status);
    
    // Conversion des dates
    const createdAt = props.createdate ? new Date(props.createdate) : undefined;
    const modifiedAt = props.hs_lastmodifieddate ? new Date(props.hs_lastmodifieddate) : undefined;
    const invoiceDate = props.hs_invoice_date ? new Date(props.hs_invoice_date) : undefined;
    const dueDate = props.hs_invoice_due_date ? new Date(props.hs_invoice_due_date) : undefined;

    return {
      hubspotInvoiceId: hubspotInvoice.id,
      hubspotObjectId: hubspotInvoice.id,
      hubspotObjectType: 'invoice',
      totalAmount: amount,
      subtotal: amount, // Store subtotal separately
      balanceDue: balanceDue,
      currency: props.hs_invoice_currency || 'USD',
      status,
      clientEmail: undefined, // Will be populated from associations
      clientName: undefined, // Will be populated from associations  
      dueDate,
      issueDate: invoiceDate,
      description: props.hs_invoice_description || props.hs_invoice_number,
      hubspotInvoiceNumber: props.hs_invoice_number,
      
      // Store raw HubSpot data for reference
      hubspotRawData: {
        properties: props,
        associations: hubspotInvoice.associations
      },
      
      // Timestamps HubSpot
      hubspotCreatedAt: createdAt,
      hubspotModifiedAt: modifiedAt,
      hubspotClosedAt: undefined,
      
      // Timestamps système
      firstSyncAt: new Date(),
      syncSource
    };
  }

  // Conversion HubSpot Deal → InvoiceData (fallback)
  private convertHubSpotToInvoiceData(hubspotInvoice: HubSpotInvoice, syncSource: string): InvoiceData {
    const props = hubspotInvoice.properties;
    
    // Conversion du montant
    const amount = props.amount ? parseFloat(props.amount) : 0;
    
    // Détermination du statut basé sur le stage du deal
    const status = this.determineInvoiceStatus(props.dealstage);
    
    // Conversion des dates
    const createdAt = props.createdate ? new Date(parseInt(props.createdate)) : undefined;
    const modifiedAt = props.hs_lastmodifieddate ? new Date(parseInt(props.hs_lastmodifieddate)) : undefined;
    const closedAt = props.closedate ? new Date(props.closedate) : undefined;

    return {
      hubspotDealId: hubspotInvoice.id,
      hubspotObjectId: hubspotInvoice.id,
      hubspotObjectType: hubspotInvoice.objectType,
      totalAmount: amount,
      currency: props.deal_currency_code || 'USD',
      status,
      clientEmail: props.primaryContactEmail,
      clientName: props.primaryContactName || props.primaryCompanyName,
      dueDate: closedAt ? new Date(closedAt.getTime() + 30 * 24 * 60 * 60 * 1000) : undefined, // +30 jours
      issueDate: closedAt,
      description: props.dealname || props.description,
      
      // Timestamps HubSpot
      hubspotCreatedAt: createdAt,
      hubspotModifiedAt: modifiedAt,
      hubspotClosedAt: closedAt,
      
      // Timestamps système
      firstSyncAt: new Date(),
      syncSource
    };
  }

  // Détermination du statut de facture basé sur le statut HubSpot Invoice
  private determineInvoiceStatusFromHubSpot(invoiceStatus?: string): InvoiceStatus {
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

  // Détermination du statut de facture basé sur le stage HubSpot Deal (fallback)
  private determineInvoiceStatus(dealstage?: string): InvoiceStatus {
    if (!dealstage) return InvoiceStatus.DRAFT;
    
    const stage = dealstage.toLowerCase();
    
    if (stage.includes('closed') && stage.includes('won')) {
      return InvoiceStatus.SENT; // Les deals fermés gagnés deviennent des factures envoyées
    }
    
    return InvoiceStatus.DRAFT;
  }

  // Utilitaires pour la gestion des timestamps
  private async updateLastSyncTimestamp(timestamp: Date, syncType: string): Promise<void> {
    // Ici on pourrait stocker dans une table de configuration globale
    // Pour l'instant on utilise les logs
    logger.info(`Last sync timestamp updated: ${timestamp.toISOString()} (${syncType})`);
  }

  private async updateInvoiceWebhookTimestamp(hubspotObjectId: string, timestamp: Date): Promise<void> {
    await prisma.invoiceMapping.updateMany({
      where: {
        OR: [
          { hubspotDealId: hubspotObjectId },
          { hubspotObjectId: hubspotObjectId }
        ]
      },
      data: {
        lastWebhookAt: timestamp
      }
    });
  }

  private async getLastPeriodicCheckTimestamp(): Promise<Date | null> {
    const lastInvoice = await prisma.invoiceMapping.findFirst({
      where: {
        lastPeriodicCheckAt: { not: null }
      },
      orderBy: {
        lastPeriodicCheckAt: 'desc'
      },
      select: {
        lastPeriodicCheckAt: true
      }
    });

    return lastInvoice?.lastPeriodicCheckAt || null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Met à jour une facture existante avec les nouvelles données HubSpot
   */
  async updateExistingInvoice(hubspotInvoice: HubSpotInvoiceObject, existingInvoice: any): Promise<void> {
    try {
      const invoiceData = this.convertHubSpotInvoiceToInvoiceDataSimple(hubspotInvoice, 'incremental');
      const now = new Date();

      await prisma.invoiceMapping.update({
        where: { id: existingInvoice.id },
        data: {
          ...invoiceData,
          updatedAt: now,
          lastSyncAt: now,
          lastPeriodicCheckAt: now
        }
      });

      logger.debug(`Updated existing invoice ${existingInvoice.id} from HubSpot Invoice ${hubspotInvoice.id}`);
    } catch (error) {
      logger.error(`Failed to update existing invoice ${existingInvoice.id}:`, error);
      throw error;
    }
  }

  /**
   * Traite et stocke une nouvelle facture HubSpot
   */
  async processAndStoreInvoice(hubspotInvoice: HubSpotInvoiceObject): Promise<void> {
    try {
      const invoiceData = this.convertHubSpotInvoiceToInvoiceDataSimple(hubspotInvoice, 'incremental');
      const now = new Date();

      await prisma.invoiceMapping.create({
        data: {
          ...invoiceData,
          tenantId: 'default-tenant', // Required by database schema
          firstSyncAt: now,
          createdAt: now,
          updatedAt: now,
          lastSyncAt: now,
          lastPeriodicCheckAt: now
        } as any // Use 'as any' to bypass Prisma type checking since schema is out of sync
      });

      logger.debug(`Created new invoice from HubSpot Invoice ${hubspotInvoice.id}`);
    } catch (error) {
      logger.error(`Failed to create new invoice for HubSpot Invoice ${hubspotInvoice.id}:`, error);
      throw error;
    }
  }

  // Méthode de nettoyage
  async cleanup(): Promise<void> {
    await prisma.$disconnect();
  }
}

// Instance singleton
let invoiceExtractor: InvoiceExtractor | null = null;

export function getInvoiceExtractor(): InvoiceExtractor {
  if (!invoiceExtractor) {
    invoiceExtractor = new InvoiceExtractor();
  }
  return invoiceExtractor;
}

export { InvoiceExtractor };