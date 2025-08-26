# Authentication System Documentation

## Phase 5 Implementation Complete

This document describes the comprehensive multi-tenant authentication system implemented for the HS Bridge Dashboard.

## Overview

The authentication system provides secure JWT-based authentication with multi-tenant support, role-based access control, and comprehensive user management features.

## Features Implemented

### 1. Authentication Pages (`src/app/auth/`)
- ✅ **Sign In** (`signin/page.tsx`) - Email/password authentication
- ✅ **Sign Up** (`signup/page.tsx`) - User registration with optional tenant creation
- ✅ **Email Verification** (`verify-email/page.tsx`) - Email verification flow
- ✅ **Forgot Password** (`forgot-password/page.tsx`) - Password reset request
- ✅ **Reset Password** (`reset-password/page.tsx`) - Password reset with token

### 2. Invitation System (`src/app/invitations/`)
- ✅ **Accept Invitation** (`[token]/page.tsx`) - Public page for accepting tenant invitations

### 3. Tenant Management (`src/app/tenants/`)
- ✅ **Tenant Selection** (`select/page.tsx`) - Choose tenant for multi-tenant users

### 4. Authentication Infrastructure

#### Context & State Management (`src/contexts/`)
- ✅ **AuthContext** - Global authentication state and operations
  - User session management
  - Token refresh handling
  - Tenant switching
  - Profile updates

#### Hooks (`src/hooks/`)
- ✅ **useAuth** - Access authentication state and actions
- ✅ **useTenant** - Tenant-specific operations and permissions

#### Utilities (`src/utils/`)
- ✅ **auth.ts** - Core authentication utilities
  - Token management (JWT storage and refresh)
  - API client with interceptors
  - CSRF protection
  - Form validators
  - Error handling

#### Protected Routes (`src/components/auth/`)
- ✅ **ProtectedRoute** - Route protection wrapper
- ✅ **TenantGuard** - Tenant access control
- ✅ **RoleGuard** - Role-based access control
- ✅ **AuthLayout** - Consistent authentication page layout

#### Form Components (`src/components/auth/`)
- ✅ **SignInForm** - Sign in form with validation
- ✅ **SignUpForm** - Registration form with password requirements

### 5. Dashboard Integration
- ✅ Updated main layout with authentication
- ✅ User profile dropdown with sign out
- ✅ Tenant switcher for multi-tenant users
- ✅ Protected dashboard routes
- ✅ JWT token usage in all API calls

## Security Features

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Token Management
- Secure JWT storage in localStorage (with HTTP-only cookie support ready)
- Automatic token refresh before expiration
- Session monitoring with configurable intervals
- Secure logout with token cleanup

### Form Security
- CSRF protection ready (tokens can be fetched)
- Input validation on client and server
- XSS prevention through React's built-in protections
- Rate limiting support through API

### Protected Routes
- Authentication requirement enforcement
- Tenant access validation
- Role-based permissions
- Automatic redirect to sign in

## User Flows

### Registration Flow
1. User fills registration form
2. Optional organization creation
3. Email verification sent
4. Auto-login after verification
5. Redirect to dashboard

### Login Flow
1. User enters credentials
2. JWT tokens received
3. Tenant selection (if multiple)
4. Dashboard redirect
5. Session monitoring starts

### Invitation Flow
1. User receives invitation email
2. Clicks invitation link
3. Creates password (if new user)
4. Auto-joins tenant
5. Dashboard redirect

### Password Reset Flow
1. User requests reset
2. Email with reset link sent
3. User clicks link
4. Sets new password
5. Redirect to sign in

## API Integration

All API calls now use the authenticated `authApi` client which:
- Automatically includes JWT tokens
- Adds tenant context headers
- Handles token refresh
- Manages error responses
- Provides consistent error messages

### Updated API Calls
- Dashboard data fetching
- Invoice operations
- Health checks
- Sync operations
- QuickBooks integration

## Environment Variables

Required in `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:13000
```

## Usage Examples

### Protected Page
```tsx
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function SecurePage() {
  return (
    <ProtectedRoute requireTenant={true}>
      {/* Your protected content */}
    </ProtectedRoute>
  );
}
```

### Using Authentication Hook
```tsx
import { useAuth } from '@/hooks/useAuth';

function MyComponent() {
  const { user, tenant, login, logout } = useAuth();
  
  // Use authentication state and methods
}
```

### Role-Based Access
```tsx
import { RoleGuard } from '@/components/auth/RoleGuard';
import { TenantRole } from '@/types/auth';

function AdminPanel() {
  return (
    <RoleGuard requiredRole={TenantRole.ADMIN}>
      {/* Admin-only content */}
    </RoleGuard>
  );
}
```

## Testing the System

1. **Start the backend API**:
   ```bash
   cd cw_app
   npm run dev
   ```

2. **Start the dashboard**:
   ```bash
   cd cw_dashboard
   npm run dev
   ```

3. **Test Registration**:
   - Navigate to `/auth/signup`
   - Create a new account
   - Verify email (check backend logs)

4. **Test Login**:
   - Navigate to `/auth/signin`
   - Use created credentials
   - Verify dashboard access

5. **Test Protected Routes**:
   - Try accessing `/` without authentication
   - Should redirect to sign in
   - After login, should access dashboard

## Next Steps

### Recommended Enhancements
1. Add social authentication (Google, GitHub)
2. Implement two-factor authentication
3. Add session management page
4. Create audit logs for authentication events
5. Add remember device feature
6. Implement SSO support

### Production Considerations
1. Use HTTP-only cookies for token storage
2. Implement proper CORS configuration
3. Add rate limiting on authentication endpoints
4. Set up email service for verification/reset
5. Configure secure password policies
6. Add security headers
7. Implement session timeout warnings
8. Add device management

## Troubleshooting

### Common Issues

1. **Token Refresh Failures**
   - Check API endpoint availability
   - Verify refresh token validity
   - Check network connectivity

2. **Protected Route Redirects**
   - Ensure tokens are stored properly
   - Check authentication context provider
   - Verify route protection setup

3. **Tenant Switching Issues**
   - Confirm user has multiple tenants
   - Check API response format
   - Verify tenant ID in requests

4. **Form Validation Errors**
   - Review password requirements
   - Check email format validation
   - Ensure all required fields filled

## Support

For issues or questions about the authentication system, please refer to:
- Backend auth routes: `cw_app/src/routes/auth.routes.ts`
- JWT services: `cw_app/src/services/auth/`
- Database schema: `cw_app/prisma/schema.prisma`

---

**Phase 5 Complete** - Full frontend authentication system with protected routes, multi-tenant support, and seamless dashboard integration.