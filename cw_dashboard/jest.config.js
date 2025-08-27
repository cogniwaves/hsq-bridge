/**
 * Jest Configuration for HSQ Bridge Dashboard Navigation Testing
 * Comprehensive setup for unit, integration, accessibility, and performance tests
 */

const nextJest = require('next/jest');

// Create Jest config preset for Next.js
const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
});

// Custom Jest configuration
const customJestConfig = {
  // Test environment
  testEnvironment: 'jsdom',

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/src/__tests__/setup/jest.setup.ts',
    '<rootDir>/src/__tests__/setup/mocks.setup.ts'
  ],

  // Test patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.(test|spec).{js,jsx,ts,tsx}'
  ],

  // Path mapping (matches tsconfig.json paths)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@/contexts/(.*)$': '<rootDir>/src/contexts/$1',
    '^@/utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@/types/(.*)$': '<rootDir>/src/types/$1',
    '^@/design-system/(.*)$': '<rootDir>/src/design-system/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/src/__tests__/mocks/fileMock.js',
  },

  // Transform configuration
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Coverage configuration
  collectCoverageFrom: [
    'src/components/navigation/**/*.{js,jsx,ts,tsx}',
    'src/hooks/use*Navigation*.{js,jsx,ts,tsx}',
    'src/contexts/*Navigation*.{js,jsx,ts,tsx}',
    'src/utils/navigation*.{js,jsx,ts,tsx}',
    'src/utils/gestures.{js,jsx,ts,tsx}',
    'src/utils/animations.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/node_modules/**',
  ],

  // Coverage thresholds (80% minimum as specified)
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './src/components/navigation/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },

  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],

  // Test timeout
  testTimeout: 10000,

  // Globals for jsdom environment
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },


  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Verbose output for debugging
  verbose: false,

  // Ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/src/__tests__/setup/',
    '<rootDir>/src/__tests__/mocks/',
    '<rootDir>/src/__tests__/fixtures/',
    '<rootDir>/src/__tests__/utils/',
  ],

  // Watch plugins for interactive mode (commented out - install if needed)
  // watchPlugins: [
  //   'jest-watch-typeahead/filename',
  //   'jest-watch-typeahead/testname',
  // ],

  // Additional configuration for different test types
  projects: [
    // Unit tests
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/__tests__/unit/**/*.test.{js,jsx,ts,tsx}'],
      testEnvironment: 'jsdom',
    },
    // Integration tests
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/src/**/__tests__/integration/**/*.test.{js,jsx,ts,tsx}'],
      testEnvironment: 'jsdom',
    },
    // Accessibility tests
    {
      displayName: 'accessibility',
      testMatch: ['<rootDir>/src/**/__tests__/accessibility/**/*.test.{js,jsx,ts,tsx}'],
      testEnvironment: 'jsdom',
    },
    // Performance tests
    {
      displayName: 'performance',
      testMatch: ['<rootDir>/src/**/__tests__/performance/**/*.test.{js,jsx,ts,tsx}'],
      testEnvironment: 'jsdom',
      testTimeout: 30000, // Longer timeout for performance tests
    },
  ],
};

// Export the Jest configuration
module.exports = createJestConfig(customJestConfig);