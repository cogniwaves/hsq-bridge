# Firebase Authentication Migration Checklist

## Overview
This document provides a comprehensive checklist for migrating from UserFront authentication to Firebase Authentication while preserving the existing multi-tenant backend system and business logic.

## Migration Strategy
**Hybrid Approach**: Replace UserFront SDK with Firebase Auth on frontend while maintaining existing PostgreSQL-based user/tenant management system on backend.

---

## Phase 1: Frontend Firebase Integration

### 1.1 Dependencies & Setup
- [ ] Install Firebase SDK v10+ (`firebase`)
- [ ] Remove UserFront dependencies (`@userfront/core`, `@userfront/react`)
- [ ] Create Firebase project and obtain configuration
- [ ] Set up environment variables for Firebase config

### 1.2 Firebase Configuration
- [ ] Create `src/utils/firebase.ts` - Firebase initialization and config
- [ ] Create `src/utils/firebaseAuth.ts` - Authentication utilities
- [ ] Set up Firebase authentication providers (email/password, Google, etc.)
- [ ] Configure Firebase security rules

### 1.3 Context & State Management
- [ ] Create `src/contexts/FirebaseAuthContext.tsx` - Replace UserfrontAuthContext
- [ ] Implement Firebase auth state listener (`onAuthStateChanged`)
- [ ] Maintain same interface as UserFront context for seamless migration
- [ ] Add multi-tenant support through custom claims/metadata
- [ ] Create `src/hooks/useFirebaseAuth.ts` - Authentication hook

### 1.4 Authentication Components (14 files to update)
- [ ] Update `src/components/auth/UserfrontSignInForm.tsx` → `FirebaseSignInForm.tsx`
- [ ] Update `src/components/auth/UserfrontSignUpForm.tsx` → `FirebaseSignUpForm.tsx`
- [ ] Update `src/components/auth/UserfrontProtectedRoute.tsx` → `FirebaseProtectedRoute.tsx`
- [ ] Update `src/components/user/UserfrontUserMenu.tsx` → `FirebaseUserMenu.tsx`
- [ ] Update `src/components/layout/AuthenticatedLayout.tsx`
- [ ] Update `src/components/layout/UnauthenticatedLayout.tsx`
- [ ] Update `src/components/auth/AuthLayout.tsx`
- [ ] Update auth pages: signin, signup, reset-password, verify-email, forgot-password
- [ ] Update `src/utils/userfront-helpers.ts` → `firebase-helpers.ts`

### 1.5 Type Definitions
- [ ] Update `src/types/auth.ts` - Replace UserFront types with Firebase types
- [ ] Add Firebase User type mappings
- [ ] Update AuthContextValue interface
- [ ] Create Firebase-specific type definitions

### 1.6 Application Integration
- [ ] Update `src/app/layout.tsx` - Replace UserfrontAuthProvider with FirebaseAuthProvider
- [ ] Update root layout to use Firebase context
- [ ] Update navigation components to use Firebase auth state
- [ ] Update protected routes logic

---

## Phase 2: Backend Firebase Integration

### 2.1 Firebase Admin SDK
- [ ] Install Firebase Admin SDK for Node.js (`firebase-admin`)
- [ ] Create `src/services/auth/firebaseAdminService.ts`
- [ ] Set up Firebase Admin credentials (service account key)
- [ ] Initialize Firebase Admin in backend application

### 2.2 Token Verification
- [ ] Create `src/middleware/firebaseAuth.ts` - Firebase token verification middleware
- [ ] Replace existing JWT middleware with Firebase token verification
- [ ] Maintain multi-tenant header support (`X-Tenant-Id`)
- [ ] Update `src/utils/auth/jwtUtils.ts` for Firebase integration

### 2.3 User Service Updates
- [ ] Update `src/services/auth/userAuthService.ts`
- [ ] Add Firebase UID mapping to existing users
- [ ] Create user synchronization between Firebase and PostgreSQL
- [ ] Implement Firebase user registration flow
- [ ] Update login flow to work with Firebase tokens
- [ ] Maintain existing session management for tenant switching

### 2.4 API Route Updates
- [ ] Update `src/routes/auth.routes.ts`
- [ ] Modify `/auth/login` to accept Firebase tokens
- [ ] Update `/auth/register` for Firebase integration
- [ ] Maintain existing `/auth/me` endpoint for user session data
- [ ] Update `/auth/logout` to work with Firebase
- [ ] Keep existing tenant switching endpoints

### 2.5 Database Schema
- [ ] Add migration to add `firebaseUid` column to `users` table
- [ ] Create indexes for Firebase UID lookups
- [ ] Update Prisma schema with new fields
- [ ] Create migration scripts for existing users
- [ ] Preserve all existing tables and relationships

---

## Phase 3: Integration & Testing

### 3.1 Authentication Flow Testing
- [ ] Test user registration with Firebase
- [ ] Test login/logout flow
- [ ] Test password reset functionality
- [ ] Test email verification
- [ ] Test multi-tenant switching
- [ ] Test role-based access control

