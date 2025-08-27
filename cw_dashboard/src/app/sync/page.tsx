'use client';

import { UserfrontProtectedRoute } from '../../components/auth/UserfrontProtectedRoute';
import Link from 'next/link';

export default function SyncStatusPage() {
  return (
    <UserfrontProtectedRoute>
      <div className="max-w-7xl mx-auto">
        <div className="px-4 py-6 sm:px-0">
          <h1 
            className="text-3xl font-bold mb-8 transition-colors duration-300"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Synchronization Status
          </h1>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* HubSpot Status */}
            <Link href="/sync/hubspot">
              <div 
                className="bg-surface border border-surface-variant rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
              >
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center mr-4">
                    <span className="text-white text-xl">🏢</span>
                  </div>
                  <div>
                    <h3 
                      className="text-lg font-semibold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      HubSpot
                    </h3>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-success rounded-full mr-2"></div>
                      <span className="text-sm text-success">Connected</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--color-text-secondary)' }}>Last Sync:</span>
                    <span style={{ color: 'var(--color-text-primary)' }}>2 min ago</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--color-text-secondary)' }}>Invoices:</span>
                    <span style={{ color: 'var(--color-text-primary)' }}>1,124</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--color-text-secondary)' }}>Status:</span>
                    <span className="text-success">Operational</span>
                  </div>
                </div>
              </div>
            </Link>

            {/* Stripe Status */}
            <Link href="/sync/stripe">
              <div 
                className="bg-surface border border-surface-variant rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
              >
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mr-4">
                    <span className="text-white text-xl">💳</span>
                  </div>
                  <div>
                    <h3 
                      className="text-lg font-semibold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Stripe
                    </h3>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-warning rounded-full mr-2"></div>
                      <span className="text-sm text-warning">Syncing</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--color-text-secondary)' }}>Last Sync:</span>
                    <span style={{ color: 'var(--color-text-primary)' }}>5 min ago</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--color-text-secondary)' }}>Payments:</span>
                    <span style={{ color: 'var(--color-text-primary)' }}>856</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--color-text-secondary)' }}>Status:</span>
                    <span className="text-warning">Processing</span>
                  </div>
                </div>
              </div>
            </Link>

            {/* QuickBooks Status */}
            <Link href="/sync/quickbooks">
              <div 
                className="bg-surface border border-surface-variant rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
              >
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mr-4">
                    <span className="text-white text-xl">📊</span>
                  </div>
                  <div>
                    <h3 
                      className="text-lg font-semibold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      QuickBooks
                    </h3>
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-success rounded-full mr-2"></div>
                      <span className="text-sm text-success">Connected</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--color-text-secondary)' }}>Last Sync:</span>
                    <span style={{ color: 'var(--color-text-primary)' }}>1 min ago</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--color-text-secondary)' }}>Queue:</span>
                    <span style={{ color: 'var(--color-text-primary)' }}>12 pending</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--color-text-secondary)' }}>Status:</span>
                    <span className="text-success">Operational</span>
                  </div>
                </div>
              </div>
            </Link>
          </div>

          {/* Overall Status */}
          <div 
            className="mt-8 bg-surface border border-surface-variant rounded-lg p-6"
          >
            <h2 
              className="text-xl font-semibold mb-4"
              style={{ color: 'var(--color-text-primary)' }}
            >
              System Overview
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-success">99.2%</div>
                <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Uptime</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">2,456</div>
                <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Total Records</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-secondary">15</div>
                <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Sync Errors</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-warning">3.2s</div>
                <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Avg Sync Time</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </UserfrontProtectedRoute>
  );
}