import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface MigrationInfo {
  version: string;
  description: string;
  appliedAt?: Date;
  status: 'pending' | 'applied' | 'failed';
}

// Custom migration system for data migrations beyond schema changes
export class DataMigrationRunner {
  private migrations: Array<{
    version: string;
    description: string;
    up: () => Promise<void>;
    down: () => Promise<void>;
  }> = [];

  constructor() {
    this.registerMigrations();
  }

  private registerMigrations() {
    // Example data migration
    this.migrations.push({
      version: '001',
      description: 'Initialize invoice status mapping',
      up: async () => {
        // Update any existing invoices with null status
        const count = await prisma.invoiceMapping.updateMany({
          where: { status: { equals: null } },
          data: { status: 'DRAFT' }
        });
        logger.info(`Updated ${count} invoices with default status`);
      },
      down: async () => {
        // Rollback logic if needed
        logger.info('Rollback: Reset invoice statuses');
      }
    });

    this.migrations.push({
      version: '002',
      description: 'Fix payment method enum values',
      up: async () => {
        // Convert any old payment method values
        const payments = await prisma.paymentMapping.findMany({
          where: { paymentMethod: { equals: null } }
        });
        
        for (const payment of payments) {
          await prisma.paymentMapping.update({
            where: { id: payment.id },
            data: { paymentMethod: 'OTHER' }
          });
        }
        
        logger.info(`Fixed payment method for ${payments.length} payments`);
      },
      down: async () => {
        logger.info('Rollback: Reset payment methods');
      }
    });

    this.migrations.push({
      version: '003',
      description: 'Create indexes for performance',
      up: async () => {
        // This would typically be done in Prisma schema, but can be done here for custom indexes
        await prisma.$executeRaw`
          CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoice_mapping_status_created 
          ON invoice_mapping(status, created_at DESC);
        `;
        
        await prisma.$executeRaw`
          CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_mapping_transaction_date 
          ON payment_mapping(transaction_date DESC);
        `;
        
        await prisma.$executeRaw`
          CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sync_log_platform_status_created 
          ON sync_logs(platform, status, created_at DESC);
        `;

        logger.info('Created performance indexes');
      },
      down: async () => {
        await prisma.$executeRaw`DROP INDEX IF EXISTS idx_invoice_mapping_status_created;`;
        await prisma.$executeRaw`DROP INDEX IF EXISTS idx_payment_mapping_transaction_date;`;
        await prisma.$executeRaw`DROP INDEX IF EXISTS idx_sync_log_platform_status_created;`;
        logger.info('Dropped performance indexes');
      }
    });
  }

  async getMigrationStatus(): Promise<MigrationInfo[]> {
    // Check if migration tracking table exists
    try {
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS _data_migrations (
          version VARCHAR(255) PRIMARY KEY,
          description TEXT,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;
    } catch (error) {
      logger.error('Failed to create migration tracking table:', error);
    }

    // Get applied migrations
    const appliedMigrations = await prisma.$queryRaw<Array<{
      version: string;
      description: string;
      applied_at: Date;
    }>>`
      SELECT version, description, applied_at FROM _data_migrations ORDER BY version;
    `;

    // Build status array
    return this.migrations.map(migration => {
      const applied = appliedMigrations.find(am => am.version === migration.version);
      
      return {
        version: migration.version,
        description: migration.description,
        appliedAt: applied?.applied_at,
        status: applied ? 'applied' : 'pending'
      };
    });
  }

  async runPendingMigrations(): Promise<void> {
    const status = await this.getMigrationStatus();
    const pendingMigrations = status.filter(m => m.status === 'pending');

    if (pendingMigrations.length === 0) {
      logger.info('✅ No pending data migrations');
      return;
    }

    logger.info(`🔄 Running ${pendingMigrations.length} pending data migrations...`);

    for (const migrationStatus of pendingMigrations) {
      const migration = this.migrations.find(m => m.version === migrationStatus.version);
      if (!migration) continue;

      try {
        logger.info(`📦 Running migration ${migration.version}: ${migration.description}`);
        
        await migration.up();
        
        // Mark as applied
        await prisma.$executeRaw`
          INSERT INTO _data_migrations (version, description) 
          VALUES (${migration.version}, ${migration.description});
        `;
        
        logger.info(`✅ Migration ${migration.version} completed`);
        
      } catch (error) {
        logger.error(`❌ Migration ${migration.version} failed:`, error);
        
        // Mark as failed
        await prisma.$executeRaw`
          UPDATE _data_migrations 
          SET description = ${migration.description + ' (FAILED)'} 
          WHERE version = ${migration.version};
        `;
        
        throw error;
      }
    }

    logger.info('🎉 All data migrations completed successfully');
  }

  async rollbackMigration(version: string): Promise<void> {
    const migration = this.migrations.find(m => m.version === version);
    if (!migration) {
      throw new Error(`Migration ${version} not found`);
    }

    try {
      logger.info(`🔄 Rolling back migration ${version}: ${migration.description}`);
      
      await migration.down();
      
      // Remove from tracking table
      await prisma.$executeRaw`
        DELETE FROM _data_migrations WHERE version = ${version};
      `;
      
      logger.info(`✅ Migration ${version} rolled back successfully`);
      
    } catch (error) {
      logger.error(`❌ Rollback of migration ${version} failed:`, error);
      throw error;
    }
  }
}

// Utility functions for database health checks
export async function checkDatabaseHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Array<{ name: string; status: boolean; message?: string }>;
}> {
  const checks = [];

  try {
    // Basic connectivity
    await prisma.$queryRaw`SELECT 1`;
    checks.push({ name: 'connectivity', status: true });
  } catch (error: any) {
    checks.push({ name: 'connectivity', status: false, message: error.message });
  }

  try {
    // Check main tables exist and are accessible
    const invoiceCount = await prisma.invoiceMapping.count();
    checks.push({ name: 'invoice_table', status: true, message: `${invoiceCount} records` });
  } catch (error: any) {
    checks.push({ name: 'invoice_table', status: false, message: error.message });
  }

  try {
    const paymentCount = await prisma.paymentMapping.count();
    checks.push({ name: 'payment_table', status: true, message: `${paymentCount} records` });
  } catch (error: any) {
    checks.push({ name: 'payment_table', status: false, message: error.message });
  }

  try {
    // Check database performance
    const start = Date.now();
    await prisma.syncLog.findMany({ take: 10 });
    const duration = Date.now() - start;
    
    const isHealthy = duration < 1000; // Less than 1 second
    checks.push({ 
      name: 'performance', 
      status: isHealthy, 
      message: `${duration}ms` 
    });
  } catch (error: any) {
    checks.push({ name: 'performance', status: false, message: error.message });
  }

  const failedChecks = checks.filter(c => !c.status).length;
  const status = failedChecks === 0 ? 'healthy' : failedChecks < checks.length / 2 ? 'degraded' : 'unhealthy';

  return { status, checks };
}

export async function getDatabaseStats() {
  try {
    const [invoices, payments, allocations, syncLogs, webhooks] = await Promise.all([
      prisma.invoiceMapping.count(),
      prisma.paymentMapping.count(),
      prisma.invoicePayment.count(),
      prisma.syncLog.count(),
      prisma.webhookEvent.count()
    ]);

    return {
      invoices,
      payments,
      allocations,
      syncLogs,
      webhooks,
      totalRecords: invoices + payments + allocations + syncLogs + webhooks
    };
  } catch (error) {
    logger.error('Failed to get database stats:', error);
    return null;
  }
}