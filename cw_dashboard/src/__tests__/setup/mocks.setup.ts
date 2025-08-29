/**
 * Mocks Setup File
 * Global mocks for external dependencies and APIs
 */

import React from 'react';
import { jest } from '@jest/globals';

// Mock Next.js modules
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
    query: {},
    pathname: '/',
    route: '/',
    asPath: '/',
    events: {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    },
  }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Userfront authentication
jest.mock('@userfront/react', () => ({
  useUser: () => ({
    user: global.testUtils?.createMockUser(),
    isLoggedIn: true,
  }),
  useAuth: () => ({
    user: global.testUtils?.createMockUser(),
    isAuthenticated: true,
    login: jest.fn(),
    logout: jest.fn(),
    signup: jest.fn(),
  }),
}));

jest.mock('@userfront/core', () => ({
  init: jest.fn(),
  user: global.testUtils?.createMockUser(),
  login: jest.fn().mockResolvedValue({}),
  logout: jest.fn().mockResolvedValue({}),
  signup: jest.fn().mockResolvedValue({}),
}));

// Mock custom auth context
jest.mock('../../contexts/UserfrontAuthContext', () => ({
  useUserfrontAuth: () => ({
    user: global.testUtils?.createMockUser(),
    isAuthenticated: true,
    isLoading: false,
    error: null,
    login: jest.fn(),
    logout: jest.fn(),
    signup: jest.fn(),
    refreshUser: jest.fn(),
  }),
  UserfrontAuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock Heroicons
jest.mock('@heroicons/react/24/outline', () => {
  const MockIcon = ({ className, ...props }: any) => 
    React.createElement('svg', 
      { className, 'data-testid': 'mock-icon', ...props },
      React.createElement('path')
    );

  return {
    HomeIcon: MockIcon,
    DocumentTextIcon: MockIcon,
    CurrencyDollarIcon: MockIcon,
    CogIcon: MockIcon,
    UserIcon: MockIcon,
    BellIcon: MockIcon,
    ArrowLeftIcon: MockIcon,
    ArrowRightIcon: MockIcon,
    ChevronLeftIcon: MockIcon,
    ChevronRightIcon: MockIcon,
    ChevronUpIcon: MockIcon,
    ChevronDownIcon: MockIcon,
    Bars3Icon: MockIcon,
    XMarkIcon: MockIcon,
    EllipsisVerticalIcon: MockIcon,
  };
});

jest.mock('@heroicons/react/24/solid', () => {
  const MockIcon = ({ className, ...props }: any) => 
    React.createElement('svg', 
      { className, 'data-testid': 'mock-icon-solid', ...props },
      React.createElement('path')
    );

  return {
    HomeIcon: MockIcon,
    DocumentTextIcon: MockIcon,
    CurrencyDollarIcon: MockIcon,
    CogIcon: MockIcon,
    UserIcon: MockIcon,
    BellIcon: MockIcon,
  };
});

// Mock SWR for data fetching
jest.mock('swr', () => ({
  default: jest.fn((key, fetcher) => ({
    data: null,
    error: null,
    isLoading: false,
    isValidating: false,
    mutate: jest.fn(),
  })),
  mutate: jest.fn(),
}));

// Mock axios for API calls
jest.mock('axios', () => ({
  default: {
    get: jest.fn().mockResolvedValue({ data: {} }),
    post: jest.fn().mockResolvedValue({ data: {} }),
    put: jest.fn().mockResolvedValue({ data: {} }),
    delete: jest.fn().mockResolvedValue({ data: {} }),
    patch: jest.fn().mockResolvedValue({ data: {} }),
    create: jest.fn().mockReturnThis(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  },
  create: jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue({ data: {} }),
    post: jest.fn().mockResolvedValue({ data: {} }),
    put: jest.fn().mockResolvedValue({ data: {} }),
    delete: jest.fn().mockResolvedValue({ data: {} }),
    patch: jest.fn().mockResolvedValue({ data: {} }),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  }),
}));

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(),
    dismiss: jest.fn(),
    custom: jest.fn(),
  },
  Toaster: ({ children }: { children?: React.ReactNode }) => children || null,
}));

// Mock Recharts for analytics
jest.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => 
    React.createElement('div', { 'data-testid': 'line-chart' }, children),
  Line: () => React.createElement('div', { 'data-testid': 'line' }),
  XAxis: () => React.createElement('div', { 'data-testid': 'x-axis' }),
  YAxis: () => React.createElement('div', { 'data-testid': 'y-axis' }),
  CartesianGrid: () => React.createElement('div', { 'data-testid': 'cartesian-grid' }),
  Tooltip: () => React.createElement('div', { 'data-testid': 'tooltip' }),
  Legend: () => React.createElement('div', { 'data-testid': 'legend' }),
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => 
    React.createElement('div', { 'data-testid': 'responsive-container' }, children),
}));

