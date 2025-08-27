/**
 * Navigation Theme Integration Example
 * Demonstrates how to use the integrated navigation design tokens
 */

'use client';

import React, { useState } from 'react';
import { useNavigationTheme } from '../../design-system/themes/themeProvider';

// Example navigation item interface
interface NavigationItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  active?: boolean;
}

// Example navigation items
const navigationItems: NavigationItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'invoices', label: 'Invoices', icon: '📄', badge: 3, active: true },
  { id: 'payments', label: 'Payments', icon: '💳' },
  { id: 'sync', label: 'Sync Status', icon: '🔄', badge: 12 },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

type NavigationMode = 'rail' | 'drawer' | 'modal';

export function NavigationExample() {
  const [mode, setMode] = useState<NavigationMode>('drawer');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Use the navigation theme hook
  const {
    navigation,
    mode: themeMode,
    surfaces,
    elevation,
    itemStates,
    layout,
    spacing,
    typography,
    motion,
    zIndex,
  } = useNavigationTheme();

  const handleModeChange = (newMode: NavigationMode) => {
    setMode(newMode);
    if (newMode === 'modal') {
      setIsModalOpen(true);
    } else {
      setIsModalOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-background">
      {/* Mode Controls */}
      <div className="p-4 border-b border-surface-variant">
        <h2 className="text-xl font-semibold mb-4">Navigation Theme Integration Example</h2>
        <div className="flex gap-4">
          <button
            onClick={() => handleModeChange('rail')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              mode === 'rail' ? 'bg-primary text-on-primary' : 'bg-surface-variant'
            }`}
          >
            Rail Mode
          </button>
          <button
            onClick={() => handleModeChange('drawer')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              mode === 'drawer' ? 'bg-primary text-on-primary' : 'bg-surface-variant'
            }`}
          >
            Drawer Mode
          </button>
          <button
            onClick={() => handleModeChange('modal')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              mode === 'modal' ? 'bg-primary text-on-primary' : 'bg-surface-variant'
            }`}
          >
            Modal Mode
          </button>
        </div>
        <p className="mt-2 text-sm text-on-surface-variant">
          Current theme: {themeMode} | Navigation mode: {mode}
        </p>
      </div>

      <div className="flex">
        {/* Modal Backdrop */}
        {mode === 'modal' && isModalOpen && (
          <div 
            className="nav-backdrop open"
            onClick={() => setIsModalOpen(false)}
          />
        )}

        {/* Navigation Container */}
        <nav 
          className={`
            nav-container
            ${mode === 'rail' ? 'nav-rail' : ''}
            ${mode === 'drawer' ? 'nav-drawer' : ''}
            ${mode === 'modal' ? `nav-modal ${isModalOpen ? 'open' : ''}` : ''}
          `}
        >
          {/* Navigation Header */}
          <div className="nav-header">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-on-primary font-bold">H</span>
              </div>
              <div className={`nav-item-text ${mode === 'rail' ? 'opacity-0 w-0' : ''}`}>
                <span className="font-semibold text-lg">HSQ Bridge</span>
              </div>
            </div>
            {mode === 'modal' && (
              <button
                onClick={() => setIsModalOpen(false)}
                className="ml-auto p-2 hover:bg-nav-item-hover rounded-lg"
              >
                ✕
              </button>
            )}
          </div>

          {/* Navigation Content */}
          <div className="nav-content">
            {/* Main Navigation Section */}
            <div className="nav-section">
              <h3 className="nav-section-header">Main</h3>
              {navigationItems.slice(0, 3).map((item) => (
                <NavigationItem
                  key={item.id}
                  item={item}
                  mode={mode}
                />
              ))}
            </div>

            {/* Tools Section */}
            <div className="nav-section">
              <h3 className="nav-section-header">Tools</h3>
              {navigationItems.slice(3).map((item) => (
                <NavigationItem
                  key={item.id}
                  item={item}
                  mode={mode}
                />
              ))}
            </div>

            {/* User Profile */}
            <div className="nav-user-profile">
              <div className="nav-item">
                <div className="nav-user-avatar bg-secondary rounded-full flex items-center justify-center">
                  <span className="text-on-secondary font-semibold">JD</span>
                </div>
                <div className={`nav-user-info ${mode === 'rail' ? 'opacity-0 w-0' : ''}`}>
                  <div className="nav-user-name">John Doe</div>
                  <div className="nav-user-email">john.doe@example.com</div>
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Navigation Theme Integration</h1>
            
            {/* Theme Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-surface border border-surface-variant rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Current Navigation State</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt>Mode:</dt>
                    <dd className="font-medium">{mode}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Width:</dt>
                    <dd className="font-medium">{layout[mode].width}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Background:</dt>
                    <dd className="font-medium">{surfaces[mode].background}</dd>
                  </div>
                </dl>
              </div>

              <div className="bg-surface border border-surface-variant rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Theme Tokens Used</h3>
                <ul className="space-y-1 text-sm">
                  <li>• Navigation surfaces</li>
                  <li>• Item state colors</li>
                  <li>• Elevation system</li>
                  <li>• Motion timings</li>
                  <li>• Typography scales</li>
                  <li>• Z-index layers</li>
                </ul>
              </div>
            </div>

            {/* CSS Custom Properties Example */}
            <div className="bg-surface border border-surface-variant rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">CSS Custom Properties</h3>
              <p className="text-on-surface-variant mb-4">
                The navigation system uses CSS custom properties that automatically update when themes change.
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm font-mono">
                <div>
                  <div className="text-xs text-on-surface-variant mb-2">Layout Variables:</div>
                  <div>--nav-width-rail: {layout.rail.width}</div>
                  <div>--nav-width-drawer: {layout.drawer.width}</div>
                  <div>--nav-item-height: {layout.drawer.itemHeight}</div>
                </div>
                <div>
                  <div className="text-xs text-on-surface-variant mb-2">Color Variables:</div>
                  <div>--nav-drawer-bg: {surfaces.drawer.background}</div>
                  <div>--nav-item-active-bg: {itemStates.active.background}</div>
                  <div>--nav-item-hover-bg: {itemStates.hover.background}</div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// Navigation Item Component
function NavigationItem({ 
  item, 
  mode 
}: { 
  item: NavigationItem; 
  mode: NavigationMode; 
}) {
  return (
    <button
      className={`nav-item ${item.active ? 'active' : ''} relative group`}
    >
      <span className="nav-item-icon">{item.icon}</span>
      <span className="nav-item-text">{item.label}</span>
      
      {/* Badge */}
      {item.badge && (
        <span className="nav-item-badge">
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      )}
      
      {/* Tooltip for rail mode */}
      {mode === 'rail' && (
        <div className="nav-tooltip">
          {item.label}
          {item.badge && ` (${item.badge})`}
        </div>
      )}
    </button>
  );
}