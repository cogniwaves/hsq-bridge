#!/usr/bin/env node

/**
 * Initialize Sync Watermarks Script
 * 
 * This script initializes the sync_watermarks table with the current timestamps
 * for all existing entities to prevent them from being treated as "changed"
 * when the sync queue processes changes.
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function initializeSyncWatermarks() {
  console.log('🚀 Initializing sync watermarks...');
  
  try {
    // Get current timestamp
    const now = new Date();
    
    // Initialize watermarks for each entity type
    const entityTypes = ['INVOICE', 'LINE_ITEM', 'CONTACT', 'COMPANY'];
    
    for (const entityType of entityTypes) {
      // Check if watermark already exists
      const existingWatermark = await prisma.sync_watermarks.findUnique({
        where: { entity_type: entityType }
      });
      
      if (existingWatermark) {
        console.log(`⚠️  Watermark for ${entityType} already exists: ${existingWatermark.last_sync_timestamp}`);
        continue;
      }
      
      // Get the latest timestamp for this entity type
      let latestTimestamp = now;
      
      switch (entityType) {
        case 'INVOICE':
          const latestInvoice = await prisma.invoice_mapping.findFirst({
            orderBy: { updated_at: 'desc' },
            select: { updated_at: true }
          });
          if (latestInvoice) {
            latestTimestamp = latestInvoice.updated_at;
          }
          break;
          
        case 'LINE_ITEM':
          const latestLineItem = await prisma.line_items.findFirst({
            orderBy: { updated_at: 'desc' },
            select: { updated_at: true }
          });
          if (latestLineItem) {
            latestTimestamp = latestLineItem.updated_at;
          }
          break;
          
        case 'CONTACT':
          const latestContact = await prisma.contacts.findFirst({
            orderBy: { updated_at: 'desc' },
            select: { updated_at: true }
          });
          if (latestContact) {
            latestTimestamp = latestContact.updated_at;
          }
          break;
          
        case 'COMPANY':
          const latestCompany = await prisma.companies.findFirst({
            orderBy: { updated_at: 'desc' },
            select: { updated_at: true }
          });
          if (latestCompany) {
            latestTimestamp = latestCompany.updated_at;
          }
          break;
      }
      
      // Create the watermark
      await prisma.sync_watermarks.create({
        data: {
          entity_type: entityType,
          last_sync_timestamp: latestTimestamp,
          created_at: now,
          updated_at: now
        }
      });
      
      console.log(`✅ Created watermark for ${entityType}: ${latestTimestamp.toISOString()}`);
    }
    
    // Display summary
    console.log('\n📊 Sync Watermarks Summary:');
    const allWatermarks = await prisma.sync_watermarks.findMany({
      orderBy: { entity_type: 'asc' }
    });
    
    allWatermarks.forEach(watermark => {
      console.log(`  ${watermark.entity_type}: ${watermark.last_sync_timestamp.toISOString()}`);
    });
    
    console.log('\n🎉 Sync watermarks initialization complete!');
    console.log('   This will prevent existing entities from being marked as "changed"');
    console.log('   in future sync queue operations.');
    
  } catch (error) {
    console.error('❌ Error initializing sync watermarks:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the initialization
if (require.main === module) {
  initializeSyncWatermarks();
}

module.exports = { initializeSyncWatermarks };