import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  
  // Database
  DATABASE_URL: z.string().url(),
  
  // Redis
  REDIS_URL: z.string().url(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  
  // Security
  WEBHOOK_SECRET: z.string().min(32, 'Webhook secret must be at least 32 characters'),
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters').optional(),
  
  // HubSpot
  HUBSPOT_API_KEY: z.string().min(1, 'HubSpot API key is required'),
  HUBSPOT_CLIENT_ID: z.string().optional(),
  HUBSPOT_CLIENT_SECRET: z.string().optional(),
  HUBSPOT_WEBHOOK_SECRET: z.string().optional(),
  
  // Stripe (optional in development)
  STRIPE_SECRET_KEY: z.string().regex(/^sk_(test_|live_)/, 'Invalid Stripe secret key format').optional().or(z.literal('')),
  STRIPE_PUBLISHABLE_KEY: z.string().regex(/^pk_(test_|live_)/, 'Invalid Stripe publishable key format').optional().or(z.literal('')),
  STRIPE_WEBHOOK_SECRET: z.string().regex(/^whsec_/, 'Invalid Stripe webhook secret format').optional().or(z.literal('')),
  
  // QuickBooks (optional in development)
  QUICKBOOKS_CLIENT_ID: z.string().min(1, 'QuickBooks client ID is required').optional().or(z.literal('')),
  QUICKBOOKS_CLIENT_SECRET: z.string().min(1, 'QuickBooks client secret is required').optional().or(z.literal('')),
  QUICKBOOKS_COMPANY_ID: z.string().optional().or(z.literal('')),
  QUICKBOOKS_ACCESS_TOKEN: z.string().optional().or(z.literal('')),
  QUICKBOOKS_REFRESH_TOKEN: z.string().optional().or(z.literal('')),
  QUICKBOOKS_SANDBOX_BASE_URL: z.string().url().default('https://sandbox-quickbooks.api.intuit.com'),
  QUICKBOOKS_DISCOVERY_DOCUMENT: z.string().url().default('https://appcenter.intuit.com/api/v1'),
  QUICKBOOKS_WEBHOOK_SECRET: z.string().optional(),
  
  // External URLs
  CORS_ORIGIN: z.string().default('http://localhost:13001'),
  BASE_URL: z.string().url().default('http://localhost:3000'),
  
  // Features flags
  PROMETHEUS_ENABLED: z.string().transform(val => val === 'true').default('false'),
  DEBUG_MODE: z.string().transform(val => val === 'true').default('false'),
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
});

export type Config = z.infer<typeof configSchema>;

let config: Config;

export function initializeConfig(): Config {
  try {
    config = configSchema.parse(process.env);
    
    // Validate environment-specific requirements
    if (config.NODE_ENV === 'production') {
      validateProductionConfig(config);
    } else {
      // In development, warn about missing optional services
      logDevelopmentWarnings(config);
    }
    
    return config;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Configuration validation failed:');
      error.errors.forEach(err => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
    } else {
      console.error('❌ Configuration error:', error);
    }
    process.exit(1);
  }
}

function validateProductionConfig(config: Config) {
  const productionRequirements = [
    { field: 'WEBHOOK_SECRET', value: config.WEBHOOK_SECRET },
    { field: 'STRIPE_WEBHOOK_SECRET', value: config.STRIPE_WEBHOOK_SECRET },
    { field: 'HUBSPOT_WEBHOOK_SECRET', value: config.HUBSPOT_WEBHOOK_SECRET }
  ];

  const missingFields = productionRequirements.filter(req => !req.value);
  
  if (missingFields.length > 0) {
    console.error('❌ Production environment requires these fields:');
    missingFields.forEach(field => {
      console.error(`  - ${field.field}`);
    });
    process.exit(1);
  }

  // Validate Stripe keys are for production
  if (config.STRIPE_SECRET_KEY && !config.STRIPE_SECRET_KEY.startsWith('sk_live_')) {
    console.warn('⚠️  Using test Stripe keys in production environment');
  }
}

function logDevelopmentWarnings(config: Config) {
  const missingServices = [];
  
  if (!config.STRIPE_SECRET_KEY) {
    missingServices.push('Stripe');
  }
  
  if (!config.QUICKBOOKS_CLIENT_ID || !config.QUICKBOOKS_CLIENT_SECRET) {
    missingServices.push('QuickBooks');
  }
  
  if (missingServices.length > 0) {
    console.warn(`⚠️  Development mode: ${missingServices.join(', ')} integration(s) disabled (missing credentials)`);
    console.warn('   Phase 1 focuses on HubSpot extraction - other services will be configured later');
  }
}

export function getConfig(): Config {
  if (!config) {
    throw new Error('Configuration not initialized. Call initializeConfig() first.');
  }
  return config;
}

// Export individual config sections for convenience
export const getDatabaseConfig = () => ({
  url: getConfig().DATABASE_URL
});

export const getRedisConfig = () => {
  const cfg = getConfig();
  return cfg.REDIS_URL; // Return URL string directly to avoid host/port override
};

export const getHubSpotConfig = () => {
  const cfg = getConfig();
  return {
    apiKey: cfg.HUBSPOT_API_KEY,
    clientId: cfg.HUBSPOT_CLIENT_ID,
    clientSecret: cfg.HUBSPOT_CLIENT_SECRET,
    webhookSecret: cfg.HUBSPOT_WEBHOOK_SECRET
  };
};

export const getStripeConfig = () => {
  const cfg = getConfig();
  return {
    secretKey: cfg.STRIPE_SECRET_KEY,
    publishableKey: cfg.STRIPE_PUBLISHABLE_KEY,
    webhookSecret: cfg.STRIPE_WEBHOOK_SECRET
  };
};

export const getQuickBooksConfig = () => {
  const cfg = getConfig();
  return {
    clientId: cfg.QUICKBOOKS_CLIENT_ID,
    clientSecret: cfg.QUICKBOOKS_CLIENT_SECRET,
    companyId: cfg.QUICKBOOKS_COMPANY_ID,
    accessToken: cfg.QUICKBOOKS_ACCESS_TOKEN,
    refreshToken: cfg.QUICKBOOKS_REFRESH_TOKEN,
    sandboxBaseUrl: cfg.QUICKBOOKS_SANDBOX_BASE_URL,
    discoveryDocument: cfg.QUICKBOOKS_DISCOVERY_DOCUMENT,
    webhookSecret: cfg.QUICKBOOKS_WEBHOOK_SECRET
  };
};