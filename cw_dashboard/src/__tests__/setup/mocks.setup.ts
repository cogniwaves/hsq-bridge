/**
 * Mocks Setup File
 * Global mocks for external dependencies and APIs
 */

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
  const MockIcon = ({ className, ...props }: any) => (
    <svg className={className} data-testid="mock-icon" {...props}>
      <path />
    </svg>
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
  const MockIcon = ({ className, ...props }: any) => (
    <svg className={className} data-testid="mock-icon-solid" {...props}>
      <path />
    </svg>
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
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
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
  createMockResponse: (data: any, options: Partial<Response> = {}) => ({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    ...options,
  }),

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

  resetAllMocks: () => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  },
};