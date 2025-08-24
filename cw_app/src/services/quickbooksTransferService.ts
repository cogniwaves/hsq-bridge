import { logger } from '../utils/logger';
import { prisma } from '../index';
import { EntityType } from '@prisma/client';
import { getQuickBooksClient, QuickBooksClient, QuickBooksCustomer, QuickBooksItem, QuickBooksInvoice } from './quickbooksClient';
import { QuickBooksTransferQueueService, QueueEntry } from './quickbooksTransferQueue';

export interface TransferResult {
  success: boolean;
  quickbooksId?: string;
  error?: string;
  details?: any;
}

export interface BulkTransferResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  results: Array<{
    queueEntryId: string;
    entityType: EntityType;
    success: boolean;
    quickbooksId?: string;
    error?: string;
  }>;
  duration: number;
}

/**
 * Service de transfert réel vers QuickBooks
 * Traite les entrées approuvées de la queue et les transfert vers QuickBooks
 */
export class QuickBooksTransferService {
  private qbClient: QuickBooksClient;
  private queueService: QuickBooksTransferQueueService;

  constructor() {
    this.qbClient = getQuickBooksClient();
    this.queueService = new QuickBooksTransferQueueService();
  }

  /**
   * Traite toutes les entrées approuvées de la queue
   */
  async processApprovedEntries(maxEntries = 50): Promise<BulkTransferResult> {
    const startTime = Date.now();
    logger.info(`Starting bulk transfer of approved queue entries (max: ${maxEntries})`);

    try {
      // Vérifier la connexion QuickBooks
      const isConnected = await this.qbClient.testConnection();
      if (!isConnected) {
        throw new Error('QuickBooks connection failed - check authentication');
      }

      // Récupérer les entrées approuvées
      const approvedEntries = await this.queueService.getApprovedEntries(maxEntries);
      
      if (approvedEntries.length === 0) {
        logger.info('No approved entries found for transfer');
        return {
          totalProcessed: 0,
          successful: 0,
          failed: 0,
          results: [],
          duration: Date.now() - startTime
        };
      }

      const results = [];
      let successful = 0;
      let failed = 0;

      // Traiter chaque entrée
      for (const entry of approvedEntries) {
        try {
          logger.info(`Processing ${entry.entityType} entry ${entry.id}`);
          const result = await this.transferSingleEntry(entry);
          
          if (result.success && result.quickbooksId) {
            await this.queueService.markAsTransferred(entry.id, result.quickbooksId);
            successful++;
          } else {
            await this.queueService.markAsFailed(entry.id, result.error || 'Transfer failed');
            failed++;
          }

          results.push({
            queueEntryId: entry.id,
            entityType: entry.entityType,
            success: result.success,
            quickbooksId: result.quickbooksId,
            error: result.error
          });

          // Délai entre les requêtes pour éviter le rate limiting
          await this.delay(1000);
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown transfer error';
          logger.error(`Failed to process entry ${entry.id}:`, error);
          
          await this.queueService.markAsFailed(entry.id, errorMessage);
          failed++;
          
          results.push({
            queueEntryId: entry.id,
            entityType: entry.entityType,
            success: false,
            error: errorMessage
          });
        }
      }

      const duration = Date.now() - startTime;
      const bulkResult: BulkTransferResult = {
        totalProcessed: approvedEntries.length,
        successful,
        failed,
        results,
        duration
      };

      logger.info(`Bulk transfer completed: ${successful}/${approvedEntries.length} successful in ${duration}ms`);
      return bulkResult;

    } catch (error) {
      logger.error('Bulk transfer failed:', error);
      throw error;
    }
  }

