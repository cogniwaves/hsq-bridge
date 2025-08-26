'use client';

import { useState, useEffect } from 'react';
import { UserfrontProtectedRoute } from '../components/auth/UserfrontProtectedRoute';

export default function Dashboard() {
  return (
    <UserfrontProtectedRoute>
      <div 
        className="min-h-screen transition-colors duration-300"
        style={{ backgroundColor: 'var(--color-background)' }}
      >
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="text-center">
            <h1 
              className="text-4xl font-bold mb-4 transition-colors duration-300"
              style={{ color: 'var(--color-text-primary)' }}
            >
              HSQ Bridge Dashboard
            </h1>
            <p 
              className="text-xl mb-8 transition-colors duration-300"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              HubSpot-Stripe-QuickBooks Integration Platform
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              <div 
                className="overflow-hidden shadow rounded-lg transition-colors duration-300"
                style={{ 
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-surface-variant)'
                }}
              >
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg 
                        className="h-6 w-6 transition-colors duration-300" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt 
                          className="text-sm font-medium truncate transition-colors duration-300"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          Total Invoices
                        </dt>
                        <dd 
                          className="text-lg font-medium transition-colors duration-300"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          Loading...
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div 
                className="overflow-hidden shadow rounded-lg transition-colors duration-300"
                style={{ 
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-surface-variant)'
                }}
              >
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg 
                        className="h-6 w-6 transition-colors duration-300" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt 
                          className="text-sm font-medium truncate transition-colors duration-300"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          Total Payments
                        </dt>
                        <dd 
                          className="text-lg font-medium transition-colors duration-300"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          Loading...
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div 
                className="overflow-hidden shadow rounded-lg transition-colors duration-300"
                style={{ 
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-surface-variant)'
                }}
              >
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg 
                        className="h-6 w-6 transition-colors duration-300" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt 
                          className="text-sm font-medium truncate transition-colors duration-300"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          System Status
                        </dt>
                        <dd 
                          className="text-lg font-medium transition-colors duration-300"
                          style={{ color: 'var(--color-success)' }}
                        >
                          Operational
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <div 
                className="shadow overflow-hidden sm:rounded-md transition-colors duration-300"
                style={{ backgroundColor: 'var(--color-surface)' }}
              >
                <div className="px-4 py-5 sm:p-6">
                  <h3 
                    className="text-lg leading-6 font-medium transition-colors duration-300"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Welcome to HSQ Bridge
                  </h3>
                  <div className="mt-2 max-w-xl text-sm">
                    <p style={{ color: 'var(--color-text-secondary)' }}>
                      This is your central dashboard for managing invoice and payment synchronization
                      between HubSpot, Stripe, and QuickBooks.
                    </p>
                  </div>
                  <div className="mt-3">
                    <span 
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors duration-300"
                      style={{ 
                        backgroundColor: 'var(--color-success)', 
                        color: 'white' 
                      }}
                    >
                      Authentication System Deployed
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </UserfrontProtectedRoute>
  );
}