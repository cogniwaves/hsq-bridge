/**
 * useNavigationData Hook Unit Tests
 * Tests for real-time navigation data management and API integration
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useNavigationData } from '../../../hooks/useNavigationData';
import { mockFactories } from '../../setup/mocks.setup';

// Mock the Userfront auth context
const mockUser = global.testUtils.createMockUser();
const mockAuthContext = {
  user: mockUser,
  isAuthenticated: true,
  isLoading: false,
  error: null,
};

jest.mock('../../../contexts/UserfrontAuthContext', () => ({
  useUserfrontAuth: () => mockAuthContext,
}));

// Mock navigation config updates
const mockUpdateNavigationBadges = jest.fn();
jest.mock('../../../components/navigation/navigationConfig', () => ({
  updateNavigationBadges: mockUpdateNavigationBadges,
}));

describe('useNavigationData', () => {
  let mockFetch: jest.SpyInstance;
  let mockWebSocket: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateNavigationBadges.mockClear();
    
    // Reset fetch mock
    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockClear();
    
    // Mock successful API responses
    mockFetch
      .mockResolvedValueOnce(mockFactories.createMockResponse({
        pendingInvoices: 3,
        recentPayments: 7,
        failedWebhooks: 1,
        pendingTransfers: 2,
      }))
      .mockResolvedValueOnce(mockFactories.createMockResponse({
        hubspot: { status: 'active' },
        stripe: { status: 'idle' },
        quickbooks: { status: 'error' },
      }))
      .mockResolvedValueOnce(mockFactories.createMockResponse({
        count: 5,
      }));
  });

  afterEach(() => {
    // Clean up any intervals or timeouts
    jest.clearAllTimers();
  });

  describe('Initial Data Loading', () => {
    it('should start with loading state', () => {
      const { result } = renderHook(() => useNavigationData());
      
      expect(result.current.isLoading).toBe(true);
      expect(result.current.stats).toEqual({
        pendingInvoices: 0,
        recentPayments: 0,
        failedWebhooks: 0,
        pendingTransfers: 0,
        unreadNotifications: 0,
        syncStatus: {
          hubspot: 'idle',
          stripe: 'idle',
          quickbooks: 'idle',
        },
      });
    });

    it('should fetch stats when authenticated', async () => {
      const { result } = renderHook(() => useNavigationData());
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/dashboard/stats', {
        headers: {
          'Authorization': `Bearer ${mockUser.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/sync/status', {
        headers: {
          'Authorization': `Bearer ${mockUser.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/notifications/unread-count', {
        headers: {
          'Authorization': `Bearer ${mockUser.accessToken}`,
          'Content-Type': 'application/json',
        },
      });
    });

    it('should update stats with fetched data', async () => {
      const { result } = renderHook(() => useNavigationData());
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.stats).toEqual({
        pendingInvoices: 3,
        recentPayments: 7,
        failedWebhooks: 1,
        pendingTransfers: 2,
        unreadNotifications: 5,
        syncStatus: {
          hubspot: 'active',
          stripe: 'idle',
          quickbooks: 'error',
        },
      });
    });

    it('should update navigation badges', async () => {
      const { result } = renderHook(() => useNavigationData());
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockUpdateNavigationBadges).toHaveBeenCalledWith({
        'invoices': 3,
        'payments': 7,
        'webhooks': 1,
        'transfer-queue': 2,
        'notifications': 5,
      });
    });

    it('should not fetch when unauthenticated', () => {
      // Mock unauthenticated state
      const unauthenticatedContext = {
        ...mockAuthContext,
        user: null,
        isAuthenticated: false,
      };
      
      jest.mocked(require('../../../contexts/UserfrontAuthContext').useUserfrontAuth)
        .mockReturnValue(unauthenticatedContext);

      renderHook(() => useNavigationData());

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API Error'));
      
      const { result } = renderHook(() => useNavigationData());
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to load navigation data');
    });

    it('should handle partial API failures', async () => {
      // Mock mixed success/failure responses
      mockFetch
        .mockResolvedValueOnce(mockFactories.createMockResponse({
          pendingInvoices: 5,
        }))
        .mockRejectedValueOnce(new Error('Sync API Error'))
        .mockResolvedValueOnce(mockFactories.createMockResponse({
          count: 3,
        }));
      
      const { result } = renderHook(() => useNavigationData());
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have partial data
      expect(result.current.stats.pendingInvoices).toBe(5);
      expect(result.current.stats.unreadNotifications).toBe(3);
      expect(result.current.stats.syncStatus).toEqual({
        hubspot: 'idle', // Default values when API fails
        stripe: 'idle',
        quickbooks: 'idle',
      });
    });

    it('should handle non-ok responses', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server Error' }),
      });
      
      const { result } = renderHook(() => useNavigationData());
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should use default stats when API returns error
      expect(result.current.stats.pendingInvoices).toBe(0);
    });
  });

  describe('Polling Mechanism', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it('should poll for updates every 30 seconds', async () => {
      renderHook(() => useNavigationData());
      
      // Wait for initial fetch
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(3);
      });

      // Fast-forward 30 seconds
      jest.advanceTimersByTime(30000);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(6); // Initial 3 + polling 3
      });
    });

    it('should clear polling interval on unmount', async () => {
      const { unmount } = renderHook(() => useNavigationData());
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(3);
      });

      unmount();

      // Fast-forward time - should not trigger more calls
      jest.advanceTimersByTime(30000);
      
      expect(mockFetch).toHaveBeenCalledTimes(3); // No additional calls
    });

    it('should not poll when unauthenticated', () => {
      const unauthenticatedContext = {
        ...mockAuthContext,
        user: null,
        isAuthenticated: false,
      };
      
      jest.mocked(require('../../../contexts/UserfrontAuthContext').useUserfrontAuth)
        .mockReturnValue(unauthenticatedContext);

      renderHook(() => useNavigationData());

      // Fast-forward time
      jest.advanceTimersByTime(60000);

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('WebSocket Integration', () => {
    beforeEach(() => {
      // Enable WebSocket in tests
      process.env.NEXT_PUBLIC_ENABLE_WEBSOCKET = 'true';
      process.env.NEXT_PUBLIC_WS_URL = 'ws://localhost:3000/ws';
    });

    afterEach(() => {
      delete process.env.NEXT_PUBLIC_ENABLE_WEBSOCKET;
      delete process.env.NEXT_PUBLIC_WS_URL;
    });

    it('should connect to WebSocket when enabled', async () => {
      const { result } = renderHook(() => useNavigationData());
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // WebSocket should be created
      expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:3000/ws');
    });

    it('should handle WebSocket stats updates', async () => {
      const { result } = renderHook(() => useNavigationData());
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Simulate WebSocket message
      const ws = new (global.WebSocket as any)('ws://test');
      ws.simulateMessage({
        type: 'stats-update',
        payload: {
          pendingInvoices: 10,
          failedWebhooks: 3,
        },
      });

      await waitFor(() => {
        expect(result.current.stats.pendingInvoices).toBe(10);
        expect(result.current.stats.failedWebhooks).toBe(3);
      });
    });

    it('should handle WebSocket notifications', async () => {
      const { result } = renderHook(() => useNavigationData());
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialNotifications = result.current.stats.unreadNotifications;

      // Simulate notification message
      const ws = new (global.WebSocket as any)('ws://test');
      ws.simulateMessage({
        type: 'notification',
        payload: {},
      });

      await waitFor(() => {
        expect(result.current.stats.unreadNotifications).toBe(initialNotifications + 1);
      });
    });

    it('should handle WebSocket sync status updates', async () => {
      const { result } = renderHook(() => useNavigationData());
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Simulate sync status update
      const ws = new (global.WebSocket as any)('ws://test');
      ws.simulateMessage({
        type: 'sync-status',
        payload: {
          hubspot: 'error',
          stripe: 'active',
        },
      });

      await waitFor(() => {
        expect(result.current.stats.syncStatus.hubspot).toBe('error');
        expect(result.current.stats.syncStatus.stripe).toBe('active');
      });
    });

    it('should handle WebSocket connection errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      renderHook(() => useNavigationData());
      
      const ws = new (global.WebSocket as any)('ws://test');
      if (ws.onerror) {
        ws.onerror(new Event('error'));
      }

      expect(consoleSpy).toHaveBeenCalledWith('WebSocket error:', expect.any(Event));
      consoleSpy.mockRestore();
    });
  });

  describe('Manual Refresh', () => {
    it('should provide refresh function', async () => {
      const { result } = renderHook(() => useNavigationData());
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.refresh).toBe('function');
    });

    it('should refetch data when refresh is called', async () => {
      const { result } = renderHook(() => useNavigationData());
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(mockFetch).toHaveBeenCalledTimes(3);
      });

      // Call refresh
      await result.current.refresh();

      expect(mockFetch).toHaveBeenCalledTimes(6); // Initial 3 + refresh 3
    });
  });

  describe('Notification Management', () => {
    it('should provide markNotificationRead function', async () => {
      const { result } = renderHook(() => useNavigationData());
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.markNotificationRead).toBe('function');
    });

    it('should mark notification as read', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('notifications') && url.includes('read')) {
          return Promise.resolve(mockFactories.createMockResponse({}));
        }
        return Promise.resolve(mockFactories.createMockResponse({}));
      });

      const { result } = renderHook(() => useNavigationData());
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialCount = result.current.stats.unreadNotifications;

      await result.current.markNotificationRead('notification-123');

      expect(mockFetch).toHaveBeenCalledWith('/api/notifications/notification-123/read', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mockUser.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      await waitFor(() => {
        expect(result.current.stats.unreadNotifications).toBe(Math.max(0, initialCount - 1));
      });
    });

    it('should handle notification read errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Read notification failed'));

      const { result } = renderHook(() => useNavigationData());
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await result.current.markNotificationRead('notification-123');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to mark notification as read:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Badge Updates', () => {
    it('should update badges when stats change', async () => {
      const { result } = renderHook(() => useNavigationData());
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockUpdateNavigationBadges).toHaveBeenCalledWith({
        'invoices': expect.any(Number),
        'payments': expect.any(Number),
        'webhooks': expect.any(Number),
        'transfer-queue': expect.any(Number),
        'notifications': expect.any(Number),
      });
    });

    it('should update badges on WebSocket updates', async () => {
      process.env.NEXT_PUBLIC_ENABLE_WEBSOCKET = 'true';

      renderHook(() => useNavigationData());
      
      await waitFor(() => {
        expect(mockUpdateNavigationBadges).toHaveBeenCalled();
      });

      mockUpdateNavigationBadges.mockClear();

      // Simulate WebSocket update
      const ws = new (global.WebSocket as any)('ws://test');
      ws.simulateMessage({
        type: 'stats-update',
        payload: { pendingInvoices: 15 },
      });

      await waitFor(() => {
        expect(mockUpdateNavigationBadges).toHaveBeenCalledWith({ pendingInvoices: 15 });
      });
    });
  });

  describe('Memory Management', () => {
    it('should clean up WebSocket on unmount', async () => {
      process.env.NEXT_PUBLIC_ENABLE_WEBSOCKET = 'true';

      const { unmount } = renderHook(() => useNavigationData());
      
      await waitFor(() => {
        expect(global.WebSocket).toHaveBeenCalled();
      });

      const mockClose = jest.fn();
      const ws = new (global.WebSocket as any)('ws://test');
      ws.close = mockClose;

      unmount();

      expect(mockClose).toHaveBeenCalled();
    });

    it('should clear timers on unmount', async () => {
      jest.useFakeTimers();
      
      const { unmount } = renderHook(() => useNavigationData());
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
      
      jest.useRealTimers();
    });
  });
});