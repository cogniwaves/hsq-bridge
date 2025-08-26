# JWT Authentication System Implementation

## Overview

This document describes the comprehensive JWT-based authentication system implemented for the HSQ Bridge application. The system provides secure multi-tenant authentication with role-based access control, session management, and team collaboration features.

## Architecture Components

### 1. Security Utilities (`src/utils/auth/`)

#### `passwordUtils.ts`
- **Bcrypt password hashing** with configurable salt rounds (default: 12)
- **Password strength validation** following OWASP guidelines
- **Secure password generation** for temporary passwords
- **Timing attack protection** in verification

#### `jwtUtils.ts`
- **JWT token generation** for access and refresh tokens
- **Token verification** with proper error handling
- **Token pair management** with refresh rotation
- **Configurable expiration** (15m access, 7d refresh by default)

#### `tokenUtils.ts`
- **Secure random token generation** for invitations and resets
- **URL-safe token creation** for email links
- **Token hashing** for secure storage
- **Time-limited tokens** with expiration tracking

#### `validationSchemas.ts`
- **Zod validation schemas** for all auth inputs
- **Type-safe validation** with TypeScript integration
- **Comprehensive error messages** for user feedback
- **Input sanitization** and normalization

### 2. Authentication Services (`src/services/auth/`)

#### `userAuthService.ts`
- **User registration** with optional tenant creation
- **Secure login** with account lockout protection
- **Password reset** workflow with email verification
- **Email verification** system
- **Session management** integration

#### `sessionService.ts`
- **JWT session creation** and validation
- **Token refresh** with rotation for security
- **Session cleanup** and expiration handling
- **Activity tracking** and audit logging
- **Multi-device session** support with limits

#### `invitationService.ts`
- **Team invitations** with role assignment
- **Invitation acceptance** workflow
- **Member management** (add/remove/update)
- **Role updates** with permission checks
- **Pending invitation** tracking

#### `tenantService.ts`
- **Tenant creation** and management
- **Tenant switching** for multi-tenant users
- **Subscription management** and limits
- **Tenant statistics** and usage tracking
- **Soft delete** support with data retention

### 3. Middleware (`src/middleware/`)

#### `jwtAuth.ts`
- **JWT authentication** middleware
- **Tenant context injection** into requests
- **Role-based authorization** checks
- **Rate limiting** per user/tenant
- **Audit logging** for security events

#### `auth.ts` (Enhanced)
- **Unified authentication** supporting JWT, API keys, and Basic auth
- **Backward compatibility** with existing API key system
- **Flexible authentication** with fallback options
- **Permission mapping** from tenant roles

## Database Schema

### Authentication Tables

```prisma
model User {
  id                    String    @id @default(uuid())
  email                 String    @unique
  passwordHash          String
  emailVerified         Boolean   @default(false)
  isActive              Boolean   @default(true)
  isSuperAdmin          Boolean   @default(false)
  failedLoginAttempts   Int       @default(0)
  lockedUntil           DateTime?
  tenantMemberships     TenantMembership[]
  sessions              UserSession[]
}

model Tenant {
  id           String    @id @default(uuid())
  name         String
  slug         String    @unique
  isActive     Boolean   @default(true)
  maxUsers     Int       @default(5)
  members      TenantMembership[]
  invitations  TenantInvitation[]
}

model TenantMembership {
  userId     String
  tenantId   String
  role       TenantRole (OWNER|ADMIN|MEMBER|VIEWER)
  isPrimary  Boolean
}

model UserSession {
  id            String    @id @default(uuid())
  userId        String
  tenantId      String?
  sessionToken  String    @unique
  refreshToken  String?   @unique
  expiresAt     DateTime
  revokedAt     DateTime?
}

model TenantInvitation {
  id              String    @id @default(uuid())
  tenantId        String
  email           String
  role            TenantRole
  invitationToken String    @unique
  status          InvitationStatus
  expiresAt       DateTime
}
```

## Security Features

### 1. Password Security
- **Bcrypt hashing** with 12 salt rounds minimum
- **Password complexity requirements** enforced
- **Password history** tracking (optional)
- **Secure reset tokens** with expiration

### 2. Session Security
- **JWT with short expiration** (15 minutes for access tokens)
- **Refresh token rotation** to prevent reuse
- **Session limits** per user (configurable)
- **IP and device tracking** for anomaly detection

### 3. Account Protection
- **Account lockout** after failed attempts (5 attempts, 15-minute lockout)
- **Email verification** required for new accounts
- **Rate limiting** on authentication endpoints
- **Audit logging** for security events

### 4. Multi-Tenant Security
- **Tenant isolation** at database level
- **Role-based permissions** (OWNER > ADMIN > MEMBER > VIEWER)
- **Cross-tenant protection** in all queries
- **Tenant-scoped sessions** and tokens

## API Endpoints

### Public Authentication

```
POST /auth/register          - Register new user
POST /auth/login             - User login
POST /auth/refresh           - Refresh tokens
POST /auth/password-reset/request - Request password reset
POST /auth/password-reset/confirm - Confirm password reset
POST /auth/verify-email      - Verify email address
```

### Protected User Management

```
POST   /auth/logout          - Logout user
POST   /auth/change-password - Change password
GET    /auth/sessions        - List active sessions
DELETE /auth/sessions/:id    - Revoke session
POST   /auth/sessions/revoke-all - Revoke all sessions
```

### Tenant Management

