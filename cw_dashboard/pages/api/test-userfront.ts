/**
 * API endpoint to test Userfront authentication configuration
 * Access this at http://localhost:13001/api/test-userfront
 */

import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const workspaceId = process.env.NEXT_PUBLIC_USERFRONT_WORKSPACE_ID || '8nwx667b';
  
  res.status(200).json({
    status: 'ok',
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      WORKSPACE_ID: workspaceId,
      IS_BROWSER: typeof window !== 'undefined',
      IS_SERVER: typeof window === 'undefined',
    },
    configuration: {
      workspace: workspaceId,
      apiUrl: 'https://api.userfront.com',
      authUrl: 'https://auth.userfront.com',
    },
    diagnostics: {
      message: 'Userfront is configured for client-side authentication only',
      requirements: [
        'Must be running in browser environment',
        'Requires valid workspace ID',
        'Authentication happens on client side',
        'SSR not supported for auth operations'
      ]
    },
    testSteps: [
      '1. Open browser console',
      '2. Navigate to login page',
      '3. Check console for [UserfrontAuth] initialization message',
      '4. Attempt login and check for response logs',
      '5. Verify tokens are stored in browser storage'
    ]
  });
}