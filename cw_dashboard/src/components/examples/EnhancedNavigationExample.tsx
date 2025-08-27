/**
 * Enhanced Navigation Example
 * Demonstrates the advanced navigation features working together
 */

'use client';

import React, { useState, useEffect } from 'react';
import { EnhancedNavigationRail } from '../navigation/EnhancedNavigationRail';
import { navigationConfig } from '../navigation/navigationConfig';
import { useBadges } from '../../hooks/useBadges';
import { useSmartNavigation } from '../../hooks/useSmartNavigation';
import { 
  HomeIcon, 
  DocumentTextIcon, 
  CreditCardIcon,
  ArrowPathIcon,
  Cog6ToothIcon 
} from '@heroicons/react/24/outline';

// Enhanced navigation config with additional features
const enhancedNavigationConfig = {
  ...navigationConfig,
  sections: navigationConfig.sections.map(section => ({
    ...section,
    collapsible: section.items.length > 2,
    defaultCollapsed: section.id === 'admin' || section.id === 'settings',
  }))
};

export function EnhancedNavigationExample() {
  const [activeItemId, setActiveItemId] = useState('dashboard');
  const [isExpanded, setIsExpanded] = useState(false);

  // Badge management
  const { updateItemBadges, addBadge } = useBadges({
    enableAnimations: true,
    announceChanges: true,
  });

  // Smart navigation features
  const smartNav = useSmartNavigation({
    sections: enhancedNavigationConfig.sections,
    mode: 'rail',
    enableBreadcrumbs: true,
    enableRecentItems: true,
    maxRecentItems: 5,
    enableContextualSuggestions: true,
  });

  // Simulate live badge updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate dynamic badge updates
      const invoiceCount = Math.floor(Math.random() * 20) + 1;
      const paymentCount = Math.floor(Math.random() * 10) + 1;
      const syncCount = Math.floor(Math.random() * 5);

      updateItemBadges('invoices', [{
        id: 'invoice-count',
        type: 'count',
        count: invoiceCount,
        color: 'primary',
        pulse: invoiceCount > 15,
        ariaLabel: `${invoiceCount} pending invoices`
      }]);

      updateItemBadges('payments', [{
        id: 'payment-count',
        type: 'count',
        count: paymentCount,
        color: 'success',
        pulse: false,
        ariaLabel: `${paymentCount} recent payments`
      }]);

      if (syncCount > 0) {
        updateItemBadges('sync-status', [{
          id: 'sync-issues',
          type: 'count',
          count: syncCount,
          color: 'warning',
          pulse: true,
          ariaLabel: `${syncCount} sync issues`
        }]);
      }

      // Add notification badges occasionally
      if (Math.random() > 0.8) {
        addBadge('notifications', {
          id: `notif-${Date.now()}`,
          type: 'status',
          text: 'New',
          color: 'error',
          pulse: true,
          autoHide: 5000,
          ariaLabel: 'New notification'
        });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [updateItemBadges, addBadge]);

  const handleItemClick = (item: any) => {
    setActiveItemId(item.id);
    smartNav.trackNavigation(item);
    
    // Simulate navigation
    console.log(`Navigating to: ${item.label}`);
    
    // In a real app, you would use Next.js router here
    // router.push(item.href);
  };

  const handleBadgeClick = (badgeId: string, itemId: string) => {
    console.log(`Badge ${badgeId} clicked for item ${itemId}`);
    
    // Handle badge-specific actions
    switch (itemId) {
      case 'invoices':
        console.log('Opening invoice management');
        break;
      case 'payments':
        console.log('Opening payment details');
        break;
      case 'sync-status':
        console.log('Opening sync diagnostics');
        break;
      default:
        console.log('Default badge action');
    }
  };

  return (
    <div className="enhanced-nav-example" style={{ 
      height: '100vh', 
      display: 'flex',
      backgroundColor: '#f5f5f5'
    }}>
      {/* Enhanced Navigation Rail */}
      <EnhancedNavigationRail
        config={enhancedNavigationConfig}
        activeItemId={activeItemId}
        onItemClick={handleItemClick}
        onExpandClick={() => setIsExpanded(true)}
        
        // Advanced features enabled
        enableTooltips={true}
        enableBadges={true}
        enableAnimations={true}
        enableGestures={true}
        enableKeyboardNavigation={true}
        
        // Configuration
        animationDuration={300}
        tooltipConfig={{
          showDelay: 500,
          hideDelay: 100,
          position: 'right',
        }}
        
        // Event handlers
        onBadgeClick={handleBadgeClick}
        onSwipeRight={() => setIsExpanded(true)}
        
        // Accessibility announcements
        announcements={{
          itemFocused: (itemName) => console.log(`🎯 Focused: ${itemName}`),
          itemActivated: (itemName) => console.log(`✅ Activated: ${itemName}`),
          badgeUpdated: (itemName, count) => console.log(`🔔 ${itemName}: ${count} notifications`),
        }}
      />

      {/* Main Content Area */}
      <div style={{ 
        flex: 1, 
        marginLeft: '80px', 
        padding: '24px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Breadcrumbs */}
        <nav style={{ 
          marginBottom: '24px', 
          fontSize: '14px', 
          color: '#666' 
        }}>
          {smartNav.breadcrumbs.map((crumb, index) => (
            <span key={crumb.id}>
              {index > 0 && (
                <span style={{ margin: '0 8px', color: '#ccc' }}>
                  /
                </span>
              )}
              <span style={{ 
                color: crumb.isActive ? '#FF6B35' : '#666',
                fontWeight: crumb.isActive ? '600' : '400'
              }}>
                {crumb.label}
              </span>
            </span>
          ))}
        </nav>

        {/* Main Content */}
        <div style={{ 
          flex: 1, 
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '32px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}>
          <h1 style={{ 
            fontSize: '32px',
            fontWeight: '700',
            marginBottom: '16px',
            color: '#1a1a1a'
          }}>
            Enhanced Navigation Demo
          </h1>

          <div style={{ marginBottom: '24px' }}>
            <p style={{ 
              fontSize: '16px',
              lineHeight: '1.6',
              color: '#666',
              marginBottom: '16px'
            }}>
              This demo showcases the advanced navigation features:
            </p>

            <ul style={{ 
              listStyle: 'none',
              padding: 0,
              display: 'grid',
              gap: '12px'
            }}>
              {[
                '🎯 Intelligent tooltips with rich content',
                '🔔 Live badge updates with animations',
                '⌨️ Full keyboard navigation support',
                '📱 Mobile gesture support',
                '🎨 Smooth animations and micro-interactions',
                '♿ Comprehensive accessibility features',
                '🧩 Collapsible sections with persistence',
                '🤖 Smart contextual suggestions'
              ].map((feature, index) => (
                <li key={index} style={{
                  padding: '12px 16px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div style={{ 
            padding: '16px',
            backgroundColor: '#fff3cd',
            borderRadius: '8px',
            border: '1px solid #ffeaa7'
          }}>
            <h3 style={{ 
              fontSize: '16px',
              fontWeight: '600',
              marginBottom: '8px',
              color: '#856404'
            }}>
              Try these features:
            </h3>
            <ul style={{ 
              fontSize: '14px',
              color: '#856404',
              margin: 0,
              paddingLeft: '20px'
            }}>
              <li>Hover over navigation items to see tooltips</li>
              <li>Click on badges to see interactions</li>
              <li>Use keyboard shortcuts: Alt+M, Alt+P, Ctrl+K</li>
              <li>Try arrow keys to navigate</li>
              <li>Watch badges update automatically</li>
            </ul>
          </div>
        </div>

        {/* Recent Items Sidebar */}
        {smartNav.recentItems.length > 0 && (
          <aside style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            width: '240px',
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ 
              fontSize: '14px',
              fontWeight: '600',
              marginBottom: '12px',
              color: '#1a1a1a'
            }}>
              Recent Items
            </h3>
            {smartNav.recentItems.slice(0, 5).map((recentItem) => (
              <button
                key={recentItem.id}
                onClick={() => handleItemClick(recentItem.item)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '13px',
                  marginBottom: '4px',
                  transition: 'background-color 200ms ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div style={{ fontWeight: '500', color: '#1a1a1a' }}>
                  {recentItem.item.label}
                </div>
                <div style={{ fontSize: '11px', color: '#666' }}>
                  Accessed {recentItem.accessCount} time{recentItem.accessCount !== 1 ? 's' : ''}
                </div>
              </button>
            ))}
          </aside>
        )}
      </div>
    </div>
  );
}

export default EnhancedNavigationExample;