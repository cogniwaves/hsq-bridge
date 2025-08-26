# Userfront Authentication Fix - Debug Report

## Problem Summary
User `hsqba@ste-marie.ca` experiencing authentication failures in Docker containerized Next.js dashboard:
- Registration shows "Registration failed" 
- Login fails with "Login failed - no access token received"
- Second registration attempt correctly shows "email exists" (user was created)

## Root Cause Analysis

### Primary Issue: SSR Incompatibility
The Userfront SDK requires browser-specific objects (`window`, `document`) that don't exist during Server-Side Rendering (SSR) in Next.js. When the authentication context tried to initialize Userfront on both server and client, it failed silently on the server side.

### Secondary Issue: Incorrect Parameter Usage
The authentication context was incorrectly passing `tenantId` to `Userfront.login()` and `Userfront.signup()` methods. These methods don't accept a `tenantId` parameter - the workspace is already configured via `Userfront.init()`.

## Evidence Found

1. **Node.js Environment Error**:
   ```
   `window` is not found. Is Userfront core.js running from a browser?
   ```

2. **API Response Status**: 
   - Workspace endpoint returning 404 when called with incorrect parameters
   - Authentication calls failing due to malformed requests

3. **Module Loading Issues**:
   - Userfront Core exports directly (CommonJS style) not as default export
   - TypeScript/ES6 import statements needed adjustment

## Fixes Applied

### 1. Browser-Only Initialization
```typescript
// Track initialization state
let isUserfrontInitialized = false;

function initializeUserfront() {
  if (!isUserfrontInitialized && typeof window !== 'undefined' && typeof document !== 'undefined') {
    console.log('[UserfrontAuth] Initializing Userfront in browser with workspace:', WORKSPACE_ID);
    try {
      Userfront.init(WORKSPACE_ID);
      isUserfrontInitialized = true;
    } catch (error) {
      console.error('[UserfrontAuth] Failed to initialize Userfront:', error);
    }
  }
}
```

### 2. Corrected Login/Signup Methods
```typescript
// BEFORE (incorrect):
const loginOptions = {
  method: 'password',
  email: credentials.email,
  password: credentials.password,
  tenantId: credentials.tenantId  // ❌ Wrong
};

// AFTER (correct):
const loginOptions = {
  method: 'password',
  email: credentials.email,
  password: credentials.password,
  redirect: false  // ✅ Correct - no tenantId here
};
```

### 3. Import Statement Fix
```typescript
// BEFORE:
import Userfront from '@userfront/core';

// AFTER:
import * as UserfrontCore from '@userfront/core';
const Userfront = UserfrontCore as any;
```

### 4. Enhanced Error Logging
Added comprehensive logging at each step:
- Initialization status
- Login/signup attempts
- Response details including token presence
- Full response objects for debugging

## Files Modified

1. `/home/poiqwepoi/PROJETS/OCTOGONE/hsq-bridge/cw_dashboard/src/contexts/UserfrontAuthContext.tsx`
   - Fixed SSR initialization issues
   - Removed incorrect tenantId parameters
   - Added proper error handling and logging
   - Fixed module imports

## Testing & Verification

### How to Test the Fix

1. **Restart the container**:
   ```bash
   docker restart cw_hsq_dashboard
   ```

2. **Monitor logs**:
   ```bash
   docker logs cw_hsq_dashboard -f
   ```

3. **Check browser console**:
   - Open browser developer tools
   - Navigate to http://localhost:13001/auth/signin
   - Look for: `[UserfrontAuth] Initializing Userfront in browser with workspace: 8nwx667b`

4. **Attempt login**:
   - Enter credentials
   - Check console for response logs
   - Verify tokens are received

5. **Verify API endpoint**:
   ```bash
   curl http://localhost:13001/api/test-userfront
   ```

### Expected Behavior After Fix

1. **On page load**:
   - Console shows successful Userfront initialization
   - No SSR errors in server logs

2. **On login attempt**:
   - Console shows login attempt with email
   - Response includes tokens object with accessToken
   - User is redirected to dashboard
   - Tokens stored in browser storage

3. **On registration**:
   - New users created successfully
   - Existing users show proper error message
   - Email verification flow triggered if configured

## Prevention Recommendations

1. **Use Dynamic Imports for Browser-Only Code**:
   ```typescript
   const Userfront = dynamic(() => import('@userfront/core'), {
     ssr: false
   });
   ```

2. **Add Environment Checks**:
   ```typescript
   const isBrowser = () => typeof window !== 'undefined';
   ```

3. **Implement Proper Error Boundaries**:
   - Catch and handle SSR-specific errors
   - Provide fallback UI during hydration

4. **Document SDK Requirements**:
   - Note that Userfront requires browser environment
   - Authentication must happen client-side
   - SSR not supported for auth operations

## Additional Notes

- The workspace ID `8nwx667b` is correctly configured
- Multi-tenant functionality should be handled at application level, not by changing Userfront workspace
- Consider implementing a loading state while Userfront initializes
- Token refresh logic may need similar browser-only guards

## Monitoring Points

Watch for these in production:
- `[UserfrontAuth]` prefixed console logs
- Hydration warnings in Next.js
- Token expiration and refresh cycles
- Browser storage for token persistence

## Contact for Issues

If authentication issues persist after applying these fixes:
1. Check browser console for detailed error messages
2. Verify workspace ID is correct in Userfront dashboard
3. Ensure CORS is properly configured for your domain
4. Check Userfront service status at status.userfront.com