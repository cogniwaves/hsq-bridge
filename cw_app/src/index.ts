import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import { initializeConfig, getConfig } from './config';
import { logger, logStartupInfo } from './utils/logger';
import { logConnectivityReport } from './utils/connectivity';
import { setupMonitoring } from './utils/monitoring';
import { errorHandler } from './utils/errorHandler';
import { apiRoutes } from './api';
import { initializeWorkers } from './workers';

// Initialize configuration first
const config = initializeConfig();
logger.info('✅ Configuration loaded and validated');

// Log startup information
logStartupInfo();

const app = express();

// Database
export const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: config.CORS_ORIGIN,
  credentials: true,
}));

// Raw body parsing for webhooks (needed for signature verification)
app.use('/api/webhooks', express.raw({ type: 'application/json', limit: '10mb' }));

// Regular JSON parsing for other routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Setup monitoring and metrics
setupMonitoring(app);

// Health check endpoints
app.get('/health', async (req, res) => {
  try {
    const { healthChecker } = await import('./utils/health');
    const quickStatus = await healthChecker.getQuickStatus();
    
    const statusCode = quickStatus.status === 'healthy' ? 200 : 
                      quickStatus.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json({
      status: quickStatus.status,
      message: quickStatus.message,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: config.NODE_ENV === 'production' ? 'hidden' : '1.0.0'
    });
  } catch (error: unknown) {
    res.status(503).json({
      status: 'unhealthy',
      message: 'Health check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/health/detailed', async (req, res) => {
  try {
    const { healthChecker } = await import('./utils/health');
    const healthCheck = await healthChecker.runHealthCheck();
    
    const statusCode = healthCheck.status === 'healthy' ? 200 : 
                      healthCheck.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(healthCheck);
  } catch (error: unknown) {
    res.status(503).json({
      status: 'unhealthy',
      message: 'Detailed health check failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// API routes
app.use('/api', apiRoutes);

// Error handling
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('✅ Database connected successfully');
    
    // Test connectivity to all external services - temporarily disabled  
    // await logConnectivityReport();
    logger.info('✅ Connectivity check skipped (testing mode)');

    // Initialize workers - temporarily disabled
    // await initializeWorkers();
    logger.info('✅ Workers initialization skipped (testing mode)');

    app.listen(config.PORT, () => {
      logger.info(`Server running on port ${config.PORT}`);
      logger.info(`Environment: ${config.NODE_ENV}`);
      logger.info('🚀 HubSpot Bridge API ready for testing');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

startServer();