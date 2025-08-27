'use client';

import { UserfrontProtectedRoute } from '../../components/auth/UserfrontProtectedRoute';

export default function InvoicesPage() {
  return (
    <UserfrontProtectedRoute>
      <div className="max-w-7xl mx-auto">
        <div className="px-4 py-6 sm:px-0">
          <div className="text-center">
            <h1 
              className="text-3xl font-bold mb-4 transition-colors duration-300"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Invoices Management
            </h1>
            <p 
              className="text-lg mb-8 transition-colors duration-300"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Manage and synchronize invoices across HubSpot, Stripe, and QuickBooks
            </p>
            
            <div 
              className="max-w-2xl mx-auto bg-surface border border-surface-variant rounded-lg p-8"
            >
              <div className="text-6xl mb-4">📄</div>
              <h3 
                className="text-xl font-semibold mb-4"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Invoice Management System
              </h3>
              <p 
                className="text-sm mb-6"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                This demo page shows how the navigation system integrates with content pages.
                In a full implementation, this would display invoice lists, search, filters,
                and synchronization status across platforms.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-success/10 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-success">1,124</div>
                  <div className="text-sm text-on-surface-variant">Total Invoices</div>
                </div>
                <div className="bg-primary/10 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-primary">856</div>
                  <div className="text-sm text-on-surface-variant">Synchronized</div>
                </div>
                <div className="bg-warning/10 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-warning">268</div>
                  <div className="text-sm text-on-surface-variant">Pending</div>
                </div>
              </div>
              
              <div className="flex justify-center space-x-4">
                <button 
                  className="px-4 py-2 rounded transition-colors duration-300"
                  style={{
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-on-primary)'
                  }}
                >
                  Sync Now
                </button>
                <button 
                  className="px-4 py-2 rounded transition-colors duration-300"
                  style={{
                    backgroundColor: 'var(--color-surface-variant)',
                    color: 'var(--color-text-secondary)'
                  }}
                >
                  Export Data
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </UserfrontProtectedRoute>
  );
}