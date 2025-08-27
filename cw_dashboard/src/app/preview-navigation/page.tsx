'use client';

import React, { useState } from 'react';
import { NavigationExample } from '../../components/examples/NavigationExample';
import { EnhancedNavigationExample } from '../../components/examples/EnhancedNavigationExample';
import { SideNavigation, useNavigationContext } from '../../components/navigation/SideNavigation';
import { ThemeToggle } from '../../design-system/components/ThemeToggle';
import Link from 'next/link';

export default function NavigationPreviewPage() {
  const [demoMode, setDemoMode] = useState<'examples' | 'enhanced' | 'live'>('enhanced');

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      {/* Header */}
      <header 
        className="border-b px-6 py-4"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-surface-variant)'
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
              Navigation System Preview
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Advanced Navigation System - Phase 4 Complete with Enterprise Features
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className="text-sm px-3 py-1 rounded"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-on-primary)'
              }}
            >
              Back to Dashboard
            </Link>
            <ThemeToggle variant="icon" size="medium" showTooltip includeSystem />
          </div>
        </div>
      </header>

      {/* Demo Mode Toggle */}
      <div className="px-6 py-4 border-b" style={{ backgroundColor: 'var(--color-surface)' }}>
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
            Demo Mode:
          </span>
          <div className="flex space-x-2">
            <button
              onClick={() => setDemoMode('enhanced')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                demoMode === 'enhanced' ? 'font-medium' : ''
              }`}
              style={{
                backgroundColor: demoMode === 'enhanced' ? 'var(--color-primary)' : 'var(--color-surface-variant)',
                color: demoMode === 'enhanced' ? 'var(--color-on-primary)' : 'var(--color-text-secondary)'
              }}
            >
              Phase 4 Enhanced
            </button>
            <button
              onClick={() => setDemoMode('live')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                demoMode === 'live' ? 'font-medium' : ''
              }`}
              style={{
                backgroundColor: demoMode === 'live' ? 'var(--color-primary)' : 'var(--color-surface-variant)',
                color: demoMode === 'live' ? 'var(--color-on-primary)' : 'var(--color-text-secondary)'
              }}
            >
              Live Navigation
            </button>
            <button
              onClick={() => setDemoMode('examples')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                demoMode === 'examples' ? 'font-medium' : ''
              }`}
              style={{
                backgroundColor: demoMode === 'examples' ? 'var(--color-primary)' : 'var(--color-surface-variant)',
                color: demoMode === 'examples' ? 'var(--color-on-primary)' : 'var(--color-text-secondary)'
              }}
            >
              Basic Examples
            </button>
          </div>
        </div>
      </div>

      {/* Demo Content */}
      {demoMode === 'enhanced' ? (
        <EnhancedNavigationExample />
      ) : demoMode === 'live' ? (
        <SideNavigation>
          <LiveNavigationDemo />
        </SideNavigation>
      ) : (
        <NavigationExample />
      )}
    </div>
  );
}

function LiveNavigationDemo() {
  const navigation = useNavigationContext();
  const { state, dispatch } = navigation;

  return (
    <div className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
              Live Navigation System
            </h2>
            <p className="mb-6" style={{ color: 'var(--color-text-secondary)' }}>
              This is the actual navigation system integrated with the HSQ Bridge application.
              Try resizing your browser window to see the responsive behavior!
            </p>

            {/* Navigation Controls */}
            <div className="bg-surface border border-surface-variant rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                Navigation Controls
              </h3>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => dispatch({ type: 'SET_MODE', mode: 'rail' })}
                  className={`px-4 py-2 text-sm rounded transition-colors ${
                    state.mode === 'rail' ? 'font-medium' : ''
                  }`}
                  style={{
                    backgroundColor: state.mode === 'rail' ? 'var(--color-primary)' : 'var(--color-surface-variant)',
                    color: state.mode === 'rail' ? 'var(--color-on-primary)' : 'var(--color-text-secondary)'
                  }}
                >
                  Navigation Rail (Collapsed)
                </button>
                <button
                  onClick={() => dispatch({ type: 'SET_MODE', mode: 'drawer' })}
                  className={`px-4 py-2 text-sm rounded transition-colors ${
                    state.mode === 'drawer' ? 'font-medium' : ''
                  }`}
                  style={{
                    backgroundColor: state.mode === 'drawer' ? 'var(--color-primary)' : 'var(--color-surface-variant)',
                    color: state.mode === 'drawer' ? 'var(--color-on-primary)' : 'var(--color-text-secondary)'
                  }}
                >
                  Navigation Drawer (Full)
                </button>
                <button
                  onClick={() => {
                    dispatch({ type: 'SET_MODE', mode: 'modal' });
                    dispatch({ type: 'SET_OPEN', isOpen: true });
                  }}
                  className={`px-4 py-2 text-sm rounded transition-colors`}
                  style={{
                    backgroundColor: 'var(--color-secondary)',
                    color: 'var(--color-on-secondary)'
                  }}
                >
                  Show Navigation Modal
                </button>
              </div>
              <p className="mt-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Current mode: <strong>{state.mode}</strong>
                {state.mode === 'modal' && state.isOpen && ' (Modal is open)'}
              </p>
            </div>

            {/* Feature Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-surface border border-surface-variant rounded-lg p-6">
                <h4 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                  Features Implemented
                </h4>
                <ul className="space-y-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  <li>✅ Advanced navigation rail with tooltips & badges</li>
                  <li>✅ Collapsible sections with smooth animations</li>
                  <li>✅ Smart navigation with recent items</li>
                  <li>✅ Enhanced keyboard navigation (Alt+M, Ctrl+K)</li>
                  <li>✅ Live badge updates with pulse animations</li>
                  <li>✅ Intelligent tooltip positioning</li>
                  <li>✅ Swipe gestures for mobile</li>
                  <li>✅ Material Design ripple effects</li>
                  <li>✅ User profile with avatar upload</li>
                  <li>✅ Navigation preferences persistence</li>
                </ul>
              </div>

              <div className="bg-surface border border-surface-variant rounded-lg p-6">
                <h4 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                  Technical Details
                </h4>
                <ul className="space-y-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  <li>• Enterprise-grade hook system (15 hooks)</li>
                  <li>• Advanced animation system with presets</li>
                  <li>• Touch gesture recognition for mobile</li>
                  <li>• User preference persistence in localStorage</li>
                  <li>• Live badge system with real-time updates</li>
                  <li>• Screen reader accessibility with announcements</li>
                  <li>• Auto-hide notifications with timers</li>
                  <li>• Context-aware tooltip positioning</li>
                  <li>• Keyboard shortcuts and type-ahead search</li>
                  <li>• Docker deployment with Phase 4 features</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
    </div>
  );
}