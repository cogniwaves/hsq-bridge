/**
 * Jest Configuration for Configuration Management Tests
 * Comprehensive test configuration with coverage thresholds
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/../..'],
  testMatch: [
    // Unit tests
    '**/tests/unit/**/*.test.ts',
    '**/tests/unit/**/*.spec.ts',
    
    // Integration tests
    '**/tests/integration/**/*.test.ts',
    '**/tests/integration/**/*.spec.ts',
    
    // E2E tests
    '**/tests/e2e/**/*.test.ts',
    '**/tests/e2e/**/*.spec.ts',
    
    // Component tests
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx'
  ],
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: '<rootDir>/../../coverage',
  collectCoverageFrom: [
    // Backend coverage
    'src/**/*.ts',
    'src/**/*.tsx',
    
    // Specific focus on configuration features
    'src/services/configurationManager.ts',
    'src/routes/config.routes.ts',
    'src/middleware/configAuth.ts',
    'src/services/auth/tokenManager.ts',
    'src/services/auth/refreshScheduler.ts',
    'src/services/auth/tokenStorage.ts',
    
    // Exclude test files and types
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.d.ts',
    '!src/types/**',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**'
  ],
  
  // Coverage thresholds - Aiming for >80%
  coverageThresholds: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Specific thresholds for configuration components
    './src/services/configurationManager.ts': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/routes/config.routes.ts': {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './src/services/auth/tokenManager.ts': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js'
  ],
  
  // Module name mapping
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../../src/$1',
    '^@config/(.*)$': '<rootDir>/../../src/config/$1',
    '^@services/(.*)$': '<rootDir>/../../src/services/$1',
    '^@types/(.*)$': '<rootDir>/../../src/types/$1',
    '^@middleware/(.*)$': '<rootDir>/../../src/middleware/$1',
    '^@utils/(.*)$': '<rootDir>/../../src/utils/$1'
  },
  
  // Transform configuration
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }]
  },
  
  // Test timeouts
  testTimeout: 30000, // 30 seconds for E2E tests
  
  // Globals
  globals: {
    'ts-jest': {
      isolatedModules: true
    }
  },
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/.next/'
  ],
  
  // Coverage report formats
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json'
  ],
  
  // Verbose output
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks between tests
  restoreMocks: true,
  
  // Maximum worker threads
  maxWorkers: '50%',
  
  // Projects for parallel execution
  projects: [
    {
      displayName: 'Unit Tests',
      testMatch: ['**/tests/unit/**/*.test.ts']
    },
    {
      displayName: 'Integration Tests',
      testMatch: ['**/tests/integration/**/*.test.ts']
    },
    {
      displayName: 'E2E Tests',
      testMatch: ['**/tests/e2e/**/*.test.ts'],
      testTimeout: 60000 // Longer timeout for E2E
    }
  ],
  
  // Reporter configuration
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './coverage',
      outputName: 'junit.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }],
    ['jest-html-reporter', {
      pageTitle: 'Configuration Management Test Report',
      outputPath: './coverage/test-report.html',
      includeFailureMsg: true,
      includeConsoleLog: true,
      theme: 'darkTheme',
      dateFormat: 'yyyy-mm-dd HH:MM:ss'
    }]
  ]
};