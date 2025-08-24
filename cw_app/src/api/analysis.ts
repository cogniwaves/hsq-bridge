import { Router } from 'express';
import { ApiHandler } from '../types/api';
import { logger } from '../utils/logger';
import { HubSpotInvoice } from '../types/hubspot';

export const analysisRoutes = Router();

// SQL validation queries endpoint
analysisRoutes.get('/sql-validation', (async (req, res) => {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    // Run multiple validation queries
    const results = {} as Record<string, any>;
    
    // 1. Invoice overview with tax data
    results.invoiceOverview = await prisma.$queryRaw`
      SELECT 
        COUNT(*)::INTEGER as total_invoices,
        COUNT(CASE WHEN detected_currency IS NOT NULL THEN 1 END)::INTEGER as with_detected_currency,
        COUNT(CASE WHEN line_items_count > 0 THEN 1 END)::INTEGER as with_line_items,
        COUNT(DISTINCT detected_currency)::INTEGER as unique_currencies
      FROM invoice_mapping
    `;
    
    // 2. Line items summary
    results.lineItemsSummary = await prisma.$queryRaw`
      SELECT 
        COUNT(*)::INTEGER as total_line_items,
        COUNT(CASE WHEN tax_amount > 0 THEN 1 END)::INTEGER as items_with_tax,
        COUNT(DISTINCT currency)::INTEGER as currencies,
        ROUND(SUM(tax_amount)::NUMERIC, 2) as total_tax_amount
      FROM line_items
    `;
    
    // 3. Tax summary overview
    results.taxSummaryOverview = await prisma.$queryRaw`
      SELECT 
        COUNT(*)::INTEGER as total_tax_summaries,
        COUNT(DISTINCT currency)::INTEGER as currencies,
        ROUND(SUM(total_tax_amount)::NUMERIC, 2) as grand_total_tax,
        ROUND(AVG(total_tax_amount)::NUMERIC, 2) as avg_tax_per_invoice
      FROM tax_summary
    `;
    
    // 4. Currency distribution
    results.currencyDistribution = await prisma.$queryRaw`
      SELECT 
        detected_currency as currency,
        COUNT(*)::INTEGER as invoice_count,
        ROUND(SUM(total_amount)::NUMERIC, 2) as total_revenue
      FROM invoice_mapping 
      WHERE detected_currency IS NOT NULL
      GROUP BY detected_currency
      ORDER BY invoice_count DESC
    `;
    
    // 5. Sample enhanced invoice with complete details
    results.sampleEnhancedInvoice = await prisma.$queryRaw`
      SELECT 
        im.hubspot_invoice_number,
        im.detected_currency,
        im.total_amount,
        im.line_items_count,
        comp.name as company_name,
        c.email as contact_email,
        ts.total_tax_amount,
        ts.tax_breakdown
      FROM invoice_mapping im
      LEFT JOIN invoice_associations ia ON im.id = ia.invoice_id AND ia.is_primary_company = true  
      LEFT JOIN companies comp ON ia.company_id = comp.id
      LEFT JOIN invoice_associations ia2 ON im.id = ia2.invoice_id AND ia2.is_primary_contact = true
      LEFT JOIN contacts c ON ia2.contact_id = c.id
      LEFT JOIN tax_summary ts ON im.id = ts.invoice_id
      WHERE im.line_items_count > 0 AND ts.total_tax_amount > 0
      LIMIT 5
    `;

    await prisma.$disconnect();

    res.json({
      success: true,
      message: 'SQL validation completed',
      data: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('SQL validation failed:', error);
    
    res.status(500).json({
      success: false,
      message: 'SQL validation failed',
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    });
  }
}) as ApiHandler);

// Analyze tax breakdown patterns in our data
analysisRoutes.get('/tax-breakdown-analysis', (async (req, res) => {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    
    // Get all unique tax labels and rates
    const taxPatterns = await prisma.$queryRaw`
      SELECT DISTINCT 
        tax_label,
        tax_rate,
        COUNT(*)::INTEGER as count,
        ROUND(SUM(tax_amount)::NUMERIC, 2) as total_tax
      FROM line_items 
      WHERE tax_amount > 0 AND tax_label IS NOT NULL
      GROUP BY tax_label, tax_rate
      ORDER BY count DESC
    `;
    
    // Get sample tax breakdowns from tax_summary table
    const taxBreakdownSamples = await prisma.$queryRaw`
      SELECT 
        tax_breakdown,
        COUNT(*)::INTEGER as invoice_count
      FROM tax_summary 
      WHERE tax_breakdown IS NOT NULL
      GROUP BY tax_breakdown
      ORDER BY invoice_count DESC
      LIMIT 10
    `;

    await prisma.$disconnect();

    res.json({
      success: true,
      message: 'Tax breakdown analysis completed',
      data: {
        taxPatterns,
        taxBreakdownSamples
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Tax breakdown analysis failed:', error);
    
    res.status(500).json({
      success: false,
      message: 'Tax breakdown analysis failed',
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    });
  }
}) as ApiHandler);

// Debug endpoint to see raw HubSpot invoice properties
analysisRoutes.get('/hubspot-invoice-debug', (async (req, res) => {
  try {
    logger.info('Debugging HubSpot invoice properties...');
    
    const { getHubSpotClient } = await import('../services/hubspotClient');
    const hubspotClient = getHubSpotClient();
    
    // Get all possible invoice properties by making a request without specifying properties
    const response = await (hubspotClient as any)['client'].get('/crm/v3/objects/invoices', {
      params: {
        limit: 3,
        // Request ALL properties by not specifying which ones
        associations: 'contacts,companies,deals'
      }
    });

    const debugData = response.data.results.map((invoice: HubSpotInvoice) => ({
      id: invoice.id,
      allAvailableProperties: Object.keys(invoice.properties).sort(),
      sampleProperties: invoice.properties,
      associations: invoice.associations
    }));

    res.json({
      success: true,
      message: 'All available HubSpot invoice properties',
      data: debugData,
      totalPropertiesFound: debugData[0]?.allAvailableProperties?.length || 0,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Debug endpoint failed:', error);
    
    res.status(500).json({
      success: false,
      message: 'Debug failed',
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    });
  }
}) as ApiHandler);

// Quick extraction test endpoint (deals fallback)
analysisRoutes.post('/hubspot-sample-extract', (async (req, res) => {
  try {
    logger.info('Testing HubSpot sample extraction...');
    
    const { getHubSpotClient } = await import('../services/hubspotClient');
    const hubspotClient = getHubSpotClient();
    
    // Get just the first 5 closed deals for testing
    const allDeals = await hubspotClient.getAllClosedDeals();
    const sampleDeals = allDeals.slice(0, 5);
    
    // Transform to invoices
    const invoices = await hubspotClient.transformDealsToInvoices(sampleDeals);
    
    logger.info(`Sample extraction successful - ${invoices.length} invoices transformed`);

    res.json({
      success: true,
      message: 'Sample extraction successful',
      data: {
        totalClosedDeals: allDeals.length,
        sampleSize: invoices.length,
        sampleInvoices: invoices.map((inv: HubSpotInvoice) => ({
          id: inv.id,
          objectType: inv.objectType,
          amount: inv.properties.amount,
          dealName: inv.properties.dealname,
          clientName: inv.properties.primaryContactName || inv.properties.primaryCompanyName,
          clientEmail: inv.properties.primaryContactEmail,
          createdAt: inv.createdAt,
          updatedAt: inv.updatedAt
        }))
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('HubSpot sample extraction failed:', error);
    
    res.status(500).json({
      success: false,
      message: 'Sample extraction failed',
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    });
  }
}) as ApiHandler);