// Mock date-fns
jest.mock('date-fns', () => ({
  format: jest.fn((date, formatStr) => '2023-12-01'),
  parseISO: jest.fn((dateStr) => new Date(dateStr)),
  isValid: jest.fn(() => true),
  addDays: jest.fn((date, amount) => new Date()),
  subDays: jest.fn((date, amount) => new Date()),
  startOfDay: jest.fn((date) => new Date()),
  endOfDay: jest.fn((date) => new Date()),
}));

// Mock js-cookie
jest.mock('js-cookie', () => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
}));

// Mock CSS modules and stylesheets
jest.mock('*.css', () => ({}));
jest.mock('*.scss', () => ({}));
jest.mock('*.sass', () => ({}));
jest.mock('*.less', () => ({}));

// Mock image and media files
jest.mock('*.jpg', () => '/mock-image.jpg');
jest.mock('*.jpeg', () => '/mock-image.jpeg');
jest.mock('*.png', () => '/mock-image.png');
jest.mock('*.gif', () => '/mock-image.gif');
jest.mock('*.svg', () => '/mock-image.svg');
jest.mock('*.webp', () => '/mock-image.webp');

// Create global fetch mock for API testing
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Default fetch responses for different endpoints
const defaultResponses: Record<string, any> = {
  '/api/dashboard/stats': {
    ok: true,
    json: () => Promise.resolve({
      pendingInvoices: 5,
      recentPayments: 12,
      failedWebhooks: 1,
      pendingTransfers: 3,
    }),
  },
  '/api/sync/status': {
    ok: true,
    json: () => Promise.resolve({
      hubspot: { status: 'active' },
      stripe: { status: 'idle' },
      quickbooks: { status: 'idle' },
    }),
  },
  '/api/notifications/unread-count': {
    ok: true,
    json: () => Promise.resolve({ count: 7 }),
  },
  '/api/health': {
    ok: true,
    json: () => Promise.resolve({ status: 'healthy' }),
  },
};

// Setup default fetch mock behavior
mockFetch.mockImplementation((url: string, options?: RequestInit) => {
  const response = defaultResponses[url] || {
    ok: true,
    json: () => Promise.resolve({}),
  };
  
  return Promise.resolve(response);
});

// WebSocket mock for real-time testing
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    // Simulate connection opening
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  send(data: string) {
    // Mock send implementation
    console.log('MockWebSocket send:', data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }

  // Helper method for tests to simulate incoming messages
  simulateMessage(data: any) {
    if (this.onmessage && this.readyState === MockWebSocket.OPEN) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }
}

global.WebSocket = MockWebSocket as any;

// Performance API mock for performance testing
global.performance = {
  ...global.performance,
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByName: jest.fn(() => []),
  getEntriesByType: jest.fn(() => []),
  clearMarks: jest.fn(),
  clearMeasures: jest.fn(),
};

// Export mock factories for use in tests
export const mockFactories = {
  createMockResponse: (data: any = {}, options: Partial<Response> = {}): Response => {
    const response = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      redirected: false,
      type: 'basic' as ResponseType,
      url: '',
      clone: () => response as Response,
      body: null,
      bodyUsed: false,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      blob: () => Promise.resolve(new Blob()),
      formData: () => Promise.resolve(new FormData()),
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data)),
      ...options,
    };
    return response as Response;
  },

  createMockWebSocket: () => new MockWebSocket('ws://localhost:3000/ws'),

  createMockTouchEvent: (type: string, touches: Partial<Touch>[] = []) => {
    const mockTouches = touches.map((touch, index) => ({
      identifier: index,
      clientX: 0,
      clientY: 0,
      pageX: 0,
      pageY: 0,
      screenX: 0,
      screenY: 0,
      radiusX: 0,
      radiusY: 0,
      rotationAngle: 0,
      force: 1,
      target: document.body,
      ...touch,
    }));

    return new TouchEvent(type, {
      touches: mockTouches as Touch[],
      changedTouches: mockTouches as Touch[],
      targetTouches: mockTouches as Touch[],
    });
  },

  createMockPointerEvent: (type: string, options: PointerEventInit = {}) => {
    return new PointerEvent(type, {
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      ...options,
    });
  },

  createMockIntersectionObserverEntry: (options: Partial<IntersectionObserverEntry> = {}): IntersectionObserverEntry => {
    const defaultRect: DOMRectReadOnly = {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      toJSON: () => ({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      }),
    };

    return {
      boundingClientRect: defaultRect,
      intersectionRatio: 0,
      intersectionRect: defaultRect,
      isIntersecting: false,
      rootBounds: null,
      target: document.createElement('div'),
      time: 0,
      ...options,
    } as IntersectionObserverEntry;
  },

  createMockResizeObserverEntry: (options: Partial<ResizeObserverEntry> = {}): ResizeObserverEntry => {
    const defaultRect: DOMRectReadOnly = {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      toJSON: () => ({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
      }),
    };

    const defaultSize: ResizeObserverSize = {
      inlineSize: 0,
      blockSize: 0,
    };

    return {
      target: document.createElement('div'),
      contentRect: defaultRect,
      borderBoxSize: [defaultSize],
      contentBoxSize: [defaultSize],
      ...options,
    } as ResizeObserverEntry;
  },

  resetAllMocks: () => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  },
};