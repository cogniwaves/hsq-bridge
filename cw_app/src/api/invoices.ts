import { Router, Request, Response } from 'express';
import { getHubSpotClient } from '../services/hubspotClient';
import { logger } from '../utils/logger';
import { prisma } from '../index';
import { asyncHandler } from '../utils/errorHandler';

// Type definition for invoice with contact information
interface InvoiceWithContacts {
  id: string;
  hubspotInvoiceId: string | null;
  hubspotDealId: string | null;
  totalAmount: number | string | null;
  currency: string | null;
  status: string | null;
  clientEmail: string | null;
  clientName: string | null;
  dueDate: Date | string | null;
  issueDate: Date | string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  hubspotCreatedAt: Date | null;
  hubspotModifiedAt: Date | null;
  contactFullName: string | null;
  contactEmail: string | null;
  contactFirstName: string | null;
  contactLastName: string | null;
  companyName: string | null;
}

export const invoiceRoutes = Router();

// Get invoices that need QuickBooks sync
invoiceRoutes.get('/queue/quickbooks', asyncHandler(async (req: Request, res: Response) => {
  try {
    logger.info('Fetching invoices that need QuickBooks synchronization...');
    
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    
    // Get invoices from database that don't have QuickBooks IDs with contact information
    const invoicesWithContacts = await prisma.$queryRaw`
      SELECT 
        im.id,
        im.hubspot_invoice_id as "hubspotInvoiceId",
        im.hubspot_deal_id as "hubspotDealId", 
        im.total_amount as "totalAmount",
        im.currency,
        im.status,
        im.client_email as "clientEmail",
        im.client_name as "clientName",
        im.due_date as "dueDate",
        im.issue_date as "issueDate",
        im.description,
        im.created_at as "createdAt",
        im.updated_at as "updatedAt",
        im.hubspot_created_at as "hubspotCreatedAt",
        im.hubspot_modified_at as "hubspotModifiedAt",
        c.full_name as "contactFullName",
        c.email as "contactEmail",
        c.first_name as "contactFirstName", 
        c.last_name as "contactLastName",
        comp.name as "companyName"
      FROM invoice_mapping im
      LEFT JOIN invoice_associations ia ON im.id = ia.invoice_id AND ia.is_primary_contact = true
      LEFT JOIN contacts c ON ia.contact_id = c.id
      LEFT JOIN invoice_associations ia2 ON im.id = ia2.invoice_id AND ia2.is_primary_company = true  
      LEFT JOIN companies comp ON ia2.company_id = comp.id
      WHERE im.quickbooks_invoice_id IS NULL 
        AND im.status IN ('SENT', 'PAID', 'PARTIALLY_PAID')
      ORDER BY im.created_at DESC
      LIMIT ${limit}
    `;

    const invoices = invoicesWithContacts as InvoiceWithContacts[];

    const transformedInvoices = invoices.map(invoice => {
      // Determine client name: prioritize company name over contact name
      let clientName = 'Unknown Client';
      let contactName = null;
      let clientEmail = null;
      
      if (invoice.companyName) {
        clientName = String(invoice.companyName);
        // Contact becomes secondary info
        if (invoice.contactFullName) {
          contactName = String(invoice.contactFullName);
        } else if (invoice.contactFirstName || invoice.contactLastName) {
          contactName = `${String(invoice.contactFirstName || '')} ${String(invoice.contactLastName || '')}`.trim();
        }
        clientEmail = invoice.contactEmail ? String(invoice.contactEmail) : null;
      } else if (invoice.contactFullName) {
        clientName = String(invoice.contactFullName);
        clientEmail = invoice.contactEmail ? String(invoice.contactEmail) : null;
      } else if (invoice.contactFirstName || invoice.contactLastName) {
        clientName = `${String(invoice.contactFirstName || '')} ${String(invoice.contactLastName || '')}`.trim();
        clientEmail = invoice.contactEmail ? String(invoice.contactEmail) : null;
      }
      
      return {
        id: String(invoice.id),
        hubspotInvoiceId: invoice.hubspotInvoiceId ? String(invoice.hubspotInvoiceId) : null,
        hubspotDealId: invoice.hubspotDealId ? String(invoice.hubspotDealId) : null,
        totalAmount: invoice.totalAmount ? parseFloat(String(invoice.totalAmount)) : 0,
        currency: invoice.currency ? String(invoice.currency) : null,
        status: invoice.status ? String(invoice.status) : null,
        clientEmail: clientEmail || (invoice.clientEmail ? String(invoice.clientEmail) : null),
        clientName: clientName,
        contactName: contactName, // Add contact name as separate field
        dueDate: invoice.dueDate ? (invoice.dueDate instanceof Date ? invoice.dueDate.toISOString() : String(invoice.dueDate)) : null,
        issueDate: invoice.issueDate ? (invoice.issueDate instanceof Date ? invoice.issueDate.toISOString() : String(invoice.issueDate)) : null,
        description: invoice.description ? String(invoice.description) : null,
        createdAt: invoice.createdAt instanceof Date ? invoice.createdAt.toISOString() : String(invoice.createdAt),
        updatedAt: invoice.updatedAt instanceof Date ? invoice.updatedAt.toISOString() : String(invoice.updatedAt),
        hubspotCreatedAt: invoice.hubspotCreatedAt ? (invoice.hubspotCreatedAt instanceof Date ? invoice.hubspotCreatedAt.toISOString() : String(invoice.hubspotCreatedAt)) : null,
        hubspotModifiedAt: invoice.hubspotModifiedAt ? (invoice.hubspotModifiedAt instanceof Date ? invoice.hubspotModifiedAt.toISOString() : String(invoice.hubspotModifiedAt)) : null,
        quickbooksInvoiceId: null // Explicitly null to indicate needs sync
      };
    });

    logger.info(`Found ${invoices.length} invoices that need QuickBooks synchronization`);

    res.json({
      success: true,
      invoices: transformedInvoices,
      total: invoices.length,
      limit,
      source: 'database',
      message: invoices.length > 0 
        ? `${invoices.length} invoices pending QuickBooks synchronization`
        : 'All invoices are synchronized with QuickBooks',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching invoices for QuickBooks sync:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch invoices for QuickBooks sync',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}));

// Get comprehensive sync status combining invoice queue and transfer queue
invoiceRoutes.get('/sync-status/comprehensive', asyncHandler(async (req: Request, res: Response) => {
  try {
    logger.info('Fetching comprehensive sync status...');
    
    // Get basic invoice sync status (invoices without QuickBooks IDs)
    const invoicesNeedingSync = await prisma.$queryRaw<[{count: bigint | number}]>`
      SELECT COUNT(*) as count
      FROM invoice_mapping 
      WHERE quickbooks_invoice_id IS NULL 
        AND status IN ('SENT', 'PAID', 'PARTIALLY_PAID')
    `;

    const invoicesWithoutQbIds = Number(invoicesNeedingSync[0]?.count || 0);

    // Get transfer queue status
    interface QueueStats {
      total: bigint | number;
      pending_review: bigint | number;
      approved: bigint | number;
      rejected: bigint | number;
      transferred: bigint | number;
      failed: bigint | number;
      invoices: bigint | number;
      line_items: bigint | number;
      contacts: bigint | number;
      companies: bigint | number;
    }

    const transferQueueStats = await prisma.$queryRaw<QueueStats[]>`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'PENDING_REVIEW' THEN 1 END) as pending_review,
        COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'REJECTED' THEN 1 END) as rejected,
        COUNT(CASE WHEN status = 'TRANSFERRED' THEN 1 END) as transferred,
        COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed,
        COUNT(CASE WHEN entity_type = 'INVOICE' THEN 1 END) as invoices,
        COUNT(CASE WHEN entity_type = 'LINE_ITEM' THEN 1 END) as line_items,
        COUNT(CASE WHEN entity_type = 'CONTACT' THEN 1 END) as contacts,
        COUNT(CASE WHEN entity_type = 'COMPANY' THEN 1 END) as companies
      FROM quickbooks_transfer_queue
    `;

    const queueStats = transferQueueStats[0] || {} as QueueStats;
    const totalQueueItems = Number(queueStats.total || 0);
    const pendingReview = Number(queueStats.pending_review || 0);

    // Determine overall sync status
    let overallStatus = 'synced';
    let statusMessage = 'All systems synchronized';
    
    if (invoicesWithoutQbIds > 0) {
      overallStatus = 'invoices_need_sync';
      statusMessage = `${invoicesWithoutQbIds} invoices need QuickBooks synchronization`;
    } else if (pendingReview > 0) {
      overallStatus = 'pending_review';
      statusMessage = `${pendingReview} items pending review for QuickBooks transfer`;
    } else if (totalQueueItems > 0) {
      const approved = Number(queueStats.approved || 0);
      if (approved > 0) {
        overallStatus = 'approved_pending_transfer';
        statusMessage = `${approved} items approved and ready for transfer`;
      }
    }

    res.json({
      success: true,
      syncStatus: {
        overall: overallStatus,
        message: statusMessage,
        invoice_sync: {
          invoices_without_qb_ids: invoicesWithoutQbIds,
          status: invoicesWithoutQbIds > 0 ? 'pending' : 'complete'
        },
        transfer_queue: {
          total_items: totalQueueItems,
          pending_review: pendingReview,
          approved: Number(queueStats.approved || 0),
          rejected: Number(queueStats.rejected || 0),
          transferred: Number(queueStats.transferred || 0),
          failed: Number(queueStats.failed || 0),
          by_entity: {
            invoices: Number(queueStats.invoices || 0),
            line_items: Number(queueStats.line_items || 0),
            contacts: Number(queueStats.contacts || 0),
            companies: Number(queueStats.companies || 0)
          }
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error fetching comprehensive sync status:', error);
    next(error);
  }
}));

// Sync individual invoice to QuickBooks
invoiceRoutes.post('/:id/sync', async (req, res, _next) => {
  const invoiceId = req.params.id;
  
  try {
    logger.info(`Starting QuickBooks sync for invoice ${invoiceId}`);

    // Get invoice details
    const invoice = await prisma.invoiceMapping.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        hubspotInvoiceId: true,
        totalAmount: true,
        currency: true,
        status: true,
        quickbooksInvoiceId: true
      }
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found',
        timestamp: new Date().toISOString()
      });
    }

    if (invoice.quickbooksInvoiceId) {
      return res.status(400).json({
        success: false,
        error: 'Invoice already synced to QuickBooks',
        quickbooksInvoiceId: invoice.quickbooksInvoiceId,
        timestamp: new Date().toISOString()
      });
    }

    // Get detailed invoice information for QuickBooks sync
    const detailedInvoice = await prisma.$queryRaw`
      SELECT 
        im.*,
        c.full_name as "contactFullName",
        c.email as "contactEmail",
        c.first_name as "contactFirstName", 
        c.last_name as "contactLastName",
        c.phone as "contactPhone",
        comp.name as "companyName"
      FROM invoice_mapping im
      LEFT JOIN invoice_associations ia ON im.id = ia.invoice_id AND ia.is_primary_contact = true
      LEFT JOIN contacts c ON ia.contact_id = c.id
      LEFT JOIN invoice_associations ia2 ON im.id = ia2.invoice_id AND ia2.is_primary_company = true  
      LEFT JOIN companies comp ON ia2.company_id = comp.id
      WHERE im.id = ${invoiceId}
      LIMIT 1
    `;

    const invoiceData = detailedInvoice[0];
    if (!invoiceData) {
      return res.status(404).json({
        success: false,
        error: 'Invoice data not found for sync',
        timestamp: new Date().toISOString()
      });
    }

    try {
      // Import QuickBooks service
      const { quickbooksService } = await import('../services/quickbooksService');
      
      if (!quickbooksService.isConfigured()) {
        return res.status(503).json({
          success: false,
          error: 'QuickBooks is not configured. Please set up access tokens.',
          timestamp: new Date().toISOString()
        });
      }

      // Determine customer name (company first, then contact)
      const customerName = invoiceData.companyName || 
                          invoiceData.contactFullName || 
                          `${invoiceData.contactFirstName || ''} ${invoiceData.contactLastName || ''}`.trim() ||
                          'Unknown Customer';
      
      // Get or create customer in QuickBooks
      const qbCustomer = await quickbooksService.getOrCreateCustomer(
        customerName,
        invoiceData.contactEmail,
        invoiceData.contactPhone
      );

      // Get default service item for the invoice line
      const serviceItem = await quickbooksService.getDefaultServiceItem();
      
      // Get available tax codes to ensure compliance
      const taxCodes = await quickbooksService.getTaxCodes();
      logger.info('Available tax codes for mapping:', taxCodes.map(tc => `${tc.Id} - ${tc.Name} (${tc.RatePercent}%)`));

      // Get line items with tax information for this invoice
      const lineItemsData = await prisma.$queryRaw`
        SELECT 
          li.product_name as "productName",
          li.quantity,
          li.unit_price as "unitPrice",
          li.amount,
          li.tax_amount as "taxAmount",
          li.tax_rate as "taxRate",
          li.tax_label as "taxLabel",
          li.post_tax_amount as "postTaxAmount"
        FROM line_items li
        WHERE li.invoice_id = ${invoiceId}
        ORDER BY li.created_at ASC
      `;

      // Function to find appropriate tax code based on rate
      const findTaxCodeForRate = (taxRate: number, taxLabel: string) => {
        logger.info(`Looking for tax code for rate: ${taxRate}%, label: ${taxLabel}`);
        
        // Look for exact rate match first
        const exactMatch = taxCodes.find(tc => {
          const tcRate = parseFloat(tc.RatePercent || 0);
          return Math.abs(tcRate - taxRate) < 0.01; // Allow small floating point differences
        });
        
        if (exactMatch) {
          logger.info(`Found exact tax rate match: ${exactMatch.Id} - ${exactMatch.Name} (${exactMatch.RatePercent}%)`);
          return exactMatch.Id;
        }

        // Look for common Canadian tax codes by name/label
        if (taxLabel && taxLabel.toLowerCase().includes('tps')) {
          // For TPS + TVQ, look for proper GST/QST Quebec tax code first (not adjustment codes)
          const gstQstQcMatch = taxCodes.find(tc => 
            tc.Name && tc.Name.toLowerCase().includes('gst/qst') && 
            tc.Name.toLowerCase().includes('qc') &&
            !tc.Name.toLowerCase().includes('adjustment')
          );
          if (gstQstQcMatch) {
            logger.info(`Found GST/QST QC tax code for TPS + TVQ: ${gstQstQcMatch.Id} - ${gstQstQcMatch.Name}`);
            return gstQstQcMatch.Id;
          }
          
          // Fallback to any GST/QST combined code (excluding adjustments)
          const gstQstMatch = taxCodes.find(tc => 
            tc.Name && (
              (tc.Name.toLowerCase().includes('gst') && tc.Name.toLowerCase().includes('qst')) ||
              tc.Name.toLowerCase().includes('gst/qst')
            ) && !tc.Name.toLowerCase().includes('adjustment')
          );
          if (gstQstMatch) {
            logger.info(`Found GST/QST tax code for TPS + TVQ: ${gstQstMatch.Id} - ${gstQstMatch.Name}`);
            return gstQstMatch.Id;
          }
          
          // Fallback to regular GST if no combined code exists
          const gstMatch = taxCodes.find(tc => 
            tc.Name && (tc.Name.toLowerCase().includes('gst') || tc.Name.toLowerCase().includes('tps')) &&
            !tc.Name.toLowerCase().includes('adjustment')
          );
          if (gstMatch) {
            logger.info(`Found GST tax code as fallback for TPS + TVQ: ${gstMatch.Id} - ${gstMatch.Name}`);
            return gstMatch.Id;
          }
        }

        // Look for any non-exempt tax code as fallback
        const nonExemptTax = taxCodes.find(tc => 
          tc.Name && !tc.Name.toLowerCase().includes('exempt') && 
          parseFloat(tc.RatePercent || 0) > 0
        );
        
        if (nonExemptTax) {
          logger.info(`Using non-exempt tax code as fallback: ${nonExemptTax.Id} - ${nonExemptTax.Name}`);
          return nonExemptTax.Id;
        }

        // Return exempt as last resort
        logger.warn(`No appropriate tax code found for ${taxRate}% ${taxLabel}, using exempt`);
        return "2"; // Exempt
      };

      // Create invoice in QuickBooks with actual line items and tax information
      const totalAmount = parseFloat(invoiceData.total_amount.toString());
      
      // Use first available tax code as fallback
      let defaultTaxCode = "2";  // Default fallback that works
      if (taxCodes.length > 0) {
        defaultTaxCode = taxCodes[0].Id;
        logger.info(`Default tax code available: ${defaultTaxCode} - ${taxCodes[0].Name}`);
      }

      // Create line items from HubSpot data
      let qbLineItems = [];
      
      if (lineItemsData.length > 0) {
        // Use actual line items from HubSpot
        qbLineItems = lineItemsData.map((item, index) => {
          const lineAmount = item.amount ? parseFloat(item.amount.toString()) : 0;
          const quantity = item.quantity || 1;
          const taxRate = item.taxRate ? parseFloat(item.taxRate.toString()) : 0;
          const taxAmount = item.taxAmount ? parseFloat(item.taxAmount.toString()) : 0;
          const taxLabel = item.taxLabel || '';
          
          // Calculate unit price to ensure Amount = UnitPrice * Qty
          const unitPrice = quantity > 0 ? lineAmount / quantity : lineAmount;
          
          // Find appropriate tax code for this line item
          const taxCodeId = taxRate > 0 ? findTaxCodeForRate(taxRate, taxLabel) : defaultTaxCode;
          
          const lineItem = {
            Amount: lineAmount,
            DetailType: 'SalesItemLineDetail' as const,
            SalesItemLineDetail: {
              ItemRef: {
                value: serviceItem.value,
                name: serviceItem.name
              },
              TaxCodeRef: {
                value: taxCodeId
              },
              UnitPrice: unitPrice,
              Qty: quantity
            },
            Description: item.productName || `Line Item ${index + 1}`
          };
          
          logger.info(`Line item ${index + 1}: ${item.productName} - Qty: ${quantity}, UnitPrice: $${unitPrice.toFixed(2)}, Amount: $${lineAmount} (Tax: ${taxRate}% = $${taxAmount}, TaxCode: ${taxCodeId})`);
          return lineItem;
        });
      } else {
        // Fallback to single line item if no line items found
        qbLineItems = [{
          Amount: totalAmount,
          DetailType: 'SalesItemLineDetail' as const,
          SalesItemLineDetail: {
            ItemRef: {
              value: serviceItem.value,
              name: serviceItem.name
            },
            TaxCodeRef: {
              value: defaultTaxCode
            }
          },
          Description: invoiceData.description || `HubSpot Invoice ${invoiceData.hubspot_invoice_id}`
        }];
        logger.info(`Using fallback single line item: $${totalAmount}`);
      }
      
      const qbInvoiceData = {
        DocNumber: invoiceData.hubspot_invoice_id,  // Use HubSpot invoice number
        CustomerRef: {
          value: qbCustomer.Id!
        },
        Line: qbLineItems
      };

      logger.info(`Creating QB invoice with DocNumber: ${invoiceData.hubspot_invoice_id}, ${qbLineItems.length} line items, Total: $${totalAmount}`);

      const qbInvoice = await quickbooksService.createInvoice(qbInvoiceData);
      
      // Update invoice with QuickBooks ID
      await prisma.invoiceMapping.update({
        where: { id: invoiceId },
        data: {
          quickbooksInvoiceId: qbInvoice.Id!,
          lastSyncAt: new Date()
        }
      });

      logger.info(`Successfully synced invoice ${invoiceId} to QuickBooks: ${qbInvoice.Id}`);

      res.json({
        success: true,
        message: 'Invoice synced to QuickBooks successfully',
        invoiceId: invoiceId,
        quickbooksInvoiceId: qbInvoice.Id!,
        quickbooksUrl: quickbooksService.getInvoiceUrl(qbInvoice.Id!),
        customerName: customerName,
        totalAmount: parseFloat(invoiceData.total_amount.toString()),
        timestamp: new Date().toISOString()
      });

    } catch (syncError) {
      logger.error(`QuickBooks sync failed for invoice ${invoiceId}:`, syncError);
      
      // Return detailed error information
      return res.status(500).json({
        success: false,
        error: 'QuickBooks sync failed',
        details: syncError instanceof Error ? syncError.message : 'Unknown sync error',
        invoiceId: invoiceId,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    logger.error(`Error syncing invoice ${req.params.id} to QuickBooks:`, error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to sync invoice to QuickBooks',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Get detailed invoice information
invoiceRoutes.get('/:id/details', async (req, res, _next) => {
  try {
    const invoiceId = req.params.id;
    logger.info(`Fetching detailed information for invoice ${invoiceId}`);

    // Get invoice details with tax summary
    const invoiceDetails = await prisma.$queryRaw`
      SELECT 
        im.id,
        im.hubspot_invoice_id as "hubspotInvoiceId",
        im.hubspot_deal_id as "hubspotDealId", 
        im.total_amount as "totalAmount",
        im.currency,
        im.status,
        im.client_email as "clientEmail",
        im.client_name as "clientName",
        im.due_date as "dueDate",
        im.issue_date as "issueDate",
        im.description,
        im.created_at as "createdAt",
        im.updated_at as "updatedAt",
        im.hubspot_created_at as "hubspotCreatedAt",
        im.hubspot_modified_at as "hubspotModifiedAt",
        im.quickbooks_invoice_id as "quickbooksInvoiceId",
        im.last_sync_at as "lastSyncAt",
        c.full_name as "contactFullName",
        c.email as "contactEmail",
        c.first_name as "contactFirstName", 
        c.last_name as "contactLastName",
        c.phone as "contactPhone",
        comp.name as "companyName",
        comp.domain as "companyDomain",
        ts.subtotal_before_tax as "subtotalBeforeTax",
        ts.total_tax_amount as "totalTaxAmount",
        ts.total_after_tax as "totalAfterTax",
        ts.tax_breakdown as "taxBreakdown"
      FROM invoice_mapping im
      LEFT JOIN invoice_associations ia ON im.id = ia.invoice_id AND ia.is_primary_contact = true
      LEFT JOIN contacts c ON ia.contact_id = c.id
      LEFT JOIN invoice_associations ia2 ON im.id = ia2.invoice_id AND ia2.is_primary_company = true  
      LEFT JOIN companies comp ON ia2.company_id = comp.id
      LEFT JOIN tax_summary ts ON im.id = ts.invoice_id
      WHERE im.id = ${invoiceId}
      LIMIT 1
    `;

    // Get line items for the invoice
    const lineItems = await prisma.$queryRaw`
      SELECT 
        li.id,
        li.hubspot_line_item_id as "hubspotLineItemId",
        li.product_name as "productName",
        li.quantity,
        li.unit_price as "unitPrice",
        li.amount,
        li.currency,
        li.tax_amount as "taxAmount",
        li.tax_rate as "taxRate",
        li.tax_label as "taxLabel",
        li.tax_category as "taxCategory",
        li.post_tax_amount as "postTaxAmount",
        li.discount_amount as "discountAmount",
        li.discount_percentage as "discountPercentage"
      FROM line_items li
      WHERE li.invoice_id = ${invoiceId}
      ORDER BY li.created_at ASC
    `;

    const invoice = (invoiceDetails as any[])[0];

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found',
        timestamp: new Date().toISOString()
      });
    }

    // Process company and contact information
    let companyInfo = null;
    let contactInfo = null;

    if (invoice.companyName) {
      companyInfo = {
        name: invoice.companyName,
        domain: invoice.companyDomain
      };
    }

    if (invoice.contactFullName || invoice.contactFirstName || invoice.contactLastName) {
      contactInfo = {
        fullName: invoice.contactFullName,
        firstName: invoice.contactFirstName,
        lastName: invoice.contactLastName,
        email: invoice.contactEmail,
        phone: invoice.contactPhone
      };
    }

    // Process line items with tax information
    const processedLineItems = (lineItems as any[]).map(item => ({
      id: item.id,
      hubspotLineItemId: item.hubspotLineItemId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice ? parseFloat(item.unitPrice.toString()) : 0,
      amount: item.amount ? parseFloat(item.amount.toString()) : 0,
      currency: item.currency,
      taxAmount: item.taxAmount ? parseFloat(item.taxAmount.toString()) : 0,
      taxRate: item.taxRate ? parseFloat(item.taxRate.toString()) : 0,
      taxLabel: item.taxLabel,
      taxCategory: item.taxCategory,
      postTaxAmount: item.postTaxAmount ? parseFloat(item.postTaxAmount.toString()) : 0,
      discountAmount: item.discountAmount ? parseFloat(item.discountAmount.toString()) : 0,
      discountPercentage: item.discountPercentage ? parseFloat(item.discountPercentage.toString()) : 0
    }));

    // Process tax summary
    const taxSummary = invoice.subtotalBeforeTax ? {
      subtotalBeforeTax: parseFloat(invoice.subtotalBeforeTax.toString()),
      totalTaxAmount: parseFloat(invoice.totalTaxAmount.toString()),
      totalAfterTax: parseFloat(invoice.totalAfterTax.toString()),
      taxBreakdown: invoice.taxBreakdown
    } : null;

    const detailedInvoice = {
      id: invoice.id,
      hubspotInvoiceId: invoice.hubspotInvoiceId,
      hubspotDealId: invoice.hubspotDealId,
      totalAmount: invoice.totalAmount ? parseFloat(invoice.totalAmount.toString()) : 0,
      currency: invoice.currency,
      status: invoice.status,
      company: companyInfo,
      contact: contactInfo,
      dueDate: invoice.dueDate?.toISOString(),
      issueDate: invoice.issueDate?.toISOString(),
      description: invoice.description,
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
      hubspotCreatedAt: invoice.hubspotCreatedAt?.toISOString(),
      hubspotModifiedAt: invoice.hubspotModifiedAt?.toISOString(),
      quickbooksInvoiceId: invoice.quickbooksInvoiceId,
      lastSyncAt: invoice.lastSyncAt?.toISOString(),
      syncStatus: invoice.quickbooksInvoiceId ? 'synced' : 'pending',
      lineItems: processedLineItems,
      taxSummary: taxSummary
    };

    res.json({
      success: true,
      invoice: detailedInvoice,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`Error fetching invoice details for ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch invoice details',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Get all invoices from database (preferred) with HubSpot fallback
invoiceRoutes.get('/', async (req, res, next) => {
  try {
    logger.info('Fetching invoices...');
    
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const source = req.query.source as string || 'database'; // 'database' or 'hubspot'

    if (source === 'hubspot') {
      // Fallback to live HubSpot data
      return await getInvoicesFromHubSpot(req, res, next);
    }

    // Try to get from database first
    const offset = (page - 1) * limit;
    
    const [invoices, total] = await Promise.all([
      prisma.invoiceMapping.findMany({
        skip: offset,
        take: limit,
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true,
          hubspotInvoiceId: true,
          hubspotDealId: true,
          hubspotObjectId: true,
          hubspotObjectType: true,
          totalAmount: true,
          currency: true,
          status: true,
          clientEmail: true,
          clientName: true,
          dueDate: true,
          issueDate: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          hubspotCreatedAt: true,
          hubspotModifiedAt: true,
          firstSyncAt: true,
          lastSyncAt: true,
          syncSource: true
        }
      }),
      prisma.invoiceMapping.count()
    ]);

    if (invoices.length === 0 && total === 0) {
      // No invoices in database, suggest extraction
      return res.json({
        success: true,
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          pages: 0,
          hasNext: false,
          hasPrev: false
        },
        source: 'database-empty',
        message: 'No invoices found in database. Run POST /api/extract/hubspot-invoices to extract invoices from HubSpot first.',
        timestamp: new Date().toISOString()
      });
    }

    const transformedInvoices = invoices.map(invoice => ({
      id: invoice.id,
      hubspotObjectId: invoice.hubspotObjectId,
      hubspotInvoiceId: invoice.hubspotInvoiceId,
      hubspotDealId: invoice.hubspotDealId,
      objectType: invoice.hubspotObjectType,
      invoiceNumber: invoice.hubspotInvoiceId,
      amount: invoice.totalAmount ? parseFloat(invoice.totalAmount.toString()) : 0,
      currency: invoice.currency,
      status: invoice.status,
      clientEmail: invoice.clientEmail,
      clientName: invoice.clientName,
      dueDate: invoice.dueDate?.toISOString(),
      issueDate: invoice.issueDate?.toISOString(),
      description: invoice.description,
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
      hubspotCreatedAt: invoice.hubspotCreatedAt?.toISOString(),
      hubspotModifiedAt: invoice.hubspotModifiedAt?.toISOString(),
      syncInfo: {
        firstSyncAt: invoice.firstSyncAt?.toISOString(),
        lastSyncAt: invoice.lastSyncAt?.toISOString(),
        syncSource: invoice.syncSource
      }
    }));

    logger.info(`Retrieved ${invoices.length} invoices from database (page ${page}/${Math.ceil(total / limit)})`);

    res.json({
      success: true,
      data: transformedInvoices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      },
      source: 'database',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching invoices from database:', error);
    
    // Fallback to HubSpot if database fails
    logger.info('Database failed, falling back to HubSpot live data...');
    return await getInvoicesFromHubSpot(req, res, next);
  }
});

// Get all invoices from HubSpot (live data) - separated function
const getInvoicesFromHubSpot: ApiHandler = async (req, res, _next) => {
  try {
    logger.info('Fetching invoices from HubSpot...');
    
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    
    const hubspotClient = getHubSpotClient();
    
    // Test connection first
    const isConnected = await hubspotClient.testConnection();
    if (!isConnected) {
      return res.status(500).json({
        error: 'Cannot connect to HubSpot API',
        message: 'HubSpot API connection failed'
      });
    }

    // Get all invoices from HubSpot
    const hubspotInvoices = await hubspotClient.getAllInvoices();
    
    // Apply pagination
    const offset = (page - 1) * limit;
    const paginatedInvoices = hubspotInvoices.slice(offset, offset + limit);
    
    // Transform for response
    const invoices = paginatedInvoices.map(invoice => ({
      id: invoice.id,
      hubspotObjectId: invoice.id,
      invoiceNumber: invoice.properties.hs_invoice_number,
      amount: invoice.properties.hs_subtotal ? parseFloat(invoice.properties.hs_subtotal) : 
              invoice.properties.hs_invoice_amount ? parseFloat(invoice.properties.hs_invoice_amount) : 0,
      currency: invoice.properties.hs_invoice_currency || 'USD',
      status: invoice.properties.hs_invoice_status || 'unknown',
      invoiceDate: invoice.properties.hs_invoice_date,
      dueDate: invoice.properties.hs_invoice_due_date,
      description: invoice.properties.hs_invoice_description,
      createdAt: invoice.properties.createdate,
      updatedAt: invoice.properties.hs_lastmodifieddate,
      associations: {
        contacts: invoice.associations?.contacts?.length || 0,
        companies: invoice.associations?.companies?.length || 0,
        deals: invoice.associations?.deals?.length || 0
      }
    }));

    const total = hubspotInvoices.length;

    logger.info(`Retrieved ${invoices.length} invoices (page ${page}/${Math.ceil(total / limit)}) from HubSpot`);

    res.json({
      success: true,
      data: invoices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
      },
      source: 'hubspot-live',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching invoices from HubSpot:', error);
    
    let errorMessage = 'Failed to fetch invoices';
    let statusCode = 500;
    
    if (error.response?.status === 403) {
      errorMessage = 'HubSpot API key lacks required permissions (crm.objects.invoices.read)';
      statusCode = 403;
    } else if (error.response?.status === 401) {
      errorMessage = 'Invalid HubSpot API key';
      statusCode = 401;
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: {
        errorCode: error.response?.status || error.code,
        errorMessage: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
}

// Get invoice by HubSpot ID
invoiceRoutes.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    logger.info(`Fetching invoice ${id} from HubSpot...`);

    const hubspotClient = getHubSpotClient();
    
    // Get specific invoice from HubSpot
    const allInvoices = await hubspotClient.getAllInvoices();
    const invoice = allInvoices.find(inv => inv.id === id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found',
        message: `Invoice with ID ${id} not found in HubSpot`
      });
    }

    // Get associated contacts and companies details
    let contactDetails = [];
    let companyDetails = [];
    
    if (invoice.associations?.contacts?.length) {
      try {
        contactDetails = await Promise.all(
          invoice.associations.contacts.slice(0, 3).map(contact => 
            hubspotClient.getContact(contact.id)
          )
        );
      } catch (error) {
        logger.warn('Could not fetch contact details:', error.message);
      }
    }

    if (invoice.associations?.companies?.length) {
      try {
        companyDetails = await Promise.all(
          invoice.associations.companies.slice(0, 3).map(company => 
            hubspotClient.getCompany(company.id)
          )
        );
      } catch (error) {
        logger.warn('Could not fetch company details:', error.message);
      }
    }

    const detailedInvoice = {
      id: invoice.id,
      hubspotObjectId: invoice.id,
      properties: {
        invoiceNumber: invoice.properties.hs_invoice_number,
        amount: invoice.properties.hs_invoice_amount ? parseFloat(invoice.properties.hs_invoice_amount) : 0,
        currency: invoice.properties.hs_invoice_currency || 'USD',
        status: invoice.properties.hs_invoice_status || 'unknown',
        invoiceDate: invoice.properties.hs_invoice_date,
        dueDate: invoice.properties.hs_invoice_due_date,
        description: invoice.properties.hs_invoice_description,
        createdAt: invoice.properties.createdate,
        updatedAt: invoice.properties.hs_lastmodifieddate
      },
      associations: {
        contacts: contactDetails.filter(Boolean).map(contact => ({
          id: contact.id,
          email: contact.properties.email,
          name: `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim() || 'Unknown'
        })),
        companies: companyDetails.filter(Boolean).map(company => ({
          id: company.id,
          name: company.properties.name || 'Unknown Company',
          domain: company.properties.domain
        }))
      }
    };

    logger.info(`Retrieved detailed invoice ${id} from HubSpot`);

    res.json({
      success: true,
      data: detailedInvoice,
      source: 'hubspot-live',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error fetching invoice ${req.params.id}:`, error);
    next(error);
  }
});

// Get invoice statistics
invoiceRoutes.get('/stats/summary', async (req, res, next) => {
  try {
    logger.info('Calculating invoice statistics from HubSpot...');

    const hubspotClient = getHubSpotClient();
    const allInvoices = await hubspotClient.getAllInvoices();

    // Calculate statistics
    const stats = {
      total: allInvoices.length,
      byStatus: {},
      byCurrency: {},
      totalAmount: 0,
      averageAmount: 0,
      oldestInvoice: null,
      newestInvoice: null
    };

    let totalAmount = 0;
    let validAmounts = 0;
    let oldestDate = null;
    let newestDate = null;

    allInvoices.forEach(invoice => {
      const status = invoice.properties.hs_invoice_status || 'unknown';
      const currency = invoice.properties.hs_invoice_currency || 'USD';
      const amount = invoice.properties.hs_invoice_amount ? parseFloat(invoice.properties.hs_invoice_amount) : 0;
      const createdDate = invoice.properties.createdate ? new Date(invoice.properties.createdate) : null;

      // Count by status
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

      // Count by currency
      stats.byCurrency[currency] = (stats.byCurrency[currency] || 0) + 1;

      // Sum amounts
      if (amount > 0) {
        totalAmount += amount;
        validAmounts++;
      }

      // Track date ranges
      if (createdDate) {
        if (!oldestDate || createdDate < oldestDate) {
          oldestDate = createdDate;
          stats.oldestInvoice = {
            id: invoice.id,
            date: createdDate.toISOString(),
            amount: amount
          };
        }
        if (!newestDate || createdDate > newestDate) {
          newestDate = createdDate;
          stats.newestInvoice = {
            id: invoice.id,
            date: createdDate.toISOString(),
            amount: amount
          };
        }
      }
    });

    stats.totalAmount = totalAmount;
    stats.averageAmount = validAmounts > 0 ? totalAmount / validAmounts : 0;

    logger.info(`Calculated statistics for ${allInvoices.length} invoices`);

    res.json({
      success: true,
      data: stats,
      source: 'hubspot-live',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error calculating invoice statistics:', error);
    next(error);
  }
});