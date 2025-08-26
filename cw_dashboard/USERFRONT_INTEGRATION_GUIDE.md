# Userfront Integration Guide for Multi-Tenant Authentication

## Overview
This guide explains how to use Userfront authentication in this Next.js application with multi-tenant support.

## Installation & Configuration

### Packages Installed
- `@userfront/react` v2.0.3 - React components and hooks
- `@userfront/core` v1.1.2 - Core authentication methods

### Environment Variables
```bash
# Add to .env.local
NEXT_PUBLIC_USERFRONT_WORKSPACE_ID=8nwx667b  # Your Userfront workspace ID
```

## Architecture

### 1. Authentication Context (`/src/contexts/UserfrontAuthContext.tsx`)
The authentication context provides:
- User state management
- Authentication methods (login, register, logout)
- Multi-tenant support
- Error handling
- Loading states

### 2. Key Components

#### UserfrontAuthProvider
Wraps your application and provides authentication context:
```tsx
// In app/layout.tsx
<UserfrontAuthProvider
  loginUrl="/auth/signin"
  loginRedirect="/"
  signupRedirect="/onboarding"
  logoutRedirect="/auth/signin"
  requireAuth={false}
>
  {children}
</UserfrontAuthProvider>
```

#### useUserfrontAuth Hook
Access authentication state and methods:
```tsx
const {
  user,               // User object with profile data
  isAuthenticated,    // Boolean authentication status
  isLoading,          // Loading state
  login,              // Login method
  register,           // Registration method
  logout,             // Logout method
  error,              // Error message
  clearError,         // Clear error message
  setTenantContext,   // Set tenant for multi-tenant apps
  getCurrentTenant    // Get current tenant ID
} = useUserfrontAuth();
```

## Usage Examples

### 1. Login Form Component
```tsx
import { useState } from 'react';
import { useUserfrontAuth } from '@/contexts/UserfrontAuthContext';

export function LoginForm() {
  const { login, isLoading, error } = useUserfrontAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login({ email, password });
      // User will be redirected on successful login
    } catch (error) {
      // Error is available in the context
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
}
```

### 2. Protected Route Component
```tsx
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserfrontAuth } from '@/contexts/UserfrontAuthContext';

export function ProtectedRoute({ children }) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useUserfrontAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/signin');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return null;

  return <>{children}</>;
}
```

### 3. Multi-Tenant Login
```tsx
import { useUserfrontAuth } from '@/contexts/UserfrontAuthContext';

export function TenantLoginForm({ tenantId }) {
  const { login } = useUserfrontAuth();
  
  const handleLogin = async (credentials) => {
    try {
      await login({
        email: credentials.email,
        password: credentials.password,
        tenantId: tenantId  // Pass tenant ID for multi-tenant auth
      });
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    // Your form JSX here
  );
}
```

### 4. User Profile Display
```tsx
import { useUserfrontAuth } from '@/contexts/UserfrontAuthContext';

export function UserProfile() {
  const { user, isAuthenticated, logout } = useUserfrontAuth();

  if (!isAuthenticated) {
    return <p>Not logged in</p>;
  }

  return (
    <div>
      <h2>Welcome, {user.email}</h2>
      <p>User ID: {user.userId}</p>
      <p>Tenant: {user.tenantId || 'No tenant'}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

## Pre-built Components

You can also use Userfront's pre-built components:

```tsx
import { LoginForm, SignupForm, LogoutButton } from '@/contexts/UserfrontAuthContext';

// Use pre-built login form
<LoginForm />

// Use pre-built signup form
<SignupForm />

// Use pre-built logout button
<LogoutButton />
```

## Multi-Tenant Configuration

### Setting Tenant Context
```tsx
const { setTenantContext } = useUserfrontAuth();

// Switch to a specific tenant
setTenantContext('tenant-123');
```

### Tenant-Aware Registration
```tsx
const { register } = useUserfrontAuth();

const handleSignup = async (data) => {
  await register({
    email: data.email,
    password: data.password,
    name: data.name,
    tenantId: 'tenant-123'  // Associate user with tenant
  });
};
```

## JWT Token Access

Access tokens for API calls:
```tsx
import { UserfrontCore } from '@/contexts/UserfrontAuthContext';

// Get access token
const accessToken = UserfrontCore.tokens.accessToken;

// Make authenticated API call
fetch('/api/protected', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

## Security Best Practices

1. **Tenant Isolation**: Always validate tenant context in API routes
2. **Token Validation**: Verify JWT tokens on the server side
3. **HTTPS Only**: Use HTTPS in production
4. **Environment Variables**: Never commit workspace IDs to version control
5. **Error Handling**: Implement proper error boundaries

## Testing

Test your authentication at: `/auth/test`

This page provides:
- Authentication status display
- User object inspection
- Login/logout testing
- Prebuilt form testing
- Configuration verification

## Common Issues & Solutions

### Issue: Import errors
**Solution**: Make sure both `@userfront/react` and `@userfront/core` are installed:
```bash
npm install @userfront/react @userfront/core
```

### Issue: User not persisting after refresh
**Solution**: Ensure UserfrontProvider wraps your entire app in the root layout.

### Issue: Multi-tenant context not working
**Solution**: Pass tenantId in login/register methods and ensure your Userfront workspace supports multi-tenancy.

### Issue: Redirect loops
**Solution**: Check your redirect URLs in UserfrontAuthProvider props and ensure they don't conflict.

## API Reference

### useUserfrontAuth Hook

| Property | Type | Description |
|----------|------|-------------|
| user | object \| null | Current user object with profile data |
| isAuthenticated | boolean | Whether user is authenticated |
| isLoading | boolean | Loading state for auth operations |
| login | function | Login with email/password/tenantId |
| register | function | Register new user |
| logout | function | Logout current user |
| error | string \| null | Current error message |
| clearError | function | Clear error state |
| setTenantContext | function | Set tenant for multi-tenant apps |
| getCurrentTenant | function | Get current tenant ID |

### UserfrontAuthProvider Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| loginUrl | string | '/auth/signin' | Redirect URL for unauthenticated users |
| loginRedirect | string \| false | '/' | Redirect after login |
| signupRedirect | string \| false | '/onboarding' | Redirect after signup |
| logoutRedirect | string \| false | '/auth/signin' | Redirect after logout |
| requireAuth | boolean | false | Require auth for all child components |

## Resources

- [Userfront Documentation](https://userfront.com/docs)
- [React SDK Reference](https://userfront.com/docs/js)
- [Multi-Tenant Guide](https://userfront.com/docs/tenants)
- [JWT Token Reference](https://userfront.com/docs/jwt)