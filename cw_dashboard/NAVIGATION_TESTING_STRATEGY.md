# Navigation Testing Strategy & Documentation

## Overview

This document outlines the comprehensive testing strategy for the HSQ Bridge MD3 side navigation system. Our testing approach ensures 80%+ code coverage, WCAG 2.1 AA compliance, cross-browser compatibility, and production-ready reliability.

## Testing Framework Architecture

### Core Technologies
- **Jest** - JavaScript testing framework with coverage reporting
- **React Testing Library** - Component testing with user-centric approach
- **jest-axe** - Automated accessibility testing for WCAG compliance
- **MSW** - Mock Service Worker for API testing
- **User Event** - Realistic user interaction simulation

### Test Structure
```
src/__tests__/
├── setup/                          # Global test configuration
│   ├── jest.setup.ts               # Jest setup and global utilities
│   └── mocks.setup.ts              # Global mocks for external dependencies
├── unit/                           # Component unit tests
│   ├── navigation/
│   │   ├── SideNavigation.test.tsx
│   │   ├── NavigationItem.test.tsx
│   │   └── NavigationProfile.test.tsx
│   └── hooks/
│       └── useNavigationData.test.ts
├── integration/                    # Integration tests
│   └── navigation/
│       └── NavigationAuthentication.test.tsx
├── accessibility/                  # WCAG compliance tests
│   └── navigation/
│       └── NavigationA11y.test.tsx
├── responsive/                     # Responsive behavior tests
│   └── navigation/
│       └── NavigationResponsive.test.tsx
├── performance/                    # Performance and optimization tests
│   └── navigation/
│       └── NavigationPerformance.test.tsx
├── error-handling/                 # Error recovery and graceful degradation
│   └── navigation/
│       └── NavigationErrors.test.tsx
└── browser-compatibility/          # Cross-browser compatibility
    └── navigation/
        └── NavigationCompatibility.test.tsx
```

## Test Categories & Coverage

### 1. Unit Tests (80% of test suite)
**Purpose**: Test individual components and functions in isolation

**Components Tested**:
- `SideNavigation` - Main navigation container
- `NavigationItem` - Individual navigation items
- `NavigationDrawer` - Expanded navigation mode
- `NavigationRail` - Collapsed navigation mode
- `NavigationModal` - Mobile navigation overlay
- `NavigationProfile` - User profile section

**Key Test Scenarios**:
```typescript
// Component rendering and props handling
it('should render with default props', () => {
  render(<SideNavigation config={mockConfig} />);
  expect(screen.getByRole('navigation')).toBeInTheDocument();
});

// User interactions
it('should handle item clicks', async () => {
  const mockClick = jest.fn();
  render(<SideNavigation config={mockConfig} onItemClick={mockClick} />);
  
  const item = screen.getByRole('button', { name: /dashboard/i });
  await user.click(item);
  
  expect(mockClick).toHaveBeenCalledWith(expect.objectContaining({
    id: 'dashboard'
  }));
});

// State management
it('should toggle between rail and drawer modes', async () => {
  render(<SideNavigation config={mockConfig} />);
  
  const expandButton = screen.getByRole('button', { name: /expand/i });
  await user.click(expandButton);
  
  expect(screen.getByTestId('navigation-drawer')).toBeInTheDocument();
});
```

**Coverage Targets**:
- Functions: 85%+
- Statements: 85%+
- Branches: 85%+
- Lines: 85%+

### 2. Integration Tests (15% of test suite)
**Purpose**: Test navigation system integration with authentication, routing, and external APIs

**Key Integration Points**:
- Userfront authentication integration
- Next.js routing integration
- Real-time data updates via WebSocket
- Multi-tenant support
- Session management

**Example Test Scenarios**:
```typescript
// Authentication integration
it('should show user-specific navigation items', async () => {
  const adminUser = createMockUser({ role: 'admin' });
  
  render(
    <AuthTestWrapper authState={{ user: adminUser }}>
      <SideNavigation config={configWithPermissions} />
    </AuthTestWrapper>
  );
  
  expect(screen.getByRole('button', { name: /admin panel/i })).toBeInTheDocument();
});

// Real-time updates
it('should update badges from WebSocket messages', async () => {
  render(<SideNavigation config={mockConfig} />);
  
  const ws = new MockWebSocket('ws://test');
  ws.simulateMessage({
    type: 'notification',
    payload: { count: 5 }
  });
  
  expect(screen.getByText('5')).toBeInTheDocument();
});
```

### 3. Accessibility Tests (WCAG 2.1 AA Compliance)
**Purpose**: Ensure navigation meets accessibility standards