### 3.2 Security & Performance
- [ ] Verify Firebase token validation
- [ ] Test account lockout mechanisms
- [ ] Verify session management
- [ ] Test rate limiting
- [ ] Validate CORS settings
- [ ] Check error handling

### 3.3 Migration Scripts
- [ ] Create script to migrate existing UserFront users to Firebase
- [ ] Create rollback procedures
- [ ] Test migration with sample data
- [ ] Create user communication plan

---

## Environment Configuration

### Frontend (.env.local)
```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# Remove UserFront
# NEXT_PUBLIC_USERFRONT_WORKSPACE_ID=8nwx667b (deprecated)
```

### Backend (.env)
```bash
# Firebase Admin Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_ADMIN_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_CLIENT_ID=your-client-id

# Existing configurations remain unchanged
DATABASE_URL=postgresql://hs_bridge_user:password@cw_hsq_postgres:5432/hs_bridge
# ... other existing env vars
```

---

## File Structure Changes

### New Files to Create:
```
cw_dashboard/src/
├── contexts/FirebaseAuthContext.tsx
├── hooks/useFirebaseAuth.ts
├── utils/firebase.ts
├── utils/firebaseAuth.ts
├── utils/firebase-helpers.ts
├── components/auth/FirebaseSignInForm.tsx
├── components/auth/FirebaseSignUpForm.tsx
├── components/auth/FirebaseProtectedRoute.tsx
└── components/user/FirebaseUserMenu.tsx

cw_app/src/
├── services/auth/firebaseAdminService.ts
├── middleware/firebaseAuth.ts
└── migrations/add_firebase_uid_to_users.ts
```

### Files to Modify:
```
cw_dashboard/src/
├── app/layout.tsx (Update provider)
├── types/auth.ts (Firebase types)
├── components/layout/*.tsx (Update context usage)
└── app/auth/**/page.tsx (Update form components)

cw_app/src/
├── services/auth/userAuthService.ts (Firebase integration)
├── routes/auth.routes.ts (Update endpoints)
├── middleware/auth.ts (Firebase token verification)
└── prisma/schema.prisma (Add firebaseUid field)
```

### Files to Remove (after migration):
```
cw_dashboard/src/
├── contexts/UserfrontAuthContext.tsx
├── components/auth/UserfrontSignInForm.tsx
├── components/auth/UserfrontSignUpForm.tsx
├── components/auth/UserfrontProtectedRoute.tsx
├── components/user/UserfrontUserMenu.tsx
└── utils/userfront-helpers.ts
```

---

## Rollback Plan

### If Issues Arise:
1. **Immediate Rollback**: Switch environment variables back to UserFront
2. **Component Rollback**: Revert to UserFront components in layout.tsx
3. **Backend Rollback**: Disable Firebase middleware, re-enable JWT middleware
4. **Database Rollback**: Firebase UID column can remain (no data loss)

### Gradual Migration Option:
- Can implement feature flags to toggle between UserFront and Firebase
- Run both systems in parallel during transition period
- Gradually migrate users to Firebase authentication

---

## Success Criteria

### Functional Requirements:
- [ ] All existing authentication features work with Firebase
- [ ] Multi-tenant system remains fully functional
- [ ] Role-based access control preserved
- [ ] Session management and tenant switching work
- [ ] All security features (lockouts, password policies) maintained

### Technical Requirements:
- [ ] Zero data loss during migration
- [ ] Performance equal or better than UserFront
- [ ] All tests pass
- [ ] Error handling robust and user-friendly
- [ ] Backward compatibility during transition

### User Experience:
- [ ] No change in user interface or workflows
- [ ] Smooth authentication flows
- [ ] Clear error messages
- [ ] Responsive design maintained

---

## Timeline Estimate

- **Phase 1 (Frontend)**: 3-5 days
  - Firebase setup and configuration: 1 day
  - Context and hooks implementation: 1 day
  - Component updates: 2-3 days

- **Phase 2 (Backend)**: 2-3 days
  - Firebase Admin setup: 0.5 day
  - Middleware and service updates: 1.5 days
  - Database schema updates: 1 day

- **Phase 3 (Testing)**: 1-2 days
  - Integration testing: 1 day
  - Security and performance validation: 1 day

**Total Estimated Time**: 6-10 working days

---

## Notes

### Preservation of Business Logic:
- All existing user management, tenant isolation, and role-based access remains unchanged
- Firebase only handles authentication provider functions
- PostgreSQL continues to be the source of truth for business data

### Enhanced Capabilities:
- Access to Firebase's social authentication providers
- Better mobile authentication support
- Real-time auth state synchronization
- Enhanced security with Firebase's infrastructure

### Separation of Concerns:
- **Firebase**: Authentication provider (login, registration, password reset)
- **Backend**: Business logic (tenants, roles, permissions, sessions)
- **Frontend**: UI/UX and state management

This approach provides the best of both worlds: Firebase's robust authentication services combined with the existing sophisticated multi-tenant business logic system.