/**
 * Jest Setup File
 * Global test configuration and utilities for navigation testing
 */

import '@testing-library/jest-dom';
import 'jest-axe/extend-expect';
import 'resize-observer-polyfill/lib/ResizeObserver.global';
import 'intersection-observer';

// Mock Next.js router
import { jest } from '@jest/globals';

// Mock window.matchMedia for responsive testing
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver for responsive testing
global.ResizeObserver = global.ResizeObserver || class ResizeObserver {
  constructor(cb: ResizeObserverCallback) {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock IntersectionObserver for scroll-based testing
global.IntersectionObserver = global.IntersectionObserver || class IntersectionObserver {
  constructor(cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {}
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] { return []; }
};

// Mock CSS Custom Properties support
Object.defineProperty(window, 'CSS', {
  value: {
    supports: jest.fn().mockReturnValue(true),
  },
});

// Mock getComputedStyle for CSS testing
const originalGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = jest.fn().mockImplementation((element) => {
  return {
    ...originalGetComputedStyle(element),
    getPropertyValue: jest.fn((prop) => {
      // Mock navigation CSS custom properties
      const mockValues: Record<string, string> = {
        '--nav-width-rail': '80px',
        '--nav-width-drawer': '280px',
        '--nav-width-modal': '320px',
        '--nav-rail-bg': '#ffffff',
        '--nav-drawer-bg': '#f8f9fa',
        '--nav-modal-bg': '#ffffff',
        '--nav-item-default-bg': 'transparent',
        '--nav-item-hover-bg': '#f1f3f4',
        '--nav-item-active-bg': '#e8f0fe',
        '--nav-transition-duration': '300ms',
        '--nav-transition-easing': 'cubic-bezier(0.4, 0.0, 0.2, 1)',
      };
      return mockValues[prop] || '';
    }),
  };
});

// Mock localStorage for preferences testing
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

// Mock sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: localStorageMock,
});

// Mock requestAnimationFrame for animation testing
global.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 16));
global.cancelAnimationFrame = jest.fn((id) => clearTimeout(id));

// Mock scroll behavior for scroll-based interactions
Element.prototype.scrollIntoView = jest.fn();
Element.prototype.scrollTo = jest.fn();
window.scrollTo = jest.fn();

// Mock focus/blur methods for accessibility testing
HTMLElement.prototype.focus = jest.fn();
HTMLElement.prototype.blur = jest.fn();

// Mock clipboard API for copy functionality
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: jest.fn().mockResolvedValue(undefined),
    readText: jest.fn().mockResolvedValue(''),
  },
});

// Mock touch events for mobile testing
class MockTouchEvent extends Event {
  touches: Touch[];
  changedTouches: Touch[];
  targetTouches: Touch[];
  
  constructor(type: string, options: TouchEventInit & { touches?: Touch[], changedTouches?: Touch[], targetTouches?: Touch[] } = {}) {
    super(type, options);
    this.touches = options.touches || [];
    this.changedTouches = options.changedTouches || [];
    this.targetTouches = options.targetTouches || [];
  }
}

global.TouchEvent = MockTouchEvent;

// Mock PointerEvent for advanced interactions
class MockPointerEvent extends MouseEvent {
  pointerId: number;
  pointerType: string;
  
  constructor(type: string, options: PointerEventInit = {}) {
    super(type, options);
    this.pointerId = options.pointerId || 1;
    this.pointerType = options.pointerType || 'mouse';
  }
}

global.PointerEvent = MockPointerEvent;

// Global test utilities
global.testUtils = {
  // Helper to create mock user for authentication tests
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

  // Helper to create mock navigation config
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

  // Helper to mock viewport size
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

  // Helper to wait for animations
  waitForAnimation: () => new Promise(resolve => requestAnimationFrame(resolve)),

  // Helper to trigger custom events
  triggerCustomEvent: (element: Element, eventType: string, detail?: any) => {
    const event = new CustomEvent(eventType, { detail, bubbles: true, cancelable: true });
    element.dispatchEvent(event);
  },
};

// Console error/warn suppression for expected errors in tests
const originalError = console.error;
const originalWarn = console.warn;

beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
  
  // Reset localStorage mock
  localStorageMock.clear();
  
  // Reset viewport
  global.testUtils.mockViewport(1024, 768);
});

afterEach(() => {
  // Clean up any DOM modifications
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

// Global error handling for tests
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

// Export types for test files
export type MockUser = ReturnType<typeof global.testUtils.createMockUser>;
export type MockNavigationConfig = ReturnType<typeof global.testUtils.createMockNavigationConfig>;