**Automated Testing**:
```typescript
import { axe, toHaveNoViolations } from 'jest-axe';

it('should have no accessibility violations', async () => {
  const { container } = render(<SideNavigation config={testConfig} />);
  
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

**Manual Testing Scenarios**:
- Keyboard navigation (Tab, Arrow keys, Enter, Space, Escape)
- Screen reader compatibility (ARIA labels, roles, live regions)
- Focus management and visual indicators
- Color contrast verification
- High contrast mode support
- Reduced motion preferences

**Key Accessibility Features Tested**:
- Semantic HTML structure (`<nav>`, `<ul>`, `<li>`)
- Proper ARIA attributes (`aria-label`, `aria-current`, `aria-expanded`)
- Keyboard navigation support
- Skip to content functionality
- Screen reader announcements
- Focus trap in modal mode

### 4. Responsive Tests
**Purpose**: Verify navigation behavior across device breakpoints

**Breakpoint Testing**:
```typescript
const BREAKPOINTS = {
  mobile: { width: 320, height: 568 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1024, height: 768 },
  desktopLg: { width: 1440, height: 900 }
};

it('should switch to modal mode on mobile', async () => {
  mockViewport(BREAKPOINTS.mobile.width, BREAKPOINTS.mobile.height);
  
  render(<SideNavigation config={testConfig} />);
  
  expect(screen.getByRole('button', { name: /open navigation menu/i }))
    .toBeInTheDocument();
});
```

**Touch Interface Testing**:
- Touch target sizes (44px minimum)
- Swipe gesture support
- iOS safe area handling
- Android back button handling

### 5. Performance Tests
**Purpose**: Ensure navigation loads quickly and animates smoothly

**Performance Metrics**:
- Initial render time < 50ms (small config)
- Initial render time < 200ms (large config)
- Animation frame rate > 50fps
- Mode transition time < 400ms
- Memory leak prevention

**Performance Testing Examples**:
```typescript
it('should render quickly with small configuration', async () => {
  const config = createMockNavigationConfig();
  
  const renderTime = await measurePerformance(() => {
    render(<SideNavigation config={config} />);
  });

  expect(renderTime).toBeLessThan(50);
});

it('should maintain 60fps during animations', async () => {
  const frameTimestamps: number[] = [];
  
  // Track frame rate during animation
  const trackFrameRate = () => {
    frameTimestamps.push(performance.now());
    requestAnimationFrame(trackFrameRate);
  };
  
  trackFrameRate();
  
  // Trigger animation
  const expandButton = screen.getByRole('button', { name: /expand/i });
  await user.click(expandButton);
  
  // Calculate and verify frame rate
  const fps = calculateFPS(frameTimestamps);
  expect(fps).toBeGreaterThan(50);
});
```

### 6. Error Handling Tests
**Purpose**: Verify graceful degradation and error recovery

**Error Scenarios Tested**:
- Invalid configuration objects
- API failures and network errors
- Component render errors
- Memory exhaustion
- Browser compatibility issues

**Error Recovery Testing**:
```typescript
it('should recover from API errors with retry mechanism', async () => {
  global.fetch = jest.fn()
    .mockRejectedValueOnce(new Error('Network error'))
    .mockResolvedValue(mockResponse({ success: true }));

  render(<SideNavigation config={mockConfig} />);
  
  // Should show error state
  expect(screen.getByRole('alert')).toBeInTheDocument();
  
  // Should allow retry
  const retryButton = screen.getByRole('button', { name: /retry/i });
  await user.click(retryButton);
  
  // Should recover
  expect(screen.getByRole('navigation')).toBeInTheDocument();
});
```

### 7. Browser Compatibility Tests
**Purpose**: Ensure cross-browser functionality

**Browsers Tested**:
- Internet Explorer 11
- Chrome 60+ (including legacy versions)
- Firefox 55+ (including legacy versions)
- Safari 11+ (including mobile Safari)
- Edge Legacy
- Mobile browsers (Android Browser, Samsung Internet, UC Browser)

**Compatibility Testing Examples**:
```typescript
it('should work in Internet Explorer 11', async () => {
  simulateIE11Environment();
  
  render(<SideNavigation config={testConfig} />);
  
  expect(screen.getByRole('navigation')).toBeInTheDocument();
  expect(screen.getByTestId('ie11-fallback')).toBeInTheDocument();
});
```

## Testing Commands

### Development Commands
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run specific test categories
npm run test:a11y           # Accessibility tests only
npm run test:integration    # Integration tests only
npm run test:performance    # Performance tests only

# Run tests for CI/CD
npm run test:ci
```

### Coverage Requirements
```javascript
// jest.config.js
coverageThreshold: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80
  },
  './src/components/navigation/': {
    branches: 85,
    functions: 85,
    lines: 85,
    statements: 85
  }
}
```

## Mock Strategies

### 1. External Dependencies
```typescript
// Mock Userfront authentication
jest.mock('@userfront/react', () => ({
  useUser: () => ({ user: mockUser, isLoggedIn: true }),
  useAuth: () => ({ 
    user: mockUser, 
    isAuthenticated: true,
    login: jest.fn(),
    logout: jest.fn() 
  })
}));

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn()
  }),
  usePathname: () => '/dashboard'
}));
```

