/**
 * Transfer Queue Page
 * Dashboard page for viewing and managing QuickBooks transfer queue
 */

'use client';

import React from 'react';
import { UserfrontProtectedRoute } from '../../components/auth/UserfrontProtectedRoute';

export default function TransfersPage() {
  return (
    <UserfrontProtectedRoute>
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Transfer Queue
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Monitor and manage pending data transfers to QuickBooks
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="text-center py-8">
            <div className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
              Transfer Queue Management
            </h3>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              View pending transfers and approve changes before syncing to QuickBooks
            </p>
            
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-300">0</div>
                <div className="text-sm text-blue-600 dark:text-blue-300">Pending</div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900 rounded-lg p-4">
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-300">0</div>
                <div className="text-sm text-yellow-600 dark:text-yellow-300">Review Needed</div>
              </div>
              <div className="bg-green-50 dark:bg-green-900 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600 dark:text-green-300">0</div>
                <div className="text-sm text-green-600 dark:text-green-300">Completed</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900 rounded-lg p-4">
                <div className="text-2xl font-bold text-red-600 dark:text-red-300">0</div>
                <div className="text-sm text-red-600 dark:text-red-300">Failed</div>
              </div>
            </div>

            <div className="mt-6 text-left">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Recent Transfer Activity
              </h4>
              <div className="text-gray-500 dark:text-gray-400">
                No recent transfer activity to display.
              </div>
            </div>
          </div>
        </div>
      </div>
    </UserfrontProtectedRoute>
  );
}