'use client';

import { UserfrontProtectedRoute } from '../../components/auth/UserfrontProtectedRoute';

export default function PaymentsPage() {
  return (
    <UserfrontProtectedRoute>
      <div className="max-w-7xl mx-auto">
        <div className="px-4 py-6 sm:px-0">
          <div className="text-center">
            <h1 
              className="text-3xl font-bold mb-4 transition-colors duration-300"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Payment Processing
            </h1>
            <p 
              className="text-lg mb-8 transition-colors duration-300"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Monitor and reconcile payments across all platforms
            </p>
            
            <div 
              className="max-w-2xl mx-auto bg-surface border border-surface-variant rounded-lg p-8"
            >
              <div className="text-6xl mb-4">💳</div>
              <h3 
                className="text-xl font-semibold mb-4"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Payment Reconciliation Hub
              </h3>
              <p 
                className="text-sm mb-6"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                This demo page demonstrates the payment management interface.
                In production, this would show payment matching algorithms,
                reconciliation status, and automated sync processes.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="bg-success/10 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-success">$2.4M</div>
                  <div className="text-sm text-on-surface-variant">Total Processed</div>
                </div>
                <div className="bg-secondary/10 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-secondary">98.7%</div>
                  <div className="text-sm text-on-surface-variant">Match Rate</div>
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
                  Run Matching
                </button>
                <button 
                  className="px-4 py-2 rounded transition-colors duration-300"
                  style={{
                    backgroundColor: 'var(--color-surface-variant)',
                    color: 'var(--color-text-secondary)'
                  }}
                >
                  View Reports
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </UserfrontProtectedRoute>
  );
}