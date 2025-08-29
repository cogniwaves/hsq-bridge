/**
 * Navigation Browser Compatibility Tests
 * Tests for cross-browser functionality and graceful degradation
 */

/// <reference path="../../types/jest.d.ts" />

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SideNavigation } from '../../../components/navigation/SideNavigation';

// Browser simulation utilities
const simulateIE11 = () => {
  // Mock IE11 environment
  Object.defineProperty(window, 'navigator', {
    value: {
      ...navigator,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko',
    },
    configurable: true,
  });

  // Mock missing features in IE11
  delete (window as any).fetch;
  delete (window as any).Promise;
  delete (window as any).Symbol;
  delete (window as any).WeakMap;
  delete (window as any).WeakSet;
  
  // Mock missing CSS features
  Object.defineProperty(window, 'CSS', {
    value: {
      supports: jest.fn().mockReturnValue(false),
    },
    configurable: true,
  });
};

const simulateOldChrome = () => {
  Object.defineProperty(window, 'navigator', {
    value: {
      ...navigator,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36',
    },
    configurable: true,
  });
};

const simulateOldFirefox = () => {
  Object.defineProperty(window, 'navigator', {
    value: {
      ...navigator,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:55.0) Gecko/20100101 Firefox/55.0',
    },
    configurable: true,
  });
};

const simulateOldSafari = () => {
  Object.defineProperty(window, 'navigator', {
    value: {
      ...navigator,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Safari/604.1.38',
    },
    configurable: true,
  });
};

const simulateEdgeLegacy = () => {
  Object.defineProperty(window, 'navigator', {
    value: {
      ...navigator,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Safari/537.36 Edge/15.15063',
    },
    configurable: true,
  });
};

