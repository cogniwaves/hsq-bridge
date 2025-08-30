/**
 * System Health Page
 * Dashboard page for monitoring system health and status
 */

'use client';

import React from 'react';
import { UserfrontProtectedRoute } from '../../components/auth/UserfrontProtectedRoute';

export default function HealthPage() {
  return (
    <UserfrontProtectedRoute>
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            System Health
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Monitor the health and status of all integrated systems
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* API Status */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                API Status
              </h3>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-3">
              All API endpoints are responding normally
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span>Uptime:</span>
                <span className="font-mono">99.9%</span>
              </div>
              <div className="flex justify-between">
                <span>Response Time:</span>
                <span className="font-mono">45ms avg</span>
              </div>
            </div>
          </div>

          {/* Database Status */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Database
              </h3>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-3">
              PostgreSQL database is healthy
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span>Connections:</span>
                <span className="font-mono">12/100</span>
              </div>
              <div className="flex justify-between">
                <span>Query Time:</span>
                <span className="font-mono">5ms avg</span>
              </div>
            </div>
          </div>

          {/* Redis Status */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Redis Cache
              </h3>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-3">
              Cache and queue system operational
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span>Memory Usage:</span>
                <span className="font-mono">45.2MB</span>
              </div>
              <div className="flex justify-between">
                <span>Hit Rate:</span>
                <span className="font-mono">94.5%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Integration Status */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Integration Status
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center">
                    🔶
                  </div>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">HubSpot</span>
                </div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Connected and syncing
              </div>
            </div>

            <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                    💳
                  </div>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">Stripe</span>
                </div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Webhooks active
              </div>
            </div>

            <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                    📊
                  </div>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">QuickBooks</span>
                </div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Token refresh needed
              </div>
            </div>
          </div>
        </div>
      </div>
    </UserfrontProtectedRoute>
  );
}