  /**
   * Transfert une entrée spécifique vers QuickBooks
   */
  async transferSingleEntry(entry: QueueEntry): Promise<TransferResult> {
    try {
      switch (entry.entityType) {
        case 'CONTACT':
          return await this.transferContact(entry);
        
        case 'COMPANY':
          return await this.transferCompany(entry);
        
        case 'INVOICE':
          return await this.transferInvoice(entry);
        
        case 'LINE_ITEM':
          return await this.transferLineItem(entry);
        
        default:
          return {
            success: false,
            error: `Unsupported entity type: ${entry.entityType}`
          };
      }
    } catch (error) {
      logger.error(`Transfer failed for ${entry.entityType} ${entry.id}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown transfer error'
      };
    }
  }

  /**
   * Transfert un contact vers QuickBooks comme Customer
   */
  private async transferContact(entry: QueueEntry): Promise<TransferResult> {
    const contactData = entry.entityData;
    
    // Vérifier si le client existe déjà
    const existingCustomers = await this.qbClient.findCustomer(
      contactData.email || contactData.fullName || contactData.firstName
    );
    
    if (existingCustomers.length > 0) {
      logger.info(`Contact already exists in QuickBooks: ${existingCustomers[0].Id}`);
      return {
        success: true,
        quickbooksId: existingCustomers[0].Id,
        details: { existing: true, customer: existingCustomers[0] }
      };
    }

    // Créer le customer QuickBooks
    const qbCustomer: QuickBooksCustomer = {
      name: contactData.fullName || `${contactData.firstName || ''} ${contactData.lastName || ''}`.trim(),
      companyName: contactData.company || undefined,
      primaryEmailAddr: contactData.email ? { address: contactData.email } : undefined,
      primaryPhone: contactData.phone ? { freeFormNumber: contactData.phone } : undefined,
      billAddr: {
        city: contactData.city || undefined,
        country: contactData.country || undefined
      }
    };

    const result = await this.qbClient.createCustomer(qbCustomer);
    
    return {
      success: true,
      quickbooksId: result.id,
      details: { customer: result.customer }
    };
  }

  /**
   * Transfert une entreprise vers QuickBooks comme Customer
   */
  private async transferCompany(entry: QueueEntry): Promise<TransferResult> {
    const companyData = entry.entityData;
    
    // Vérifier si le client existe déjà
    const existingCustomers = await this.qbClient.findCustomer(
      companyData.name || companyData.domain
    );
    
    if (existingCustomers.length > 0) {
      logger.info(`Company already exists in QuickBooks: ${existingCustomers[0].Id}`);
      return {
        success: true,
        quickbooksId: existingCustomers[0].Id,
        details: { existing: true, customer: existingCustomers[0] }
      };
    }

    // Créer le customer QuickBooks
    const qbCustomer: QuickBooksCustomer = {
      name: companyData.name,
      companyName: companyData.name,
      billAddr: {
        city: companyData.city || undefined,
        countrySubDivisionCode: companyData.state || undefined,
        postalCode: companyData.zip || undefined,
        country: companyData.country || undefined
      }
    };

    const result = await this.qbClient.createCustomer(qbCustomer);
    
    return {
      success: true,
      quickbooksId: result.id,
      details: { customer: result.customer }
    };
  }

  /**
   * Transfert une facture vers QuickBooks
   */
  private async transferInvoice(entry: QueueEntry): Promise<TransferResult> {
    const invoiceData = entry.entityData;
    
    // Trouver ou créer le customer dans QuickBooks
    let customerId: string | undefined;
    
    // Chercher par associations
    if (invoiceData.associations && invoiceData.associations.length > 0) {
      const primaryAssociation = invoiceData.associations.find((a: any) => a.isPrimaryContact || a.isPrimaryCompany);
      const association = primaryAssociation || invoiceData.associations[0];
      
      if (association.contact) {
        const existingCustomers = await this.qbClient.findCustomer(
          association.contact.email || association.contact.fullName
        );
        if (existingCustomers.length > 0) {
          customerId = existingCustomers[0].Id;
        } else {
          // Créer le customer
          const customerResult = await this.transferContact({ 
            ...entry, 
            entityData: association.contact,
            entityType: 'CONTACT' 
          });
          if (customerResult.success) {
            customerId = customerResult.quickbooksId;
          }
        }
      } else if (association.company) {
        const existingCustomers = await this.qbClient.findCustomer(association.company.name);
        if (existingCustomers.length > 0) {
          customerId = existingCustomers[0].Id;
        } else {
          // Créer le customer
          const customerResult = await this.transferCompany({ 
            ...entry, 
            entityData: association.company,
            entityType: 'COMPANY' 
          });
          if (customerResult.success) {
            customerId = customerResult.quickbooksId;
          }
        }
      }
    }

    if (!customerId) {
      return {
        success: false,
        error: 'No customer found or created for invoice'
      };
    }

    // Préparer les line items
    const lineItems = [];
    let totalAmount = 0;

    if (invoiceData.lineItems && invoiceData.lineItems.length > 0) {
      for (const lineItem of invoiceData.lineItems) {
        const amount = parseFloat(lineItem.amount || 0);
        totalAmount += amount;
        
        lineItems.push({
          amount: amount,
          detailType: 'SalesItemLineDetail' as const,
          salesItemLineDetail: {
            qty: lineItem.quantity || 1,
            unitPrice: parseFloat(lineItem.unitPrice || amount),
            // Note: Dans un vrai système, vous devriez mapper vers des items QuickBooks existants
          },
          description: lineItem.productName || lineItem.hubspotRawData?.name || 'Service/Product'
        });
      }
    } else {
      // Facture sans line items détaillés
      totalAmount = parseFloat(invoiceData.totalAmount || 0);
      lineItems.push({
        amount: totalAmount,
        detailType: 'SalesItemLineDetail' as const,
        salesItemLineDetail: {
          qty: 1,
          unitPrice: totalAmount
        },
        description: invoiceData.description || 'Service'
      });
    }

    // Créer la facture QuickBooks
    const qbInvoice: QuickBooksInvoice = {
      customerRef: {
        value: customerId
      },
      line: lineItems,
      totalAmt: totalAmount,
      currencyRef: invoiceData.currency ? { value: invoiceData.currency } : undefined,
      dueDate: invoiceData.dueDate ? new Date(invoiceData.dueDate).toISOString().split('T')[0] : undefined,
      invoiceDate: invoiceData.issueDate ? new Date(invoiceData.issueDate).toISOString().split('T')[0] : undefined,
      docNumber: invoiceData.hubspotInvoiceNumber || undefined,
      privateNote: `Imported from HubSpot (ID: ${invoiceData.hubspotInvoiceId || invoiceData.hubspotDealId})`,
      customerMemo: invoiceData.description ? { value: invoiceData.description } : undefined
    };

    const result = await this.qbClient.createInvoice(qbInvoice);
    
    return {
      success: true,
      quickbooksId: result.id,
      details: { invoice: result.invoice }
    };
  }

  /**
   * Transfert un line item vers QuickBooks (généralement fait dans le contexte d'une facture)
   */
  private async transferLineItem(entry: QueueEntry): Promise<TransferResult> {
    const lineItemData = entry.entityData;
    
    // Pour les line items, on crée généralement un Item dans QuickBooks
    // qui peut ensuite être utilisé dans les factures
    
    const qbItem: QuickBooksItem = {
      name: lineItemData.productName || `Item ${lineItemData.hubspotLineItemId}`,
      type: 'Service',
      unitPrice: parseFloat(lineItemData.unitPrice || lineItemData.amount || 0),
      description: lineItemData.productName || 'Service/Product from HubSpot'
    };

    // Vérifier si l'item existe déjà (recherche basique)
    try {
      const result = await this.qbClient.createItem(qbItem);
      
      return {
        success: true,
        quickbooksId: result.id,
        details: { item: result.item }
      };
    } catch (error) {
      // Si l'item existe déjà, QuickBooks retourne une erreur
      if (error instanceof Error && error.message.includes('duplicate') || error.message.includes('already exists')) {
        return {
          success: true,
          quickbooksId: 'existing',
          details: { existing: true }
        };
      }
      throw error;
    }
  }

  /**
   * Obtient les statistiques de transfert
   */
  async getTransferStatistics(): Promise<{
    totalTransferred: number;
    totalFailed: number;
    transfersByEntityType: { [key in EntityType]?: number };
    recentTransfers: number;
    oldestPendingTransfer: Date | null;
  }> {
    // Statistiques depuis la queue
    const transferred = await prisma.quickBooksTransferQueue.count({
      where: { status: 'TRANSFERRED' }
    });

    const failed = await prisma.quickBooksTransferQueue.count({
      where: { status: 'FAILED' }
    });

    // Transferts par type d'entité
    const transfersByType = await prisma.quickBooksTransferQueue.groupBy({
      by: ['entityType'],
      where: { status: 'TRANSFERRED' },
      _count: { id: true }
    });

    const transfersByEntityType: { [key in EntityType]?: number } = {};
    transfersByType.forEach(stat => {
      transfersByEntityType[stat.entityType] = stat._count.id;
    });

    // Transferts récents (dernières 24h)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const recentTransfers = await prisma.quickBooksTransferQueue.count({
      where: {
        status: 'TRANSFERRED',
        transferredAt: {
          gte: oneDayAgo
        }
      }
    });

    // Plus ancien transfert en attente
    const oldestPending = await prisma.quickBooksTransferQueue.findFirst({
      where: { status: 'APPROVED' },
      orderBy: { approvedAt: 'asc' },
      select: { approvedAt: true }
    });

    return {
      totalTransferred: transferred,
      totalFailed: failed,
      transfersByEntityType,
      recentTransfers,
      oldestPendingTransfer: oldestPending?.approvedAt || null
    };
  }

  /**
   * Nettoie les entrées anciennes transférées avec succès
   */
  async cleanupSuccessfulTransfers(olderThanDays = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await prisma.quickBooksTransferQueue.deleteMany({
      where: {
        status: 'TRANSFERRED',
        transferredAt: {
          lt: cutoffDate
        }
      }
    });

    logger.info(`Cleaned up ${result.count} successful transfer entries older than ${olderThanDays} days`);
    return result.count;
  }

  /**
   * Utilitaire pour délai entre requêtes
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Test manuel d'un transfert spécifique
   */
  async testSingleTransfer(queueEntryId: string): Promise<TransferResult> {
    const entry = await prisma.quickBooksTransferQueue.findUnique({
      where: { id: queueEntryId }
    });

    if (!entry) {
      return {
        success: false,
        error: 'Queue entry not found'
      };
    }

    if (entry.status !== 'APPROVED') {
      return {
        success: false,
        error: `Entry status is ${entry.status}, expected APPROVED`
      };
    }

    return await this.transferSingleEntry(entry as QueueEntry);
  }
}