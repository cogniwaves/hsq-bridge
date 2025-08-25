import { logger } from './logger';
import { testAllConnections } from './connectivity';
import { checkDatabaseHealth, getDatabaseStats } from '../database/migrations';
import { getQueueStats } from '../workers';

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: ServiceHealth[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  message?: string;
  details?: any;
  critical: boolean;
}

export class HealthChecker {
  private checks: Array<{
    name: string;
    critical: boolean;
    check: () => Promise<Omit<ServiceHealth, 'name' | 'critical'>>;
  }> = [];

  constructor() {
    this.registerHealthChecks();
  }

  private registerHealthChecks() {
    // Database health check
    this.checks.push({
      name: 'Database',
      critical: true,
      check: async () => {
        const start = Date.now();
        try {
          const health = await checkDatabaseHealth();
          const responseTime = Date.now() - start;
          
          return {
            status: health.status,
            responseTime,
            message: `${health.checks.filter(c => c.status).length}/${health.checks.length} checks passed`,
            details: health.checks
          };
        } catch (error: any) {
          return {
            status: 'unhealthy',
            responseTime: Date.now() - start,
            message: 'Database connection failed',
            details: error.message
          };
        }
      }
    });

    // Redis health check
    this.checks.push({
      name: 'Redis',
      critical: true,
      check: async () => {
        const start = Date.now();
        try {
          const Redis = await import('ioredis');
          const { getRedisConfig } = await import('../config');
          
          const redisUrl = getRedisConfig();
          const redis = new Redis.default(redisUrl);
          
          await redis.ping();
          
          // Get Redis info
          const info = await redis.info('server');
          const memory = await redis.info('memory');
          
          await redis.quit();
          
          const responseTime = Date.now() - start;
          
          return {
            status: 'healthy',
            responseTime,
            message: 'Redis connection successful',
            details: {
              connected: true,
              info: { server: info, memory }
            }
          };
        } catch (error: any) {
          return {
            status: 'unhealthy',
            responseTime: Date.now() - start,
            message: 'Redis connection failed',
            details: error.message
          };
        }
      }
    });

    // API integrations health check
    this.checks.push({
      name: 'API Integrations',
      critical: false,
      check: async () => {
        const start = Date.now();
        try {
          const connectivityResults = await testAllConnections();
          const responseTime = Date.now() - start;
          
          const successCount = connectivityResults.filter(r => r.status === 'success').length;
          const totalCount = connectivityResults.length;
          
          let status: 'healthy' | 'degraded' | 'unhealthy';
          if (successCount === totalCount) {
            status = 'healthy';
          } else if (successCount >= totalCount / 2) {
            status = 'degraded';
          } else {
            status = 'unhealthy';
          }
          
          return {
            status,
            responseTime,
            message: `${successCount}/${totalCount} API connections successful`,
            details: connectivityResults
          };
        } catch (error: any) {
          return {
            status: 'unhealthy',
            responseTime: Date.now() - start,
            message: 'API connectivity check failed',
            details: error.message
          };
        }
      }
    });

    // Queue system health check
    this.checks.push({
      name: 'Queue System',
      critical: false,
      check: async () => {
        const start = Date.now();
        try {
          const queueStats = await getQueueStats();
          const responseTime = Date.now() - start;
          
          // Consider degraded if too many failed jobs
          const totalFailed = queueStats.sync.failed;
          const status = totalFailed > 10 ? 'degraded' : 'healthy';
          
          return {
            status,
            responseTime,
            message: `Queues operational, ${totalFailed} failed jobs`,
            details: queueStats
          };
        } catch (error: any) {
          return {
            status: 'unhealthy',
            responseTime: Date.now() - start,
            message: 'Queue system check failed',
            details: error.message
          };
        }
      }
    });

    // Memory usage health check
    this.checks.push({
      name: 'Memory Usage',
      critical: false,
      check: async () => {
        const start = Date.now();
        const memoryUsage = process.memoryUsage();
        const responseTime = Date.now() - start;
        
        // Convert to MB
        const usedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
        const totalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
        const usage = (usedMB / totalMB) * 100;
        
        let status: 'healthy' | 'degraded' | 'unhealthy';
        if (usage < 70) {
          status = 'healthy';
        } else if (usage < 90) {
          status = 'degraded';
        } else {
          status = 'unhealthy';
        }
        
        return {
          status,
          responseTime,
          message: `${usedMB}MB / ${totalMB}MB (${Math.round(usage)}%)`,
          details: {
            heapUsed: usedMB,
            heapTotal: totalMB,
            usagePercent: Math.round(usage),
            external: Math.round(memoryUsage.external / 1024 / 1024),
            rss: Math.round(memoryUsage.rss / 1024 / 1024)
          }
        };
      }
    });

    // Disk usage health check (for logs)
    this.checks.push({
      name: 'Disk Usage',
      critical: false,
      check: async () => {
        const start = Date.now();
        try {
          const fs = await import('fs/promises');
          const path = await import('path');
          
          // Check logs directory size
          const logsDir = path.join(process.cwd(), 'logs');
          let logsDirSize = 0;
          
          try {
            const files = await fs.readdir(logsDir);
            for (const file of files) {
              const stat = await fs.stat(path.join(logsDir, file));
              logsDirSize += stat.size;
            }
          } catch (error) {
            // Logs directory might not exist yet
          }
          
          const logsSizeMB = Math.round(logsDirSize / 1024 / 1024);
          const responseTime = Date.now() - start;
          
          let status: 'healthy' | 'degraded' | 'unhealthy';
          if (logsSizeMB < 100) {
            status = 'healthy';
          } else if (logsSizeMB < 500) {
            status = 'degraded';
          } else {
            status = 'unhealthy';
          }
          
          return {
            status,
            responseTime,
            message: `Logs directory: ${logsSizeMB}MB`,
            details: {
              logsDirSize: logsSizeMB
            }
          };
        } catch (error: any) {
          return {
            status: 'degraded',
            responseTime: Date.now() - start,
            message: 'Could not check disk usage',
            details: error.message
          };
        }
      }
    });
  }