describe('Navigation Browser Compatibility', () => {
  let user: ReturnType<typeof userEvent.setup>;
  const testConfig = global.testUtils.createMockNavigationConfig();

  beforeEach(() => {
    user = userEvent.setup();
    // Reset to modern browser environment
    jest.clearAllMocks();
  });

  describe('Internet Explorer 11 Support', () => {
    beforeEach(() => {
      simulateIE11();
    });

    it('should render basic navigation in IE11', async () => {
      render(<SideNavigation config={testConfig} />);
      
      await waitFor(() => {
        expect(screen.getByRole('navigation')).toBeInTheDocument();
        expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
      });
    });

    it('should provide polyfill for missing Promise', async () => {
      // Navigation should include Promise polyfill
      expect(global.Promise).toBeDefined();
      
      render(<SideNavigation config={testConfig} />);
      
      await waitFor(() => {
        expect(screen.getByRole('navigation')).toBeInTheDocument();
      });
    });

    it('should use XMLHttpRequest when fetch is unavailable', async () => {
      const xhrMock = {
        open: jest.fn(),
        send: jest.fn(),
        setRequestHeader: jest.fn(),
        addEventListener: jest.fn(),
        readyState: 4,
        status: 200,
        responseText: JSON.stringify({ success: true }),
      };

      global.XMLHttpRequest = jest.fn().mockImplementation(() => xhrMock) as any;
      
      render(<SideNavigation config={testConfig} />);
      
      await waitFor(() => {
        expect(global.XMLHttpRequest).toHaveBeenCalled();
        expect(xhrMock.open).toHaveBeenCalledWith('GET', expect.any(String));
      });
    });

    it('should use fallback CSS for unsupported properties', () => {
      render(<SideNavigation config={testConfig} />);
      
      const navigation = screen.getByRole('navigation');
      expect(navigation).toHaveClass('ie11-fallback');
      
      // Should use absolute positioning instead of CSS Grid
      const computedStyle = window.getComputedStyle(navigation);
      expect(computedStyle.position).toBe('absolute');
    });

    it('should handle missing ES6 features', async () => {
      // Should work without arrow functions, const/let, etc.
      render(<SideNavigation config={testConfig} />);
      
      await waitFor(() => {
        expect(screen.getByRole('navigation')).toBeInTheDocument();
        
        // Should use function declarations instead of arrow functions
        expect(screen.getByTestId('ie11-compatible')).toBeInTheDocument();
      });
    });
  });

  describe('Chrome Legacy Support', () => {
    beforeEach(() => {
      simulateOldChrome();
    });

    it('should work in Chrome 60+', async () => {
      render(<SideNavigation config={testConfig} />);
      
      await waitFor(() => {
        expect(screen.getByRole('navigation')).toBeInTheDocument();
        
        // Should use modern features available in Chrome 60
        const navigation = screen.getByRole('navigation');
        expect(navigation).toHaveClass('chrome-legacy');
      });
    });

    it('should handle limited CSS Grid support', () => {
      // Chrome 60 has basic CSS Grid but not all features
      Object.defineProperty(window, 'CSS', {
        value: {
          supports: jest.fn().mockImplementation((prop) => {
            return prop.includes('display: grid') && !prop.includes('gap');
          }),
        },
        configurable: true,
      });

      render(<SideNavigation config={testConfig} />);
      
      const navigation = screen.getByRole('navigation');
      expect(navigation).toHaveClass('grid-legacy');
    });

    it('should polyfill missing Intersection Observer', async () => {
      delete (window as any).IntersectionObserver;
      
      render(<SideNavigation config={testConfig} />);
      
      await waitFor(() => {
        // Should load polyfill and work without intersection observer
        expect(screen.getByRole('navigation')).toBeInTheDocument();
        expect(screen.getByTestId('scroll-fallback')).toBeInTheDocument();
      });
    });
  });

  describe('Firefox Legacy Support', () => {
    beforeEach(() => {
      simulateOldFirefox();
    });

    it('should work in Firefox 55+', async () => {
      render(<SideNavigation config={testConfig} />);
      
      await waitFor(() => {
        expect(screen.getByRole('navigation')).toBeInTheDocument();
        expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
      });
    });

    it('should handle Firefox-specific CSS quirks', () => {
      render(<SideNavigation config={testConfig} />);
      
      const navigation = screen.getByRole('navigation');
      expect(navigation).toHaveClass('firefox-legacy');
      
      // Firefox-specific fixes
      const computedStyle = window.getComputedStyle(navigation);
      expect(computedStyle.minHeight).toBe('-moz-fit-content');
    });

    it('should work without CSS custom properties', () => {
      Object.defineProperty(window, 'CSS', {
        value: {
          supports: jest.fn().mockImplementation((prop) => {
            return !prop.startsWith('--');
          }),
        },
        configurable: true,
      });

      render(<SideNavigation config={testConfig} />);
      
      const navigation = screen.getByRole('navigation');
      expect(navigation).toHaveClass('no-custom-props');
    });
  });

  describe('Safari Legacy Support', () => {
    beforeEach(() => {
      simulateOldSafari();
    });

    it('should work in Safari 11+', async () => {
      render(<SideNavigation config={testConfig} />);
      
      await waitFor(() => {
        expect(screen.getByRole('navigation')).toBeInTheDocument();
      });
    });

    it('should handle Safari-specific touch events', async () => {
      global.testUtils.mockViewport(375, 667); // Mobile Safari
      
      render(<SideNavigation config={testConfig} />);
      
      await waitFor(async () => {
        const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
        
        // Safari-specific touch handling
        const touchEvent = new TouchEvent('touchstart', {
          touches: [{
            identifier: 0,
            clientX: 50,
            clientY: 100,
            pageX: 50,
            pageY: 100,
            screenX: 50,
            screenY: 100,
            radiusX: 0,
            radiusY: 0,
            rotationAngle: 0,
            force: 1,
            target: menuButton,
          } as Touch],
        });
        
        menuButton.dispatchEvent(touchEvent);
        
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('should handle iOS safe areas', () => {
      // Mock iOS Safari
      Object.defineProperty(window, 'navigator', {
        value: {
          ...navigator,
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1',
        },
        configurable: true,
      });

      render(<SideNavigation config={testConfig} />);
      
      const navigation = screen.getByRole('navigation');
      expect(navigation).toHaveClass('ios-safe-area');
    });

    it('should handle WebKit-specific animations', async () => {
      render(<SideNavigation config={testConfig} />);
      
      await waitFor(async () => {
        const expandButton = screen.getByRole('button', { name: /expand/i });
        await user.click(expandButton);
        
        const navigation = screen.getByRole('navigation');
        const computedStyle = window.getComputedStyle(navigation);
        
        // Should use WebKit-prefixed properties
        expect(computedStyle.webkitTransform).toBeDefined();
        expect(computedStyle.webkitTransition).toBeDefined();
      });
    });
  });

  describe('Edge Legacy Support', () => {
    beforeEach(() => {
      simulateEdgeLegacy();
    });

    it('should work in Edge Legacy', async () => {
      render(<SideNavigation config={testConfig} />);
      
      await waitFor(() => {
        expect(screen.getByRole('navigation')).toBeInTheDocument();
      });
    });

    it('should handle EdgeHTML rendering quirks', () => {
      render(<SideNavigation config={testConfig} />);
      
      const navigation = screen.getByRole('navigation');
      expect(navigation).toHaveClass('edge-legacy');
      
      // Edge-specific CSS fixes
      const computedStyle = window.getComputedStyle(navigation) as any;
      expect(computedStyle.msGridColumn).toBeDefined();
    });

    it('should polyfill missing features in EdgeHTML', async () => {
      // Mock missing features in EdgeHTML
      delete (window as any).ResizeObserver;
      delete (window as any).IntersectionObserver;
      
      render(<SideNavigation config={testConfig} />);
      
      await waitFor(() => {
        expect(screen.getByRole('navigation')).toBeInTheDocument();
        expect(screen.getByTestId('resize-fallback')).toBeInTheDocument();
      });
    });
  });

  describe('Mobile Browser Compatibility', () => {
    it('should work on Android Browser', async () => {
      Object.defineProperty(window, 'navigator', {
        value: {
          ...navigator,
          userAgent: 'Mozilla/5.0 (Linux; Android 4.4.2; Nexus 4 Build/KOT49H) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/30.0.0.0 Mobile Safari/537.36',
        },
        configurable: true,
      });

      global.testUtils.mockViewport(360, 640);
      
      render(<SideNavigation config={testConfig} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /open navigation menu/i })).toBeInTheDocument();
      });
    });

    it('should work on Samsung Internet', async () => {
      Object.defineProperty(window, 'navigator', {
        value: {
          ...navigator,
          userAgent: 'Mozilla/5.0 (Linux; Android 9; SAMSUNG SM-G960F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/9.2 Chrome/67.0.3396.87 Mobile Safari/537.36',
        },
        configurable: true,
      });

      render(<SideNavigation config={testConfig} />);
      
      await waitFor(() => {
        expect(screen.getByRole('navigation')).toBeInTheDocument();
        
        const navigation = screen.getByRole('navigation');
        expect(navigation).toHaveClass('samsung-browser');
      });
    });

    it('should work on UC Browser', async () => {
      Object.defineProperty(window, 'navigator', {
        value: {
          ...navigator,
          userAgent: 'Mozilla/5.0 (Linux; U; Android 8.1.0; zh-CN; EML-AL00 Build/HUAWEIEML-AL00) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/57.0.2987.108 UCBrowser/11.9.4.974 Mobile Safari/537.36',
        },
        configurable: true,
      });

      render(<SideNavigation config={testConfig} />);
      
      await waitFor(() => {
        expect(screen.getByRole('navigation')).toBeInTheDocument();
      });
    });
  });

  describe('Feature Detection and Polyfills', () => {
    it('should detect and load required polyfills', async () => {
      const polyfillLoadSpy = jest.fn();
      
      // Mock polyfill loader
      (global as any).loadPolyfill = polyfillLoadSpy;
      
      // Simulate missing features
      delete (window as any).fetch;
      delete (window as any).Promise;
      delete (window as any).IntersectionObserver;
      
      render(<SideNavigation config={testConfig} />);
      
      expect(polyfillLoadSpy).toHaveBeenCalledWith('fetch');
      expect(polyfillLoadSpy).toHaveBeenCalledWith('promise');
      expect(polyfillLoadSpy).toHaveBeenCalledWith('intersection-observer');
    });

    it('should gracefully degrade when polyfills fail to load', async () => {
      // Mock polyfill loading failure
      (global as any).loadPolyfill = jest.fn().mockRejectedValue(new Error('Polyfill load failed'));
      
      delete (window as any).fetch;
      
      render(<SideNavigation config={testConfig} />);
      
      await waitFor(() => {
        expect(screen.getByRole('navigation')).toBeInTheDocument();
        expect(screen.getByText(/basic mode/i)).toBeInTheDocument();
      });
    });

    it('should use native features when available', async () => {
      // Ensure native features are available
      global.fetch = jest.fn().mockResolvedValue(mockFactories.createMockResponse({}));
      global.IntersectionObserver = jest.fn().mockImplementation(() => ({
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: jest.fn(),
      }));
      
      render(<SideNavigation config={testConfig} />);
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
        expect(global.IntersectionObserver).toHaveBeenCalled();
      });
    });
  });

  describe('Accessibility Across Browsers', () => {
    it('should maintain ARIA support in IE11', async () => {
      simulateIE11();
      
      render(<SideNavigation config={testConfig} />);
      
      await waitFor(() => {
        const navigation = screen.getByRole('navigation');
        expect(navigation).toHaveAttribute('aria-label');
        
        const items = screen.getAllByRole('link');
        items.forEach(item => {
          expect(item).toHaveAttribute('tabindex');
        });
      });
    });

    it('should work with legacy screen readers', async () => {
      simulateIE11();
      
      render(<SideNavigation config={testConfig} />);
      
      await waitFor(() => {
        // Should use ARIA labels that work with JAWS/NVDA
        const navigation = screen.getByRole('navigation');
        expect(navigation).toHaveAttribute('role', 'navigation');
        
        // Should use appropriate ARIA live regions
        const liveRegion = screen.getByRole('status', { hidden: true });
        expect(liveRegion).toHaveAttribute('aria-live', 'polite');
      });
    });

    it('should handle high contrast mode in IE/Edge', () => {
      simulateEdgeLegacy();
      
      // Mock high contrast mode
      Object.defineProperty(window, 'matchMedia', {
        value: jest.fn().mockReturnValue({
          matches: true,
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
        }),
      });

      render(<SideNavigation config={testConfig} />);
      
      const navigation = screen.getByRole('navigation');
      expect(navigation).toHaveClass('high-contrast-mode');
    });
  });

  describe('Performance Across Browsers', () => {
    it('should optimize for slower browsers', async () => {
      simulateIE11();
      
      const renderStart = performance.now();
      render(<SideNavigation config={testConfig} />);
      
      await waitFor(() => {
        expect(screen.getByRole('navigation')).toBeInTheDocument();
      });
      
      const renderTime = performance.now() - renderStart;
      
      // Should have reasonable performance even in IE11
      expect(renderTime).toBeLessThan(500);
    });

    it('should reduce animation complexity on older browsers', async () => {
      simulateOldFirefox();
      
      render(<SideNavigation config={testConfig} />);
      
      await waitFor(async () => {
        const expandButton = screen.getByRole('button', { name: /expand/i });
        await user.click(expandButton);
        
        const navigation = screen.getByRole('navigation');
        expect(navigation).toHaveClass('reduced-animations');
      });
    });

    it('should use efficient fallbacks for unsupported CSS', () => {
      simulateIE11();
      
      render(<SideNavigation config={testConfig} />);
      
      const navigation = screen.getByRole('navigation');
      const computedStyle = window.getComputedStyle(navigation);
      
      // Should use table layout instead of CSS Grid
      expect(computedStyle.display).toBe('table');
    });
  });

  describe('Progressive Enhancement', () => {
    it('should work with JavaScript disabled', () => {
      // Mock no JavaScript environment
      const originalCreate = document.createElement;
      document.createElement = jest.fn().mockImplementation((tag) => {
        const element = originalCreate.call(document, tag);
        element.addEventListener = jest.fn(); // Disable event listeners
        return element;
      });

      render(<SideNavigation config={testConfig} />);
      
      // Should render basic navigation structure
      expect(screen.getByRole('navigation')).toBeInTheDocument();
      const links = screen.getAllByRole('link');
      expect(links.length).toBeGreaterThan(0);
      
      // Links should have href attributes
      links.forEach(link => {
        expect(link).toHaveAttribute('href');
      });

      document.createElement = originalCreate;
    });

    it('should enhance functionality when JavaScript is available', async () => {
      render(<SideNavigation config={testConfig} />);
      
      await waitFor(async () => {
        // Should have enhanced interactions
        const expandButton = screen.getByRole('button', { name: /expand/i });
        await user.click(expandButton);
        
        expect(screen.getByTestId('navigation-drawer')).toBeInTheDocument();
      });
    });

    it('should work with CSS disabled', () => {
      // Mock missing CSS support
      Object.defineProperty(window, 'getComputedStyle', {
        value: jest.fn().mockReturnValue({}),
      });

      render(<SideNavigation config={testConfig} />);
      
      // Should still be functional without styling
      expect(screen.getByRole('navigation')).toBeInTheDocument();
      const links = screen.getAllByRole('link');
      expect(links.length).toBeGreaterThan(0);
    });
  });

  describe('Network and Connection Handling', () => {
    it('should handle slow connections gracefully', async () => {
      // Mock slow connection
      Object.defineProperty(navigator, 'connection', {
        value: {
          effectiveType: '2g',
          downlink: 0.25,
        },
        configurable: true,
      });

      render(<SideNavigation config={testConfig} />);
      
      await waitFor(() => {
        const navigation = screen.getByRole('navigation');
        expect(navigation).toHaveClass('slow-connection');
        
        // Should show simplified interface
        expect(screen.getByText(/simplified view/i)).toBeInTheDocument();
      });
    });

    it('should work offline', async () => {
      // Mock offline state
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true,
      });

      render(<SideNavigation config={testConfig} />);
      
      await waitFor(() => {
        expect(screen.getByRole('navigation')).toBeInTheDocument();
        expect(screen.getByText(/offline mode/i)).toBeInTheDocument();
        
        // Should show cached navigation
        const links = screen.getAllByRole('link');
        expect(links.length).toBeGreaterThan(0);
      });
    });

    it('should handle connection changes', async () => {
      const { rerender } = render(<SideNavigation config={testConfig} />);
      
      // Go offline
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true,
      });
      
      window.dispatchEvent(new Event('offline'));
      rerender(<SideNavigation config={testConfig} />);
      
      await waitFor(() => {
        expect(screen.getByText(/offline mode/i)).toBeInTheDocument();
      });
      
      // Come back online
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        configurable: true,
      });
      
      window.dispatchEvent(new Event('online'));
      rerender(<SideNavigation config={testConfig} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/offline mode/i)).not.toBeInTheDocument();
      });
    });
  });
});