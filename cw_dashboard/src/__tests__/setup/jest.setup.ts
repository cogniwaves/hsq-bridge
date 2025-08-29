/**
 * Jest Setup File
 * Global test configuration and utilities for navigation testing
 */

import '@testing-library/jest-dom';
import 'jest-axe/extend-expect';
import 'resize-observer-polyfill';
import 'intersection-observer';

// Mock Next.js router
import { jest } from '@jest/globals';

// Import and setup mocks
import React from 'react';

// Mock Next.js components
jest.mock('next/link', () => {
  const MockLink = ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: any }) => {
    return React.createElement('a', { href, ...props }, children);
  };
  MockLink.displayName = 'MockLink';
  return MockLink;
});

jest.mock('next/image', () => {
  const MockImage = ({ src, alt, ...props }: { src: string; alt: string; [key: string]: any }) => {
    return React.createElement('img', { src, alt, ...props });
  };
  MockImage.displayName = 'MockImage';
  return MockImage;
});

jest.mock('next/router', () => ({
  useRouter: () => ({
    route: '/',
    pathname: '/',
    query: {},
    asPath: '/',
    push: jest.fn(),
    pop: jest.fn(),
    reload: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn().mockResolvedValue(undefined as any),
    beforePopState: jest.fn(),
    events: {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    },
    isFallback: false,
    isLocaleDomain: true,
    isReady: true,
    defaultLocale: 'en',
    domainLocales: [],
    isPreview: false,
  }),
  withRouter: (Component: React.ComponentType) => Component,
}));

// Mock Userfront
jest.mock('@userfront/react', () => ({
  Userfront: {
    init: jest.fn(),
    user: {
      isLoggedIn: false,
      userId: null,
      userUuid: null,
      email: null,
    },
    logout: jest.fn(),
    redirectIfLoggedOut: jest.fn(),
  },
  SignupForm: Object.assign(
    ({ children }: { children?: React.ReactNode }) => React.createElement('div', { 'data-testid': 'signup-form' }, children),
    { displayName: 'SignupForm' }
  ),
  LoginForm: Object.assign(
    ({ children }: { children?: React.ReactNode }) => React.createElement('div', { 'data-testid': 'login-form' }, children),
    { displayName: 'LoginForm' }
  ),
  LogoutButton: Object.assign(
    ({ children }: { children?: React.ReactNode }) => React.createElement('button', { 'data-testid': 'logout-button' }, children),
    { displayName: 'LogoutButton' }
  ),
}));

// Mock Heroicons
jest.mock('@heroicons/react/24/outline', () => {
  const createMockIcon = (name: string) => {
    const IconComponent = ({ className, ...props }: { className?: string; [key: string]: any }) => 
      React.createElement('svg', { 
        className, 
        'data-testid': `${name.toLowerCase()}-icon`,
        'aria-hidden': 'true',
        fill: 'none',
        stroke: 'currentColor',
        viewBox: '0 0 24 24',
        ...props 
      });
    IconComponent.displayName = `${name}Icon`;
    return IconComponent;
  };

  return new Proxy({}, {
    get: (target, prop) => {
      if (typeof prop === 'string') {
        return createMockIcon(prop);
      }
      return undefined;
    }
  });
});

jest.mock('@heroicons/react/24/solid', () => {
  const createMockIcon = (name: string) => {
    const IconComponent = ({ className, ...props }: { className?: string; [key: string]: any }) => 
      React.createElement('svg', { 
        className, 
        'data-testid': `${name.toLowerCase()}-icon`,
        'aria-hidden': 'true',
        fill: 'currentColor',
        viewBox: '0 0 24 24',
        ...props 
      });
    IconComponent.displayName = `${name}Icon`;
    return IconComponent;
  };

  return new Proxy({}, {
    get: (target, prop) => {
      if (typeof prop === 'string') {
        return createMockIcon(prop);
      }
      return undefined;
    }
  });
});

// Mock Headless UI
jest.mock('@headlessui/react', () => ({
  Transition: {
    Root: ({ children, show }: { children: React.ReactNode; show?: boolean }) => 
      show !== false ? React.createElement('div', { 'data-testid': 'transition-root' }, children) : null,
    Child: ({ children }: { children: React.ReactNode }) => 
      React.createElement('div', { 'data-testid': 'transition-child' }, children),
  },
  Dialog: ({ children, open, onClose }: { children: React.ReactNode; open: boolean; onClose: () => void }) =>
    open ? React.createElement('div', { 
      'data-testid': 'dialog',
      role: 'dialog',
      onClick: onClose 
    }, children) : null,
  Menu: {
    Button: ({ children }: { children: React.ReactNode }) => 
      React.createElement('button', { 'data-testid': 'menu-button' }, children),
    Items: ({ children }: { children: React.ReactNode }) => 
      React.createElement('div', { 'data-testid': 'menu-items' }, children),
    Item: ({ children }: { children: React.ReactNode }) => 
      React.createElement('div', { 'data-testid': 'menu-item' }, children),
  },
  Disclosure: {
    Button: ({ children }: { children: React.ReactNode }) => 
      React.createElement('button', { 'data-testid': 'disclosure-button' }, children),
    Panel: ({ children }: { children: React.ReactNode }) => 
      React.createElement('div', { 'data-testid': 'disclosure-panel' }, children),
  },
}));

// Mock window.matchMedia for responsive testing
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn((query: string) => ({
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
window.getComputedStyle = jest.fn((element: Element): CSSStyleDeclaration => {
  return {
    ...originalGetComputedStyle(element),
    getPropertyValue: jest.fn((prop: string) => {
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
      return mockValues[prop as string] || '';
    }),
  } as CSSStyleDeclaration;
}) as typeof window.getComputedStyle;

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
global.requestAnimationFrame = jest.fn((cb: FrameRequestCallback) => setTimeout(cb, 16) as unknown as number);
global.cancelAnimationFrame = jest.fn((id: number) => clearTimeout(id as unknown as NodeJS.Timeout));

// Mock scroll behavior for scroll-based interactions
Element.prototype.scrollIntoView = jest.fn();
Element.prototype.scrollTo = jest.fn();
window.scrollTo = jest.fn();

// Mock focus/blur methods for accessibility testing
HTMLElement.prototype.focus = jest.fn();
HTMLElement.prototype.blur = jest.fn();

// Mock clipboard API for copy functionality
Object.defineProperty(navigator, 'clipboard', {
  configurable: true,
  writable: true,
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
  waitForAnimation: () => new Promise<void>(resolve => requestAnimationFrame(() => resolve())),

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

// Import mock factories from mocks.setup
import { mockFactories } from './mocks.setup';

// Make mockFactories available globally
global.mockFactories = mockFactories;

// Export types for test files
export type MockUser = ReturnType<typeof global.testUtils.createMockUser>;
export type MockNavigationConfig = ReturnType<typeof global.testUtils.createMockNavigationConfig>;