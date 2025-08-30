/**
 * Navigation Data Hook
 * Manages real-time navigation data updates and user permissions
 */

import { useEffect, useState, useCallback } from 'react';
import { useUserfrontAuth } from '../contexts/UserfrontAuthContext';
import { updateNavigationBadges } from '../components/navigation/navigationConfig';
import { createAPIClient } from '../components/configuration/utils';

export interface NavigationStats {
  pendingInvoices: number;
  recentPayments: number;
  failedWebhooks: number;
  pendingTransfers: number;
  unreadNotifications: number;
  syncStatus: {
    hubspot: 'active' | 'idle' | 'error';
    stripe: 'active' | 'idle' | 'error';
    quickbooks: 'active' | 'idle' | 'error';
  };
}

export function useNavigationData() {
  const { user, isAuthenticated } = useUserfrontAuth();
  
  // Create API client with proper base URL
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:13000';
  const apiClient = createAPIClient(`${API_BASE_URL}/api`);
  const [stats, setStats] = useState<NavigationStats>({
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch navigation stats from API
  const fetchStats = useCallback(async () => {
    if (!isAuthenticated || !user) return;

    try {
      setIsLoading(true);
      setError(null);

      // Fetch from multiple endpoints in parallel
      const [dashboardResponse, syncResponse, notificationResponse] = await Promise.allSettled([
        apiClient.get('/dashboard/stats'),
        apiClient.get('/sync/status'),
        apiClient.get('/notifications/unread-count'),
      ]);

      let newStats: NavigationStats = { ...stats };

      // Process dashboard stats
      if (dashboardResponse.status === 'fulfilled') {
        const dashboardData = dashboardResponse.value;
        newStats = {
          ...newStats,
          pendingInvoices: dashboardData.pendingInvoices || 0,
          recentPayments: dashboardData.recentPayments || 0,
          failedWebhooks: dashboardData.failedWebhooks || 0,
          pendingTransfers: dashboardData.pendingTransfers || 0,
        };
      }

      // Process sync status
      if (syncResponse.status === 'fulfilled') {
        const syncData = syncResponse.value;
        newStats.syncStatus = {
          hubspot: syncData.hubspot?.status || 'idle',
          stripe: syncData.stripe?.status || 'idle',
          quickbooks: syncData.quickbooks?.status || 'idle',
        };
      }

      // Process notification count
      if (notificationResponse.status === 'fulfilled') {
        const notificationData = notificationResponse.value;
        newStats.unreadNotifications = notificationData.count || 0;
      }

      setStats(newStats);
      
      // Update navigation badges
      updateNavigationBadges({
        'invoices': newStats.pendingInvoices,
        'payments': newStats.recentPayments,
        'webhooks': newStats.failedWebhooks,
        'transfer-queue': newStats.pendingTransfers,
        'notifications': newStats.unreadNotifications,
      });
    } catch (err) {
      console.error('Failed to fetch navigation stats:', err);
      setError('Failed to load navigation data');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user]);

  // Initial fetch and polling setup
  useEffect(() => {
    if (!isAuthenticated) return;

    // Initial fetch
    fetchStats();

    // Set up polling for real-time updates
    const pollInterval = setInterval(fetchStats, 30000); // Poll every 30 seconds

    // Clean up on unmount
    return () => clearInterval(pollInterval);
  }, [isAuthenticated, fetchStats]);

  // WebSocket connection for real-time updates (optional)
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Check if WebSocket is available
    if (typeof window === 'undefined' || !window.WebSocket) return;

    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connectWebSocket = () => {
      try {
        // Connect to WebSocket endpoint
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000/ws';
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('WebSocket connected for navigation updates');
          // Send authentication
          ws?.send(JSON.stringify({
            type: 'auth',
            token: user.accessToken,
          }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Handle different message types
            switch (data.type) {
              case 'stats-update':
                setStats(prevStats => ({
                  ...prevStats,
                  ...data.payload,
                }));
                
                // Update badges
                if (data.payload) {
                  updateNavigationBadges(data.payload);
                }
                break;
                
              case 'notification':
                setStats(prevStats => ({
                  ...prevStats,
                  unreadNotifications: prevStats.unreadNotifications + 1,
                }));
                
                // Update notification badge
                updateNavigationBadges({
                  'notifications': stats.unreadNotifications + 1,
                });
                break;
                
              case 'sync-status':
                setStats(prevStats => ({
                  ...prevStats,
                  syncStatus: {
                    ...prevStats.syncStatus,
                    ...data.payload,
                  },
                }));
                break;
            }
          } catch (err) {
            console.error('Failed to parse WebSocket message:', err);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected');
          // Attempt to reconnect after 5 seconds
          reconnectTimeout = setTimeout(connectWebSocket, 5000);
        };
      } catch (err) {
        console.error('Failed to connect WebSocket:', err);
      }
    };

    // Connect WebSocket if enabled
    if (process.env.NEXT_PUBLIC_ENABLE_WEBSOCKET === 'true') {
      connectWebSocket();
    }

    // Cleanup
    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [isAuthenticated, user]);

  // Manually refresh stats
  const refresh = useCallback(() => {
    return fetchStats();
  }, [fetchStats]);

  // Mark notification as read
  const markNotificationRead = useCallback(async (notificationId: string) => {
    if (!isAuthenticated || !user) return;

    try {
      await apiClient.post(`/notifications/${notificationId}/read`);

      // Update local state
      setStats(prevStats => ({
        ...prevStats,
        unreadNotifications: Math.max(0, prevStats.unreadNotifications - 1),
      }));

      // Update navigation badge
      updateNavigationBadges({
        'notifications': Math.max(0, stats.unreadNotifications - 1),
      });
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, [isAuthenticated, user, stats.unreadNotifications, apiClient]);

  return {
    stats,
    isLoading,
    error,
    refresh,
    markNotificationRead,
  };
}

export default useNavigationData;