'use client';

/**
 * Test page to verify Userfront authentication is working
 */

import { useUserfrontAuth, LoginForm } from '@/contexts/UserfrontAuthContext';
import { useState } from 'react';

export default function AuthTestPage() {
  const { user, isAuthenticated, isLoading, login, logout, error, clearError } = useUserfrontAuth();
  const [showPrebuilt, setShowPrebuilt] = useState(false);

  // Test credentials state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleTestLogin = async () => {
    try {
      await login({ email, password });
    } catch (err) {
      console.error('Login test failed:', err);
    }
  };

  const handleTestLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Logout test failed:', err);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h1 className="text-2xl font-bold mb-4">Userfront Authentication Test</h1>
          
          <div className="space-y-4">
            {/* Authentication Status */}
            <div className="border rounded p-4">
              <h2 className="font-semibold mb-2">Authentication Status</h2>
              <div className="space-y-2 text-sm">
                <p>Loading: {isLoading ? 'Yes' : 'No'}</p>
                <p>Authenticated: {isAuthenticated ? 'Yes' : 'No'}</p>
                <p>User ID: {user?.userId || 'Not logged in'}</p>
                <p>Email: {user?.email || 'Not logged in'}</p>
                <p>Tenant ID: {user?.tenantId || 'No tenant'}</p>
                {error && <p className="text-red-600">Error: {error}</p>}
              </div>
            </div>

            {/* User Object Debug */}
            {user && (
              <div className="border rounded p-4">
                <h2 className="font-semibold mb-2">User Object</h2>
                <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
                  {JSON.stringify(user, null, 2)}
                </pre>
              </div>
            )}

            {/* Custom Login Form */}
            {!isAuthenticated && (
              <div className="border rounded p-4">
                <h2 className="font-semibold mb-2">Test Login</h2>
                <div className="space-y-2">
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                  />
                  <button
                    onClick={handleTestLogin}
                    disabled={isLoading}
                    className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    Test Login
                  </button>
                  {error && (
                    <button
                      onClick={clearError}
                      className="w-full bg-gray-600 text-white py-2 rounded hover:bg-gray-700"
                    >
                      Clear Error
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Logout Button */}
            {isAuthenticated && (
              <div className="border rounded p-4">
                <h2 className="font-semibold mb-2">Test Logout</h2>
                <button
                  onClick={handleTestLogout}
                  disabled={isLoading}
                  className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700 disabled:opacity-50"
                >
                  Test Logout
                </button>
              </div>
            )}

            {/* Prebuilt Form Toggle */}
            <div className="border rounded p-4">
              <h2 className="font-semibold mb-2">Prebuilt Userfront Forms</h2>
              <button
                onClick={() => setShowPrebuilt(!showPrebuilt)}
                className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700"
              >
                {showPrebuilt ? 'Hide' : 'Show'} Prebuilt Login Form
              </button>
              {showPrebuilt && (
                <div className="mt-4">
                  <LoginForm />
                </div>
              )}
            </div>

            {/* Workspace Info */}
            <div className="border rounded p-4">
              <h2 className="font-semibold mb-2">Configuration</h2>
              <div className="space-y-1 text-sm">
                <p>Workspace ID: {process.env.NEXT_PUBLIC_USERFRONT_WORKSPACE_ID || '8nwx667b'}</p>
                <p>SDK Version: @userfront/react v2.0.3</p>
                <p>Core Version: @userfront/core v1.1.2</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}