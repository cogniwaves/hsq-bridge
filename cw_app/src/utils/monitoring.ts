import { logger, PerformanceTimer } from './logger';
import { Express, Request, Response, NextFunction } from 'express';

// Request tracking and metrics
interface RequestMetrics {
  totalRequests: number;
  requestsByMethod: Record<string, number>;
  requestsByEndpoint: Record<string, number>;
  requestsByStatus: Record<string, number>;
  averageResponseTime: number;
  errorRate: number;
  responseTimeP95: number[];
  lastReset: Date;
}

class MetricsCollector {
  private metrics: RequestMetrics = {
    totalRequests: 0,
    requestsByMethod: {},
    requestsByEndpoint: {},
    requestsByStatus: {},
    averageResponseTime: 0,
    errorRate: 0,
    responseTimeP95: [],
    lastReset: new Date()
  };

  private responseTimes: number[] = [];
  private readonly MAX_RESPONSE_TIMES = 1000; // Keep last 1000 response times

  recordRequest(
    method: string,
    endpoint: string,
    statusCode: number,
    responseTime: number
  ) {
    this.metrics.totalRequests++;
    this.metrics.requestsByMethod[method] = (this.metrics.requestsByMethod[method] || 0) + 1;
    this.metrics.requestsByEndpoint[endpoint] = (this.metrics.requestsByEndpoint[endpoint] || 0) + 1;
    this.metrics.requestsByStatus[statusCode.toString()] = (this.metrics.requestsByStatus[statusCode.toString()] || 0) + 1;

    // Track response times
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > this.MAX_RESPONSE_TIMES) {
      this.responseTimes.shift();
    }

    // Update average response time
    this.metrics.averageResponseTime = 
      this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;

    // Update error rate
    const errorRequests = Object.entries(this.metrics.requestsByStatus)
      .filter(([status]) => parseInt(status) >= 400)
      .reduce((sum, [, count]) => sum + count, 0);
    this.metrics.errorRate = (errorRequests / this.metrics.totalRequests) * 100;

    // Update P95
    if (this.responseTimes.length >= 20) {
      const sorted = [...this.responseTimes].sort((a, b) => a - b);
      const p95Index = Math.ceil(sorted.length * 0.95) - 1;
      this.metrics.responseTimeP95 = [sorted[p95Index]];
    }
  }

  getMetrics(): RequestMetrics {
    return { ...this.metrics };
  }

  reset() {
    this.metrics = {
      totalRequests: 0,
      requestsByMethod: {},
      requestsByEndpoint: {},
      requestsByStatus: {},
      averageResponseTime: 0,
      errorRate: 0,
      responseTimeP95: [],
      lastReset: new Date()
    };
    this.responseTimes = [];
  }

  getTopEndpoints(limit = 10) {
    return Object.entries(this.metrics.requestsByEndpoint)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit);
  }

  getSlowestEndpoints(limit = 10) {
    // This would require more detailed tracking per endpoint
    // For now, return top endpoints by request count
    return this.getTopEndpoints(limit);
  }
}

export const metricsCollector = new MetricsCollector();

// Express middleware for request/response monitoring
export const monitoringMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const timer = new PerformanceTimer('HTTP', `${req.method} ${req.path}`);
  const startTime = Date.now();

  // Add request ID for tracing
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  req.headers['x-request-id'] = requestId;

  // Log request details
  logger.info(`🌐 ${req.method} ${req.path}`, {
    requestId,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    query: req.query,
    bodySize: req.get('content-length') || 0
  });

  // Override res.end to capture response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any, cb?: any) {
    const responseTime = Date.now() - startTime;
    
    // Record metrics
    const endpoint = req.route?.path || req.path;
    metricsCollector.recordRequest(req.method, endpoint, res.statusCode, responseTime);
    
    // Log response
    const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    const emoji = res.statusCode >= 500 ? '🔥' : res.statusCode >= 400 ? '⚠️' : '✅';
    
    logger[logLevel](`${emoji} ${req.method} ${req.path} ${res.statusCode}`, {
      requestId,
      statusCode: res.statusCode,
      responseTime,
      responseSize: res.get('content-length') || (chunk ? chunk.length : 0)
    });

    // End performance timer
    timer.end({
      statusCode: res.statusCode,
      requestId
    });

    // Call original end
    originalEnd.call(this, chunk, encoding, cb);
  };

  next();
};

// Error monitoring middleware
export const errorMonitoringMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requestId = req.headers['x-request-id'] as string;
  
  logger.error(`💥 Unhandled error in ${req.method} ${req.path}`, {
    requestId,
    error: error.message,
    stack: error.stack,
    method: req.method,
    url: req.originalUrl,
    body: req.body,
    query: req.query,
    headers: req.headers
  });

  // Track error in metrics
  metricsCollector.recordRequest(req.method, req.path, 500, Date.now());

  next(error);
};