```
GET    /auth/tenants         - List user's tenants
POST   /auth/tenants         - Create new tenant
GET    /auth/tenants/:id     - Get tenant details
PATCH  /auth/tenants/:id     - Update tenant
POST   /auth/tenants/:id/switch - Switch active tenant
GET    /auth/tenants/:id/stats - Get tenant statistics
```

### Team Management

```
POST   /auth/invitations     - Send invitation
GET    /auth/invitations     - List invitations
POST   /auth/invitations/accept - Accept invitation
POST   /auth/invitations/:id/resend - Resend invitation
DELETE /auth/invitations/:id - Revoke invitation
DELETE /auth/members/:userId - Remove member
PATCH  /auth/members/:userId/role - Update member role
```

## Environment Configuration

```bash
# JWT Configuration
JWT_SECRET=your-secure-secret-key-min-32-chars
JWT_REFRESH_SECRET=different-secure-secret-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Security Configuration
BCRYPT_ROUNDS=12
MAX_LOGIN_ATTEMPTS=5
ACCOUNT_LOCKOUT_TIME=15  # minutes
PASSWORD_RESET_EXPIRES=1  # hours
INVITATION_EXPIRES_DAYS=7

# Session Configuration
MAX_SESSIONS_PER_USER=5
MAX_TENANTS_PER_USER=3

# Frontend URL (for invitation links)
FRONTEND_URL=http://localhost:3001
```

## Usage Examples

### 1. User Registration

```typescript
// Request
POST /auth/register
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "confirmPassword": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe",
  "tenantName": "Acme Corp",
  "tenantSlug": "acme-corp",
  "acceptTerms": true
}

// Response
{
  "success": true,
  "data": {
    "user": { "id": "...", "email": "..." },
    "tenant": { "id": "...", "slug": "acme-corp" },
    "tokens": {
      "accessToken": "eyJ...",
      "refreshToken": "eyJ...",
      "accessTokenExpiry": "2024-01-01T12:15:00Z",
      "refreshTokenExpiry": "2024-01-08T12:00:00Z"
    }
  }
}
```

### 2. Authentication with Tenant Context

```typescript
// Login
POST /auth/login
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "tenantSlug": "acme-corp"  // Optional
}

// Use token in requests
GET /api/protected-resource
Headers: {
  "Authorization": "Bearer eyJ..."
}
```

### 3. Team Invitation

```typescript
// Send invitation
POST /auth/invitations
Headers: { "Authorization": "Bearer eyJ..." }
{
  "email": "newmember@example.com",
  "role": "MEMBER",
  "message": "Welcome to our team!"
}

// Accept invitation
POST /auth/invitations/accept
{
  "token": "inv_abc123...",
  "password": "NewUserPassword123!",  // Required for new users
  "firstName": "Jane",
  "lastName": "Smith"
}
```

## Integration with Express App

```typescript
// src/index.ts
import express from 'express';
import authRoutes from './routes/auth.routes';
import { flexibleAuth, requireTenant } from './middleware/auth';

const app = express();

// Public routes
app.use('/auth', authRoutes);

// Protected API routes
app.use('/api', flexibleAuth, requireTenant, apiRoutes);

// Admin routes
app.use('/admin', jwtAuth, requireSuperAdmin, adminRoutes);
```

## Security Best Practices Implemented

1. **Never store plain passwords** - All passwords bcrypt hashed
2. **Use secure random tokens** - Crypto.randomBytes for all tokens
3. **Implement rate limiting** - Protect against brute force
4. **Log security events** - Comprehensive audit trail
5. **Validate all inputs** - Zod schemas for type safety
6. **Use short token expiry** - 15-minute access tokens
7. **Implement token rotation** - Refresh tokens rotate on use
8. **Tenant isolation** - All queries scoped to tenant
9. **Permission checks** - Role-based access control
10. **Account lockout** - Prevent brute force attacks

## Migration from API Key Authentication

The system maintains **full backward compatibility** with the existing API key authentication:

```typescript
// Still works with API keys
curl -H "X-API-Key: your-api-key" http://api/endpoint

// Works with JWT
curl -H "Authorization: Bearer eyJ..." http://api/endpoint

// Works with Basic Auth
curl -u username:password http://api/endpoint
```

## Testing the Authentication System

```bash
# Run authentication-specific tests
npm run test:auth

# Test with coverage
npm run test:auth:coverage

# Integration tests
npm run test:integration
```

## Monitoring and Logging

The system logs all authentication events:
- Login attempts (successful and failed)
- Password changes
- Session creation/revocation
- Tenant switches
- Member additions/removals
- Role changes

Logs include:
- User ID and email
- Tenant context
- IP address
- User agent
- Timestamp
- Action performed

## Troubleshooting

### Common Issues

1. **"Token expired"** - Refresh token or re-authenticate
2. **"Account locked"** - Wait 15 minutes or admin unlock
3. **"Invalid tenant"** - Ensure user has access to tenant
4. **"Insufficient permissions"** - Check user role in tenant
5. **"Session limit reached"** - Revoke old sessions

### Debug Mode

Enable debug logging:
```bash
DEBUG=auth:* npm run dev
```

## Future Enhancements

- [ ] Two-factor authentication (2FA)
- [ ] OAuth2/SAML integration
- [ ] API key management UI
- [ ] Session geolocation tracking
- [ ] Passwordless authentication
- [ ] Biometric authentication support
- [ ] Advanced threat detection
- [ ] Compliance reporting (SOC2, GDPR)