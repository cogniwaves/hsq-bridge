import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists - handle Docker permission issues
const logsDir = process.env.NODE_ENV === 'production' || process.env.DOCKER_ENV ? 
  '/tmp/logs' : 
  path.join(process.cwd(), 'logs');

try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
} catch (error) {
  // Fallback to console only if logs directory cannot be created
  console.warn('Cannot create logs directory, falling back to console-only logging:', error.message);
}

// Custom format for better readability
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
  winston.format.printf(({ level, message, timestamp, metadata, stack }) => {
    let logMessage = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // Add metadata if present
    if (metadata && Object.keys(metadata).length > 0) {
      logMessage += ` | ${JSON.stringify(metadata)}`;
    }
    
    // Add stack trace for errors
    if (stack) {
      logMessage += `\n${stack}`;
    }
    
    return logMessage;
  })
);

// Console format with colors for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    let logMessage = `${timestamp} ${level}: ${message}`;
    if (stack) logMessage += `\n${stack}`;
    return logMessage;
  })
);

// File rotation configuration
const fileRotationOptions = {
  maxSize: '20m',
  maxFiles: '14d',
  datePattern: 'YYYY-MM-DD'
};

// Create transports array, with file transports only if logs directory exists
const transports: winston.transport[] = [
  // Console output (always available)
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production' ? 
      winston.format.combine(winston.format.json()) : consoleFormat,
    silent: process.env.NODE_ENV === 'test'
  })
];

// Add file transports only if logs directory exists and is writable
try {
  if (fs.existsSync(logsDir)) {
    transports.push(
      // Error logs (all errors)
      new winston.transports.File({
        filename: path.join(logsDir, 'error.log'),
        level: 'error',
        format: winston.format.combine(
          customFormat,
          winston.format.json()
        ),
        handleExceptions: true,
        handleRejections: true
      }),

      // Combined logs (everything)
      new winston.transports.File({
        filename: path.join(logsDir, 'combined.log'),
        format: winston.format.combine(
          customFormat,
          winston.format.json()
        ),
        maxsize: 50 * 1024 * 1024, // 50MB
        maxFiles: 5
      }),

      // Application logs (info and above, excluding debug)
      new winston.transports.File({
        filename: path.join(logsDir, 'app.log'),
        level: 'info',
        format: customFormat,
        maxsize: 20 * 1024 * 1024, // 20MB
        maxFiles: 10
      })
    );
  }
} catch (error) {
  console.warn('File logging disabled due to permission issues:', error.message);
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { 
    service: 'hs-bridge',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  },
  transports,

  // Handle uncaught exceptions - only add if logs directory exists
  exceptionHandlers: fs.existsSync(logsDir) ? [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ] : [],

  // Handle unhandled promise rejections - only add if logs directory exists
  rejectionHandlers: fs.existsSync(logsDir) ? [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ] : []
});

// Production-specific transports - only if logs directory exists
if (process.env.NODE_ENV === 'production' && fs.existsSync(logsDir)) {
  try {
    // Add audit log for production
    logger.add(new winston.transports.File({
      filename: path.join(logsDir, 'audit.log'),
      level: 'warn',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }));

    // Performance logs
    logger.add(new winston.transports.File({
      filename: path.join(logsDir, 'performance.log'),
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
        winston.format.logstash()
      )
    }));
  } catch (error) {
    console.warn('Could not add production log files:', error.message);
  }
}

// Specialized loggers for different components
export const createSubLogger = (component: string) => {
  return logger.child({ component });
};

// Pre-configured component loggers
export const apiLogger = createSubLogger('API');
export const webhookLogger = createSubLogger('WEBHOOK');
export const syncLogger = createSubLogger('SYNC');
export const queueLogger = createSubLogger('QUEUE');
export const dbLogger = createSubLogger('DATABASE');

// Performance timing utility
export class PerformanceTimer {
  private startTime: number;
  private component: string;
  private operation: string;

  constructor(component: string, operation: string) {
    this.component = component;
    this.operation = operation;
    this.startTime = Date.now();
    logger.debug(`⏱️ Starting ${component}::${operation}`);
  }

  end(metadata?: any): number {
    const duration = Date.now() - this.startTime;
    
    const logLevel = duration > 5000 ? 'warn' : duration > 1000 ? 'info' : 'debug';
    const emoji = duration > 5000 ? '🐌' : duration > 1000 ? '⏳' : '⚡';
    
    logger.log(logLevel, `${emoji} ${this.component}::${this.operation} completed in ${duration}ms`, {
      component: this.component,
      operation: this.operation,
      duration,
      ...metadata
    });

    return duration;
  }
}

// Audit logging for important operations
export const auditLog = (
  action: string, 
  resource: string, 
  user: string | null = null, 
  metadata?: any
) => {
  logger.warn('📋 AUDIT', {
    action,
    resource,
    user: user || 'system',
    timestamp: new Date().toISOString(),
    ...metadata
  });
};

// Security logging
export const securityLog = (
  event: string, 
  severity: 'low' | 'medium' | 'high' | 'critical',
  details?: any
) => {
  const emoji = {
    low: '🔵',
    medium: '🟡',
    high: '🟠',
    critical: '🔴'
  }[severity];

  logger.warn(`${emoji} SECURITY [${severity.toUpperCase()}]: ${event}`, {
    securityEvent: true,
    severity,
    ...details
  });
};

// Business logic logging
export const businessLog = (
  event: string,
  entityType: 'invoice' | 'payment' | 'sync',
  entityId: string,
  metadata?: any
) => {
  logger.info(`💼 BUSINESS: ${event}`, {
    businessEvent: true,
    entityType,
    entityId,
    ...metadata
  });
};

// Error context logger for better debugging
export const logErrorWithContext = (
  error: Error,
  context: {
    operation?: string;
    component?: string;
    userId?: string;
    requestId?: string;
    data?: any;
  }
) => {
  logger.error('❌ ERROR WITH CONTEXT', {
    message: error.message,
    stack: error.stack,
    name: error.name,
    ...context,
    timestamp: new Date().toISOString()
  });
};

// Log startup information
export const logStartupInfo = () => {
  logger.info('🚀 Application starting up', {
    nodeVersion: process.version,
    platform: process.platform,
    environment: process.env.NODE_ENV,
    memoryUsage: process.memoryUsage(),
    pid: process.pid
  });
};