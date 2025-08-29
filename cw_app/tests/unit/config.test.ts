describe('Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Clear the module cache before each test
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('initializeConfig', () => {
    it('should initialize with valid environment variables', () => {
      // Import fresh config module for this test
      const { initializeConfig } = require('../../src/config');
      
      process.env = {
        ...originalEnv,
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        REDIS_URL: 'redis://localhost:6379',
        WEBHOOK_SECRET: 'test_webhook_secret_32_chars_long',
        HUBSPOT_API_KEY: 'test_hubspot_key',
        STRIPE_SECRET_KEY: 'sk_test_valid_stripe_key',
        STRIPE_PUBLISHABLE_KEY: 'pk_test_valid_stripe_key',
        STRIPE_WEBHOOK_SECRET: 'whsec_valid_webhook_secret',
        QUICKBOOKS_CLIENT_ID: 'test_qb_client_id',
        QUICKBOOKS_CLIENT_SECRET: 'test_qb_client_secret'
      };

      const config = initializeConfig();

      expect(config.NODE_ENV).toBe('test');
      expect(config.DATABASE_URL).toBe('postgresql://test:test@localhost:5432/test');
      expect(config.HUBSPOT_API_KEY).toBe('test_hubspot_key');
      expect(config.STRIPE_SECRET_KEY).toBe('sk_test_valid_stripe_key');
    });

    it('should fail with invalid Stripe secret key format', () => {
      // Import fresh config module for this test
      const { initializeConfig } = require('../../src/config');
      
      process.env = {
        ...originalEnv,
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        REDIS_URL: 'redis://localhost:6379',
        WEBHOOK_SECRET: 'test_webhook_secret_32_chars_long',
        HUBSPOT_API_KEY: 'test_hubspot_key',
        STRIPE_SECRET_KEY: 'invalid_stripe_key_format',
        STRIPE_PUBLISHABLE_KEY: 'pk_test_valid_stripe_key',
        STRIPE_WEBHOOK_SECRET: 'whsec_valid_webhook_secret',
        QUICKBOOKS_CLIENT_ID: 'test_qb_client_id',
        QUICKBOOKS_CLIENT_SECRET: 'test_qb_client_secret'
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process.exit called');
      });

      expect(() => initializeConfig()).toThrow('Process.exit called');
      expect(consoleSpy).toHaveBeenCalledWith('❌ Configuration validation failed:');
      expect(exitSpy).toHaveBeenCalledWith(1);

      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it('should fail with short WEBHOOK_SECRET', () => {
      // Import fresh config module for this test
      const { initializeConfig } = require('../../src/config');
      
      process.env = {
        ...originalEnv,
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        REDIS_URL: 'redis://localhost:6379',
        WEBHOOK_SECRET: 'too_short', // Less than 32 characters
        HUBSPOT_API_KEY: 'test_hubspot_key',
        STRIPE_SECRET_KEY: 'sk_test_valid_stripe_key',
        STRIPE_PUBLISHABLE_KEY: 'pk_test_valid_stripe_key',
        STRIPE_WEBHOOK_SECRET: 'whsec_valid_webhook_secret',
        QUICKBOOKS_CLIENT_ID: 'test_qb_client_id',
        QUICKBOOKS_CLIENT_SECRET: 'test_qb_client_secret'
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process.exit called');
      });

      expect(() => initializeConfig()).toThrow('Process.exit called');
      expect(consoleSpy).toHaveBeenCalledWith('❌ Configuration validation failed:');
      expect(exitSpy).toHaveBeenCalledWith(1);

      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it('should use default values for optional fields', () => {
      // Import fresh config module for this test
      const { initializeConfig } = require('../../src/config');
      
      process.env = {
        ...originalEnv,
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        REDIS_URL: 'redis://localhost:6379',
        WEBHOOK_SECRET: 'test_webhook_secret_32_chars_long',
        HUBSPOT_API_KEY: 'test_hubspot_key',
        STRIPE_SECRET_KEY: 'sk_test_valid_stripe_key',
        STRIPE_PUBLISHABLE_KEY: 'pk_test_valid_stripe_key',
        STRIPE_WEBHOOK_SECRET: 'whsec_valid_webhook_secret',
        QUICKBOOKS_CLIENT_ID: 'test_qb_client_id',
        QUICKBOOKS_CLIENT_SECRET: 'test_qb_client_secret'
        // Not setting optional fields
      };

      const config = initializeConfig();

      expect(config.PORT).toBe(3000); // Default
      expect(config.LOG_LEVEL).toBe('info'); // Default
      expect(config.CORS_ORIGIN).toBe('http://localhost:13001'); // Default - Updated to match actual config
      expect(config.PROMETHEUS_ENABLED).toBe(false); // Default
    });
  });

  describe('getConfig', () => {
    it('should return config after initialization', () => {
      // Import fresh config module for this test
      const { initializeConfig, getConfig } = require('../../src/config');
      
      process.env = {
        ...originalEnv,
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        REDIS_URL: 'redis://localhost:6379',
        WEBHOOK_SECRET: 'test_webhook_secret_32_chars_long',
        HUBSPOT_API_KEY: 'test_hubspot_key',
        STRIPE_SECRET_KEY: 'sk_test_valid_stripe_key',
        STRIPE_PUBLISHABLE_KEY: 'pk_test_valid_stripe_key',
        STRIPE_WEBHOOK_SECRET: 'whsec_valid_webhook_secret',
        QUICKBOOKS_CLIENT_ID: 'test_qb_client_id',
        QUICKBOOKS_CLIENT_SECRET: 'test_qb_client_secret'
      };

      const config = initializeConfig();
      const retrievedConfig = getConfig();

      expect(retrievedConfig).toBe(config);
      expect(retrievedConfig.NODE_ENV).toBe('test');
    });

    it('should throw error if config not initialized', () => {
      // Mock the module to reset config state
      jest.resetModules();
      const { getConfig: freshGetConfig } = require('../../src/config');

      expect(() => freshGetConfig()).toThrow(
        'Configuration not initialized. Call initializeConfig() first.'
      );
    });
  });
});