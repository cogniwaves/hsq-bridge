'use client';

import React, { useState } from 'react';
import { NavigationExample } from '../../components/examples/NavigationExample';
import { SideNavigation } from '../../components/navigation/SideNavigation';
import { useNavigation } from '../../components/navigation/useNavigation';
import { ThemeToggle } from '../../design-system/components/ThemeToggle';
import Link from 'next/link';

export default function NavigationPreviewPage() {
  const [demoMode, setDemoMode] = useState<'examples' | 'live'>('live');
  const { mode, setMode, isModalOpen, setIsModalOpen } = useNavigation();

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
              Material Design 3 Navigation Components - Phase 3 Complete
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
              Design Examples
            </button>
          </div>
        </div>
      </div>

      {/* Demo Content */}
      {demoMode === 'live' ? (
        <LiveNavigationDemo />
      ) : (
        <NavigationExample />
      )}
    </div>
  );
}

function LiveNavigationDemo() {
  const { mode, setMode, isModalOpen, setIsModalOpen } = useNavigation();

  return (
    <div className="h-screen flex overflow-hidden">
      <SideNavigation />
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
                  onClick={() => setMode('rail')}
                  className={`px-4 py-2 text-sm rounded transition-colors ${
                    mode === 'rail' ? 'font-medium' : ''
                  }`}
                  style={{
                    backgroundColor: mode === 'rail' ? 'var(--color-primary)' : 'var(--color-surface-variant)',
                    color: mode === 'rail' ? 'var(--color-on-primary)' : 'var(--color-text-secondary)'
                  }}
                >
                  Navigation Rail (Collapsed)
                </button>
                <button
                  onClick={() => setMode('drawer')}
                  className={`px-4 py-2 text-sm rounded transition-colors ${
                    mode === 'drawer' ? 'font-medium' : ''
                  }`}
                  style={{
                    backgroundColor: mode === 'drawer' ? 'var(--color-primary)' : 'var(--color-surface-variant)',
                    color: mode === 'drawer' ? 'var(--color-on-primary)' : 'var(--color-text-secondary)'
                  }}
                >
                  Navigation Drawer (Full)
                </button>
                <button
                  onClick={() => {
                    setMode('modal');
                    setIsModalOpen(true);
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
                Current mode: <strong>{mode}</strong>
                {mode === 'modal' && isModalOpen && ' (Modal is open)'}
              </p>
            </div>

            {/* Feature Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-surface border border-surface-variant rounded-lg p-6">
                <h4 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                  Features Implemented
                </h4>
                <ul className="space-y-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  <li>✅ Responsive navigation modes (rail/drawer/modal)</li>
                  <li>✅ Theme integration with design tokens</li>
                  <li>✅ Userfront authentication integration</li>
                  <li>✅ HSQ Bridge navigation configuration</li>
                  <li>✅ Badge and notification support</li>
                  <li>✅ Nested navigation items</li>
                  <li>✅ User profile integration</li>
                  <li>✅ Smooth animations and transitions</li>
                </ul>
              </div>

              <div className="bg-surface border border-surface-variant rounded-lg p-6">
                <h4 className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
                  Technical Details
                </h4>
                <ul className="space-y-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  <li>• TypeScript with full type safety</li>
                  <li>• CSS-in-JS with theme variables</li>
                  <li>• React hooks for state management</li>
                  <li>• Tailwind CSS for responsive design</li>
                  <li>• Material Design 3 principles</li>
                  <li>• Accessibility best practices</li>
                  <li>• Performance optimized components</li>
                  <li>• Docker deployment ready</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}