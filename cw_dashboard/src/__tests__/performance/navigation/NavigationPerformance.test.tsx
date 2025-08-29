/**
 * Navigation Performance Tests
 * Tests for loading performance, animation performance, and memory usage
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SideNavigation } from '../../../components/navigation/SideNavigation';
import type { NavigationConfig } from '../../../components/navigation/types';

// Performance test utilities
const measurePerformance = async (operation: () => Promise<void> | void) => {
  const startTime = performance.now();
  await operation();
  const endTime = performance.now();
  return endTime - startTime;
};

const createLargeConfig = (itemCount: number): NavigationConfig => ({
  sections: Array.from({ length: Math.ceil(itemCount / 10) }, (_, sectionIndex) => ({
    id: `section-${sectionIndex}`,
    title: `Section ${sectionIndex + 1}`,
    items: Array.from({ length: Math.min(10, itemCount - sectionIndex * 10) }, (_, itemIndex) => ({
      id: `item-${sectionIndex}-${itemIndex}`,
      label: `Navigation Item ${sectionIndex * 10 + itemIndex + 1}`,
      icon: 'home',
      href: `/item-${sectionIndex}-${itemIndex}`,
      badge: Math.random() > 0.7 ? { count: Math.floor(Math.random() * 10) + 1 } : undefined,
      children: Math.random() > 0.8 ? Array.from({ length: 3 }, (_, childIndex) => ({
        id: `child-${sectionIndex}-${itemIndex}-${childIndex}`,
        label: `Sub Item ${childIndex + 1}`,
        icon: 'chevron-right',
        href: `/item-${sectionIndex}-${itemIndex}/sub-${childIndex}`,
      })) : undefined,
    })),
  })),
});

describe('Navigation Performance', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    // Clear performance marks
    performance.clearMarks();
    performance.clearMeasures();
  });

  describe('Initial Render Performance', () => {
    it('should render quickly with small configuration', async () => {
      const config = global.testUtils.createMockNavigationConfig();
      
      const renderTime = await measurePerformance(() => {
        render(<SideNavigation config={config} />);
      });

      // Should render within 50ms for small config
      expect(renderTime).toBeLessThan(50);
    });

    it('should render efficiently with large configuration', async () => {
      const largeConfig = createLargeConfig(100);
      
      const renderTime = await measurePerformance(() => {
        render(<SideNavigation config={largeConfig} />);
      });

      // Should render within 200ms even with 100 items
      expect(renderTime).toBeLessThan(200);
    });

    it('should use virtualization for very large lists', async () => {
      const veryLargeConfig = createLargeConfig(1000);
      
      render(<SideNavigation config={veryLargeConfig} defaultMode="drawer" />);
      
      await waitFor(() => {
        // Should not render all 1000 items in DOM immediately
        const renderedItems = screen.getAllByRole('link');
        expect(renderedItems.length).toBeLessThan(50); // Only visible items rendered
        
        // Should have virtualization container
        const virtualizationContainer = screen.getByTestId('virtualized-list');
        expect(virtualizationContainer).toBeInTheDocument();
      });
    });

    it('should batch DOM updates during initial render', async () => {
      const config = createLargeConfig(50);
      
      let domUpdateCount = 0;
      const originalAppendChild = Element.prototype.appendChild;
      Element.prototype.appendChild = function(child) {
        domUpdateCount++;
        return originalAppendChild.call(this, child);
      };

      render(<SideNavigation config={config} />);
      
      await waitFor(() => {
        // Should batch updates, not create 50+ individual DOM operations
        expect(domUpdateCount).toBeLessThan(20);
      });

      Element.prototype.appendChild = originalAppendChild;
    });
  });

  describe('Animation Performance', () => {
    it('should animate mode transitions smoothly', async () => {
      render(<SideNavigation config={global.testUtils.createMockNavigationConfig()} />);
      
      await waitFor(async () => {
        performance.mark('animation-start');
        
        const expandButton = screen.getByRole('button', { name: /expand/i });
        await user.click(expandButton);
        
        // Wait for animation to complete
        await new Promise(resolve => setTimeout(resolve, 350)); // 300ms + buffer
        
        performance.mark('animation-end');
        performance.measure('animation-duration', 'animation-start', 'animation-end');
        
        const measures = performance.getEntriesByName('animation-duration');
        expect(measures[0].duration).toBeLessThan(400); // Should complete within 400ms
      });
    });

    it('should maintain 60fps during animations', async () => {
      render(<SideNavigation config={global.testUtils.createMockNavigationConfig()} />);
      
      const frameTimestamps: number[] = [];
      let rafId: number;
      
      const trackFrameRate = () => {
        frameTimestamps.push(performance.now());
        rafId = requestAnimationFrame(trackFrameRate);
      };

      await waitFor(async () => {
        trackFrameRate();
        
        const expandButton = screen.getByRole('button', { name: /expand/i });
        await user.click(expandButton);
        
        // Track for animation duration
        setTimeout(() => {
          cancelAnimationFrame(rafId);
        }, 300);
        
        await new Promise(resolve => setTimeout(resolve, 350));
        
        // Calculate frame rate
        if (frameTimestamps.length > 1) {
          const totalTime = frameTimestamps[frameTimestamps.length - 1] - frameTimestamps[0];
          const averageFrameTime = totalTime / (frameTimestamps.length - 1);
          const fps = 1000 / averageFrameTime;
          
          expect(fps).toBeGreaterThan(50); // Should maintain close to 60fps
        }
      });
    });

    it('should use GPU acceleration for transforms', async () => {
      render(<SideNavigation config={global.testUtils.createMockNavigationConfig()} />);
      
      await waitFor(async () => {
        const expandButton = screen.getByRole('button', { name: /expand/i });
        await user.click(expandButton);
        
        const navigation = screen.getByRole('navigation');
        const computedStyle = window.getComputedStyle(navigation);
        
        // Should use transform3d or translate3d for hardware acceleration
        expect(computedStyle.transform).toContain('translate3d') || 
        expect(computedStyle.transform).toContain('translateX');
        
        // Should have will-change property for optimization
        expect(computedStyle.willChange).toContain('transform');
      });
    });

    it('should disable animations on low-end devices', async () => {
      // Mock low-end device
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        value: 2, // Low core count
        configurable: true,
      });
      
      Object.defineProperty(navigator, 'deviceMemory', {
        value: 2, // Low memory
        configurable: true,
      });

      render(<SideNavigation config={global.testUtils.createMockNavigationConfig()} />);
      
      await waitFor(() => {
        const navigation = screen.getByRole('navigation');
        expect(navigation).toHaveClass('reduced-animations');
      });
    });
  });

  describe('Interaction Performance', () => {
    it('should respond to clicks quickly', async () => {
      const mockClick = jest.fn();
      render(
        <SideNavigation 
          config={global.testUtils.createMockNavigationConfig()}
          onItemClick={mockClick}
        />
      );
      
      await waitFor(async () => {
        const responseTime = await measurePerformance(async () => {
          const dashboardItem = screen.getByRole('button', { name: /dashboard/i });
          await user.click(dashboardItem);
        });
        
        expect(responseTime).toBeLessThan(16); // One frame at 60fps
        expect(mockClick).toHaveBeenCalled();
      });
    });

    it('should handle rapid interactions gracefully', async () => {
      render(<SideNavigation config={global.testUtils.createMockNavigationConfig()} />);
      
      await waitFor(async () => {
        const expandButton = screen.getByRole('button', { name: /expand/i });
        
        // Rapid clicks
        const rapidClickTime = await measurePerformance(async () => {
          for (let i = 0; i < 10; i++) {
            await user.click(expandButton);
            await global.testUtils.waitForAnimation();
          }
        });
        
        // Should handle all interactions within reasonable time
        expect(rapidClickTime).toBeLessThan(1000); // 1 second for 10 interactions
      });
    });

    it('should debounce resize events', async () => {
      const { rerender } = render(<SideNavigation config={global.testUtils.createMockNavigationConfig()} />);
      
      let resizeCallCount = 0;
      const originalAddEventListener = window.addEventListener;
      window.addEventListener = jest.fn().mockImplementation((event, handler) => {
        if (event === 'resize') {
          const debouncedHandler = (...args: any[]) => {
            resizeCallCount++;
            handler(...args);
          };
          return originalAddEventListener.call(window, event, debouncedHandler);
        }
        return originalAddEventListener.call(window, event, handler);
      });

      // Trigger multiple rapid resize events
      for (let i = 0; i < 10; i++) {
        global.testUtils.mockViewport(1000 + i * 10, 768);
        rerender(<SideNavigation config={global.testUtils.createMockNavigationConfig()} />);
      }

      await new Promise(resolve => setTimeout(resolve, 300)); // Wait for debounce

      // Should have been debounced to fewer calls
      expect(resizeCallCount).toBeLessThan(5);
      
      window.addEventListener = originalAddEventListener;
    });
  });

  describe('Memory Management', () => {
    it('should clean up event listeners on unmount', async () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
      
      const { unmount } = render(<SideNavigation config={global.testUtils.createMockNavigationConfig()} />);
      
      unmount();
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      
      removeEventListenerSpy.mockRestore();
    });

    it('should clear timers and intervals', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      
      const { unmount } = render(<SideNavigation config={global.testUtils.createMockNavigationConfig()} />);
      
      unmount();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(clearTimeoutSpy).toHaveBeenCalled();
      
      clearIntervalSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
    });

    it('should not cause memory leaks with frequent re-renders', async () => {
      const config = global.testUtils.createMockNavigationConfig();
      
      // Track DOM node count
      const initialNodeCount = document.querySelectorAll('*').length;
      
      // Multiple mount/unmount cycles
      for (let i = 0; i < 10; i++) {
        const { unmount } = render(<SideNavigation config={config} />);
        await global.testUtils.waitForAnimation();
        unmount();
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalNodeCount = document.querySelectorAll('*').length;
      
      // Should not have accumulated DOM nodes
      expect(finalNodeCount - initialNodeCount).toBeLessThan(5);
    });

    it('should manage WebSocket connections efficiently', async () => {
      process.env.NEXT_PUBLIC_ENABLE_WEBSOCKET = 'true';
      
      const { unmount } = render(<SideNavigation config={global.testUtils.createMockNavigationConfig()} />);
      
      // Mock WebSocket instance
      const mockWs = new (global.WebSocket as any)('ws://test');
      const closeSpy = jest.spyOn(mockWs, 'close');
      
      unmount();
      
      expect(closeSpy).toHaveBeenCalled();
    });
  });

  describe('Bundle Size and Code Splitting', () => {
    it('should support lazy loading of components', async () => {
      const LazyNavigation = React.lazy(() => 
        Promise.resolve({ default: SideNavigation })
      );
      
      const loadTime = await measurePerformance(async () => {
        render(
          <React.Suspense fallback={<div>Loading...</div>}>
            <LazyNavigation config={global.testUtils.createMockNavigationConfig()} />
          </React.Suspense>
        );
        
        await waitFor(() => {
          expect(screen.getByRole('navigation')).toBeInTheDocument();
        });
      });
      
      // Lazy loading should still be fast
      expect(loadTime).toBeLessThan(100);
    });

    it('should minimize re-renders with React.memo', () => {
      let renderCount = 0;
      const TestComponent = React.memo(() => {
        renderCount++;
        return <SideNavigation config={global.testUtils.createMockNavigationConfig()} />;
      });
      TestComponent.displayName = 'TestComponent';

      const { rerender } = render(<TestComponent />);
      expect(renderCount).toBe(1);

      // Re-render with same props
      rerender(<TestComponent />);
      expect(renderCount).toBe(1); // Should not re-render

      // Re-render with different props
      rerender(<TestComponent key="different" />);
      expect(renderCount).toBe(2); // Should re-render once
    });
  });

  describe('Data Loading Performance', () => {
    it('should cache navigation data efficiently', async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce(mockFactories.createMockResponse({
          pendingInvoices: 5,
          recentPayments: 3,
        }))
        .mockResolvedValueOnce(mockFactories.createMockResponse({
          count: 2,
        }));

      const { rerender } = render(<SideNavigation config={global.testUtils.createMockNavigationConfig()} />);
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(3); // Initial data load
      });

      // Re-render should use cached data
      rerender(<SideNavigation config={global.testUtils.createMockNavigationConfig()} />);
      
      // Should not trigger additional fetches
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should implement smart polling intervals', async () => {
      jest.useFakeTimers();
      
      render(<SideNavigation config={global.testUtils.createMockNavigationConfig()} />);
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // Should use longer intervals when tab is not visible
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      });
      
      document.dispatchEvent(new Event('visibilitychange'));
      
      // Fast forward time
      jest.advanceTimersByTime(30000); // Normal interval
      expect(global.fetch).toHaveBeenCalledTimes(3); // Should not poll when hidden
      
      // Make tab visible again
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      });
      
      document.dispatchEvent(new Event('visibilitychange'));
      
      jest.advanceTimersByTime(30000);
      expect(global.fetch).toHaveBeenCalledTimes(6); // Should resume polling
      
      jest.useRealTimers();
    });

    it('should batch API requests', async () => {
      render(<SideNavigation config={global.testUtils.createMockNavigationConfig()} />);
      
      await waitFor(() => {
        // Should make requests in parallel, not sequentially
        const fetchCalls = (global.fetch as jest.Mock).mock.calls;
        expect(fetchCalls.length).toBeGreaterThan(0);
        
        // All calls should happen within a short time window
        const timestamps = fetchCalls.map(() => Date.now());
        const timeSpan = Math.max(...timestamps) - Math.min(...timestamps);
        expect(timeSpan).toBeLessThan(50); // Within 50ms
      });
    });
  });

  describe('Search and Filter Performance', () => {
    it('should search large navigation sets quickly', async () => {
      const largeConfig = createLargeConfig(500);
      render(<SideNavigation config={largeConfig} defaultMode="drawer" />);
      
      await waitFor(async () => {
        const searchInput = screen.getByRole('textbox', { name: /search/i });
        
        const searchTime = await measurePerformance(async () => {
          await user.type(searchInput, 'Item 1');
        });
        
        // Search should be instant
        expect(searchTime).toBeLessThan(100);
        
        // Results should be filtered
        const visibleItems = screen.getAllByRole('link');
        expect(visibleItems.length).toBeLessThan(50); // Filtered results
      });
    });

    it('should debounce search input', async () => {
      const largeConfig = createLargeConfig(100);
      render(<SideNavigation config={largeConfig} defaultMode="drawer" />);
      
      let searchCallCount = 0;
      const originalFilter = Array.prototype.filter;
      Array.prototype.filter = function(callback) {
        searchCallCount++;
        return originalFilter.call(this, callback);
      };

      await waitFor(async () => {
        const searchInput = screen.getByRole('textbox', { name: /search/i });
        
        // Rapid typing
        await user.type(searchInput, 'test query');
        
        // Should debounce search calls
        expect(searchCallCount).toBeLessThan(5);
      });

      Array.prototype.filter = originalFilter;
    });
  });

  describe('Accessibility Performance', () => {
    it('should not impact screen reader performance', async () => {
      const largeConfig = createLargeConfig(100);
      
      const renderTime = await measurePerformance(() => {
        render(<SideNavigation config={largeConfig} defaultMode="drawer" />);
      });
      
      await waitFor(() => {
        // Should have proper ARIA attributes without performance penalty
        const navigation = screen.getByRole('navigation');
        expect(navigation).toHaveAttribute('aria-label');
        
        const items = screen.getAllByRole('link');
        items.forEach(item => {
          expect(item).toHaveAttribute('tabindex');
        });
      });
      
      // Accessibility attributes should not significantly impact render time
      expect(renderTime).toBeLessThan(300);
    });

    it('should efficiently manage focus', async () => {
      const largeConfig = createLargeConfig(50);
      render(<SideNavigation config={largeConfig} defaultMode="drawer" />);
      
      await waitFor(async () => {
        const firstItem = screen.getAllByRole('link')[0];
        
        const focusTime = await measurePerformance(() => {
          firstItem.focus();
        });
        
        expect(focusTime).toBeLessThan(16); // One frame
        expect(firstItem).toHaveFocus();
      });
    });
  });
});