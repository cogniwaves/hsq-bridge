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
    '<rootDir>/src/__tests__/setup/jest.setup.ts'
  ],

  // Test patterns (simplified to avoid conflicts)
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

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Transform configuration
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', {
      presets: [
        ['next/babel', {
          'preset-typescript': {
            allowNamespaces: true
          }
        }]
      ]
    }]
  },

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

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    }
  },

  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],

  // Global timeout
  testTimeout: 10000,

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

  // Transform ignore patterns for node_modules
  transformIgnorePatterns: [
    '/node_modules/(?!((@userfront/react|@userfront/core|@headlessui/react|@heroicons/react)/.*))/'
  ],

  // Extensions to consider
  extensionsToTreatAsEsm: ['.ts', '.tsx'],

  // Globals for modern JS/TS support
  globals: {
    'ts-jest': {
      useESM: true,
      tsconfig: {
        jsx: 'react-jsx'
      }
    }
  }
};

// Export the Jest configuration
module.exports = createJestConfig(customJestConfig);