### 2. Browser APIs
```typescript
// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
};

// Mock matchMedia for responsive testing
Object.defineProperty(window, 'matchMedia', {
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  }))
});
```

### 3. API Responses
```typescript
// Default API response mocks
const defaultResponses = {
  '/api/dashboard/stats': {
    ok: true,
    json: () => Promise.resolve({
      pendingInvoices: 5,
      recentPayments: 12,
      failedWebhooks: 1
    })
  },
  '/api/notifications/unread-count': {
    ok: true,
    json: () => Promise.resolve({ count: 7 })
  }
};

global.fetch = jest.fn((url) => 
  Promise.resolve(defaultResponses[url] || { ok: true, json: () => Promise.resolve({}) })
);
```

## Test Utilities

### Global Test Helpers
```typescript
// src/__tests__/setup/jest.setup.ts
global.testUtils = {
  createMockUser: (overrides = {}) => ({
    userId: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User',
    accessToken: 'mock-token',
    ...overrides
  }),

  createMockNavigationConfig: (overrides = {}) => ({
    sections: [
      {
        id: 'main',
        items: [
          { id: 'dashboard', label: 'Dashboard', icon: 'home', href: '/' }
        ]
      }
    ],
    ...overrides
  }),

  mockViewport: (width, height) => {
    Object.defineProperty(window, 'innerWidth', { value: width });
    Object.defineProperty(window, 'innerHeight', { value: height });
    window.dispatchEvent(new Event('resize'));
  },

  waitForAnimation: () => new Promise(resolve => requestAnimationFrame(resolve))
};
```

### Custom Render Helpers
```typescript
// Authentication wrapper
const renderWithAuth = (component, authState = {}) => {
  const AuthWrapper = ({ children }) => (
    <UserfrontAuthProvider>
      {children}
    </UserfrontAuthProvider>
  );
  
  return render(component, { wrapper: AuthWrapper });
};

// Theme wrapper
const renderWithTheme = (component, theme = 'light') => {
  const ThemeWrapper = ({ children }) => (
    <ThemeProvider theme={theme}>
      {children}
    </ThemeProvider>
  );
  
  return render(component, { wrapper: ThemeWrapper });
};
```

## Continuous Integration

### GitHub Actions Workflow
```yaml
name: Navigation Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm run test:ci
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
    
    - name: Run accessibility tests
      run: npm run test:a11y
    
    - name: Run performance tests
      run: npm run test:performance
```

### Pre-commit Hooks
```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged && npm run test:changed",
      "pre-push": "npm run test:ci"
    }
  },
  "lint-staged": {
    "src/**/*.{ts,tsx}": [
      "eslint --fix",
      "npm run test -- --findRelatedTests --passWithNoTests"
    ]
  }
}
```

## Best Practices

### 1. Test Organization
- Group related tests in `describe` blocks
- Use descriptive test names that explain the expected behavior
- Follow the Arrange-Act-Assert pattern
- Keep tests focused and isolated

### 2. User-Centric Testing
- Test from the user's perspective, not implementation details
- Use semantic queries (`getByRole`, `getByLabelText`)
- Simulate real user interactions with `userEvent`
- Test accessibility as a first-class concern

### 3. Async Testing
- Use `waitFor` for asynchronous operations
- Avoid `act()` warnings by proper async handling
- Test loading states and error conditions
- Mock timers when testing animations

### 4. Mock Management
- Keep mocks close to test files when specific
- Use global mocks for common dependencies
- Reset mocks between tests
- Prefer minimal mocking over extensive mocking

### 5. Performance Testing
- Measure actual performance metrics
- Test with realistic data sizes
- Verify animation performance
- Check for memory leaks in long-running tests

## Documentation and Reporting

### Coverage Reports
- HTML coverage reports generated in `coverage/` directory
- LCOV format for CI/CD integration
- JSON summary for programmatic access
- Threshold enforcement prevents coverage regression

### Test Results
- Jest reporters provide detailed test results
- Failed test screenshots captured automatically
- Performance metrics logged and tracked
- Accessibility violations reported with remediation suggestions

### Debugging
```bash
# Debug specific test
npm test -- --testNamePattern="should handle item clicks" --verbose

# Debug with inspector
node --inspect-brk ./node_modules/.bin/jest --runInBand --no-cache

# Run single test file
npm test NavigationItem.test.tsx

# Update snapshots
npm test -- --updateSnapshot
```

This comprehensive testing strategy ensures the HSQ Bridge navigation system is robust, accessible, performant, and reliable across all supported browsers and devices. The 80%+ code coverage requirement, combined with automated accessibility testing and comprehensive error handling, provides confidence in the production deployment of the navigation system.