/**
 * Simplified Jest Setup File for Navigation Testing
 */

import '@testing-library/jest-dom';

// Mock window.matchMedia for responsive testing
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor(cb: ResizeObserverCallback) {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor(cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {}
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] { return []; }
};

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 16));
global.cancelAnimationFrame = jest.fn((id) => clearTimeout(id));

// Global test utilities
global.testUtils = {
  createMockUser: (overrides = {}) => ({
    userId: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User',
    accessToken: 'mock-access-token',
    isEmailConfirmed: true,
    hasPassword: true,
    mode: 'test',
    tenantId: 'test-tenant-123',
    ...overrides,
  }),

  createMockNavigationConfig: (overrides = {}) => ({
    sections: [
      {
        id: 'main',
        title: 'Main',
        items: [
          { id: 'dashboard', label: 'Dashboard', icon: 'home', href: '/' },
          { id: 'invoices', label: 'Invoices', icon: 'document-text', href: '/invoices' },
          { id: 'payments', label: 'Payments', icon: 'currency-dollar', href: '/payments' },
        ],
      },
    ],
    footer: {
      id: 'footer',
      items: [
        { id: 'settings', label: 'Settings', icon: 'cog', href: '/settings' },
        { id: 'profile', label: 'Profile', icon: 'user', href: '/profile' },
      ],
    },
    ...overrides,
  }),

  mockViewport: (width: number, height: number) => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: height,
    });
    window.dispatchEvent(new Event('resize'));
  },

  waitForAnimation: () => new Promise(resolve => requestAnimationFrame(resolve)),
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
  global.testUtils.mockViewport(1024, 768);
});

afterEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});