  async runHealthCheck(): Promise<HealthCheck> {
    const timestamp = new Date().toISOString();
    const uptime = Math.floor(process.uptime());
    const version = process.env.npm_package_version || '1.0.0';
    const environment = process.env.NODE_ENV || 'development';

    logger.info('🏥 Running comprehensive health check...');

    // Run all health checks in parallel
    const healthPromises = this.checks.map(async (check) => {
      try {
        const result = await check.check();
        return {
          name: check.name,
          critical: check.critical,
          ...result
        } as ServiceHealth;
      } catch (error: any) {
        return {
          name: check.name,
          critical: check.critical,
          status: 'unhealthy' as const,
          message: 'Health check failed',
          details: error.message
        } as ServiceHealth;
      }
    });

    const services = await Promise.all(healthPromises);

    // Calculate overall health status
    const criticalServices = services.filter(s => s.critical);
    const nonCriticalServices = services.filter(s => !s.critical);

    const criticalUnhealthy = criticalServices.filter(s => s.status === 'unhealthy').length;
    const criticalDegraded = criticalServices.filter(s => s.status === 'degraded').length;

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';

    if (criticalUnhealthy > 0) {
      overallStatus = 'unhealthy';
    } else if (criticalDegraded > 0 || nonCriticalServices.some(s => s.status === 'unhealthy')) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    // Summary statistics
    const summary = {
      total: services.length,
      healthy: services.filter(s => s.status === 'healthy').length,
      degraded: services.filter(s => s.status === 'degraded').length,
      unhealthy: services.filter(s => s.status === 'unhealthy').length
    };

    const healthCheck: HealthCheck = {
      status: overallStatus,
      timestamp,
      uptime,
      version,
      environment,
      services,
      summary
    };

    // Log summary
    const icon = overallStatus === 'healthy' ? '✅' : overallStatus === 'degraded' ? '⚠️' : '❌';
    logger.info(`${icon} Health check completed: ${overallStatus.toUpperCase()}`);
    logger.info(`   Summary: ${summary.healthy}H ${summary.degraded}D ${summary.unhealthy}U of ${summary.total} services`);

    return healthCheck;
  }

  async getQuickStatus(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; message: string }> {
    try {
      // Quick check - just test database and redis
      const quickChecks = this.checks.filter(c => c.critical).slice(0, 2);
      const results = await Promise.all(quickChecks.map(c => c.check()));
      
      const unhealthyCount = results.filter(r => r.status === 'unhealthy').length;
      const degradedCount = results.filter(r => r.status === 'degraded').length;
      
      if (unhealthyCount > 0) {
        return { status: 'unhealthy', message: 'Critical services unavailable' };
      } else if (degradedCount > 0) {
        return { status: 'degraded', message: 'Some services degraded' };
      } else {
        return { status: 'healthy', message: 'All critical services operational' };
      }
    } catch (error) {
      return { status: 'unhealthy', message: 'Health check failed' };
    }
  }
}

// Singleton instance
export const healthChecker = new HealthChecker();