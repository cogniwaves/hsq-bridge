/**
 * Webhooks Management Page
 * Dashboard page for viewing and managing webhook configurations
 */

'use client';

import React from 'react';
import { UserfrontProtectedRoute } from '../../components/auth/UserfrontProtectedRoute';

export default function WebhooksPage() {
  return (
    <UserfrontProtectedRoute>
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Webhooks Management
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            View and manage webhook configurations for all integrated platforms
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="text-center py-8">
            <div className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
              Webhook Management
            </h3>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              Configure and monitor webhooks for real-time data synchronization
            </p>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white">HubSpot Webhooks</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Contact and deal updates
                </p>
                <div className="mt-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    Active
                  </span>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white">Stripe Webhooks</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Payment and invoice events
                </p>
                <div className="mt-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    Active
                  </span>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white">QuickBooks Webhooks</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Transaction notifications
                </p>
                <div className="mt-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                    Pending
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </UserfrontProtectedRoute>
  );
}