// System monitoring utilities
export class SystemMonitor {
  private intervals: NodeJS.Timeout[] = [];
  private isRunning = false;

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    logger.info('📊 Starting system monitoring...');

    // Memory monitoring (every 30 seconds)
    const memoryInterval = setInterval(() => {
      const usage = process.memoryUsage();
      const usedMB = Math.round(usage.heapUsed / 1024 / 1024);
      const totalMB = Math.round(usage.heapTotal / 1024 / 1024);
      const percentage = Math.round((usage.heapUsed / usage.heapTotal) * 100);

      if (percentage > 85) {
        logger.warn(`🚨 High memory usage: ${usedMB}MB (${percentage}%)`, {
          memoryUsage: usage,
          percentage
        });
      } else if (percentage > 70) {
        logger.info(`📊 Memory usage: ${usedMB}MB (${percentage}%)`, {
          memoryUsage: usage,
          percentage
        });
      }
    }, 30000);

    // Request metrics logging (every 5 minutes)
    const metricsInterval = setInterval(() => {
      const metrics = metricsCollector.getMetrics();
      
      if (metrics.totalRequests > 0) {
        logger.info('📈 Request metrics summary', {
          totalRequests: metrics.totalRequests,
          averageResponseTime: Math.round(metrics.averageResponseTime),
          errorRate: Math.round(metrics.errorRate * 100) / 100,
          topEndpoints: metricsCollector.getTopEndpoints(5)
        });
      }
    }, 5 * 60 * 1000);

    // Health check logging (every 10 minutes)
    const healthInterval = setInterval(async () => {
      try {
        const { healthChecker } = await import('./health');
        const health = await healthChecker.getQuickStatus();
        
        if (health.status !== 'healthy') {
          logger.warn(`🏥 Health check: ${health.status} - ${health.message}`);
        } else {
          logger.debug(`🏥 Health check: ${health.status}`);
        }
      } catch (error) {
        logger.error('Failed to run health check:', error);
      }
    }, 10 * 60 * 1000);

    // Cleanup old logs (every hour)
    const cleanupInterval = setInterval(() => {
      this.cleanupOldLogs();
    }, 60 * 60 * 1000);

    this.intervals.push(memoryInterval, metricsInterval, healthInterval, cleanupInterval);
  }

  stop() {
    if (!this.isRunning) return;
    
    logger.info('📊 Stopping system monitoring...');
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    this.isRunning = false;
  }

  private async cleanupOldLogs() {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const logsDir = path.join(process.cwd(), 'logs');
      const files = await fs.readdir(logsDir);
      const now = Date.now();
      const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days

      let cleanedCount = 0;
      
      for (const file of files) {
        const filePath = path.join(logsDir, file);
        const stat = await fs.stat(filePath);
        
        if (now - stat.mtime.getTime() > maxAge) {
          await fs.unlink(filePath);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        logger.info(`🧹 Cleaned up ${cleanedCount} old log files`);
      }
    } catch (error) {
      logger.warn('Failed to cleanup old logs:', error);
    }
  }
}

export const systemMonitor = new SystemMonitor();

// Webhook monitoring utilities
export const trackWebhookEvent = (
  platform: string,
  eventType: string,
  success: boolean,
  responseTime?: number,
  error?: string
) => {
  const emoji = success ? '✅' : '❌';
  const logLevel = success ? 'info' : 'error';
  
  logger[logLevel](`${emoji} Webhook ${platform}:${eventType}`, {
    platform,
    eventType,
    success,
    responseTime,
    error,
    webhookEvent: true
  });
};

// Queue monitoring utilities
export const trackQueueJob = (
  queueName: string,
  jobType: string,
  jobId: string,
  status: 'started' | 'completed' | 'failed',
  duration?: number,
  error?: string
) => {
  const emoji = {
    started: '🔄',
    completed: '✅',
    failed: '❌'
  }[status];

  const logLevel = status === 'failed' ? 'error' : 'info';
  
  logger[logLevel](`${emoji} Queue ${queueName}:${jobType} [${jobId}]`, {
    queueName,
    jobType,
    jobId,
    status,
    duration,
    error,
    queueEvent: true
  });
};

// Database monitoring utilities
export const trackDatabaseQuery = (
  query: string,
  duration: number,
  success: boolean,
  error?: string
) => {
  const emoji = success ? '✅' : '❌';
  const logLevel = success ? (duration > 1000 ? 'warn' : 'debug') : 'error';
  
  logger[logLevel](`${emoji} DB Query (${duration}ms)`, {
    query: query.substring(0, 100), // Truncate long queries
    duration,
    success,
    error,
    databaseEvent: true
  });
};

// Setup monitoring for Express app
export const setupMonitoring = (app: Express) => {
  // Add monitoring middleware
  app.use(monitoringMiddleware);
  
  // Add error monitoring (after other middlewares)
  app.use(errorMonitoringMiddleware);
  
  // Start system monitoring
  systemMonitor.start();
  
  logger.info('📊 Monitoring setup completed');
};