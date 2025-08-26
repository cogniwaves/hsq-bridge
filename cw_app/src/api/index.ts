import { Router } from 'express';
import { invoiceRoutes } from './invoices';
import { paymentRoutes } from './payments';
import { syncRoutes } from './sync';
import { dashboardRoutes } from './dashboard';
import { dashboardEnhancedRoutes } from './dashboardEnhanced';
import { metricsRoutes } from './metrics';
import { webhookRoutes } from './webhooks';
import { testRoutes } from './test';
import { extractRoutes } from './extract';
import { analysisRoutes } from './analysis';
import { adminRoutes } from './admin';
import { batchRoutes } from './batch';
import { quickbooksRoutes } from './quickbooks';
import { authRoutes } from './auth';
import { tokenManagementRoutes } from './tokenManagement';
// New multi-tenant authentication routes
import { userAuthRoutes } from './userAuth';
// import { tenantRoutes } from './tenants';
// import { invitationRoutes } from './invitations';
import { ApiHandler } from '../types/api';
import { flexibleAuth, requirePermission, logAuthenticatedRequest } from '../middleware/auth';
import { rateLimits } from '../middleware/rateLimiting';
import { 
  addTenantContext, 
  logTenantOperation, 
  sanitizeTenantResponse 
} from '../middleware/tenantAware';

export const apiRoutes = Router();

// Public endpoints (no auth required)
apiRoutes.get('/', rateLimits.public, ((req, res) => {
  res.json({
    name: 'HubSpot-Stripe-QuickBooks Bridge API',
    version: '1.0.0',
    status: 'operational',
    environment: process.env.NODE_ENV || 'development',
    authentication: {
      required: true,
      methods: ['JWT Bearer Token', 'API Key', 'Basic Auth'],
      headers: {
        jwt: 'Authorization: Bearer your-jwt-token',
        apiKey: 'X-API-Key: your-api-key',
        basicAuth: 'Authorization: Basic base64(username:password)'
      }
    },
    endpoints: {
      // Multi-Tenant Authentication endpoints
      register: '/api/auth/register (public)',
      login: '/api/auth/login (public)',
      logout: '/api/auth/logout (JWT required)',
      refresh: '/api/auth/refresh (public)',
      me: '/api/auth/me (JWT required)',
      profile: '/api/auth/profile (JWT required)',
      verifyEmail: '/api/auth/verify-email (public)',
      forgotPassword: '/api/auth/forgot-password (public)',
      resetPassword: '/api/auth/reset-password (public)',
      changePassword: '/api/auth/change-password (JWT required)',
      
      // Tenant Management endpoints
      tenants: '/api/tenants (JWT required)',
      createTenant: '/api/tenants (JWT required)',
      tenantDetails: '/api/tenants/:id (JWT required)',
      updateTenant: '/api/tenants/:id (JWT + Admin/Owner)',
      deleteTenant: '/api/tenants/:id (JWT + Owner)',
      switchTenant: '/api/tenants/:id/switch (JWT required)',
      tenantMembers: '/api/tenants/:id/members (JWT required)',
      updateMemberRole: '/api/tenants/:id/members/:userId/role (JWT + Admin/Owner)',
      removeMember: '/api/tenants/:id/members/:userId (JWT + Admin/Owner)',
      
      // Invitation endpoints
      sendInvitation: '/api/invitations (JWT + Admin/Owner)',
      listInvitations: '/api/invitations (JWT required)',
      receivedInvitations: '/api/invitations/received (JWT required)',
      acceptInvitation: '/api/invitations/:token/accept (public)',
      rejectInvitation: '/api/invitations/:token/reject (public)',
      resendInvitation: '/api/invitations/:id/resend (JWT + Admin/Owner)',
      revokeInvitation: '/api/invitations/:id (JWT + Admin/Owner)',
      invitationInfo: '/api/invitations/:token/info (public)',
      
      // Core business endpoints
      invoices: '/api/invoices (auth required)',
      payments: '/api/payments (auth required)',
      sync: '/api/sync (write permission required)',
      dashboard: '/api/dashboard (read permission required)',
      dashboardV2: '/api/dashboard-v2 (tenant-aware, read permission required)',
      metrics: '/api/metrics (read permission required)',
      webhooks: '/api/webhooks (webhook auth)',
      
      // Testing endpoints
      testHubSpot: '/api/test/hubspot (read permission required)',
      testLineItems: '/api/test/line-items/:invoiceId (read permission required)',
      
      // Extraction endpoints
      extractInvoices: '/api/extract/hubspot-invoices (write permission required)',
      extractNormalized: '/api/extract/hubspot-invoices-normalized (write permission required)',
      extractEnhanced: '/api/extract/hubspot-invoices-enhanced (write permission required)',
      
      // Analysis endpoints
      sqlValidation: '/api/analysis/sql-validation (read permission required)',
      taxBreakdownAnalysis: '/api/analysis/tax-breakdown-analysis (read permission required)',
      
      // QuickBooks Transfer Queue endpoints
      queueList: '/api/quickbooks/queue (write permission required)',
      queueSummary: '/api/quickbooks/queue/summary (write permission required)',
      processChanges: '/api/quickbooks/queue/process-changes (write permission required)',
      approveEntry: '/api/quickbooks/queue/:id/approve (write permission required)',
      bulkApprove: '/api/quickbooks/queue/bulk-approve (write permission required)'
    },
    features: [
      'Multi-Tenant Authentication with JWT Bearer Tokens',
      'Role-Based Access Control (Owner, Admin, Member)',
      'Team Invitation System with Email Notifications',
      'Secure Password Reset and Email Verification',
      'Tenant Management and Switching',
      'HubSpot Invoice Extraction with Line Items & Taxes',
      'Multi-currency Support (CAD, USD, etc.)',
      'Real-time Webhook Processing',
      'Enhanced Tax Breakdown (TPS, TVQ, GST, VAT)',
      'Business Intelligence SQL Analytics',
      'Multi-Entity Incremental Synchronization',
      'QuickBooks Transfer Queue with Human-in-the-Loop Validation',
      'Cascade Impact Detection for Entity Dependencies',
      'Comprehensive Testing Framework',
      'API Authentication & Rate Limiting'
    ],
    lastUpdated: new Date().toISOString()
  });
}) as ApiHandler);

apiRoutes.get('/health', rateLimits.public, ((req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
}) as ApiHandler);

// New Multi-Tenant Authentication Routes (before flexibleAuth middleware)
// These routes handle their own authentication internally
apiRoutes.use('/auth', userAuthRoutes); // User authentication endpoints
// apiRoutes.use('/tenants', tenantRoutes); // Tenant management endpoints  
// apiRoutes.use('/invitations', invitationRoutes); // Invitation system endpoints

// Authentication middleware pour toutes les routes protégées legacy
apiRoutes.use(flexibleAuth);
apiRoutes.use(logAuthenticatedRequest);

// Add tenant context to all authenticated routes
apiRoutes.use(addTenantContext);
apiRoutes.use(sanitizeTenantResponse);

// Core business routes (authenticated)
apiRoutes.use('/invoices', rateLimits.api, requirePermission('read'), invoiceRoutes);
apiRoutes.use('/payments', rateLimits.api, requirePermission('read'), paymentRoutes);
apiRoutes.use('/sync', rateLimits.write, requirePermission('write'), syncRoutes);
apiRoutes.use('/dashboard', rateLimits.read, requirePermission('read'), dashboardRoutes);
// Enhanced tenant-aware dashboard (example)
apiRoutes.use('/dashboard-v2', rateLimits.read, requirePermission('read'), dashboardEnhancedRoutes);
apiRoutes.use('/metrics', rateLimits.read, requirePermission('read'), metricsRoutes);
apiRoutes.use('/webhooks', rateLimits.webhook, webhookRoutes); // Webhooks ont leur propre auth

// Development and testing routes (authenticated)
apiRoutes.use('/test', rateLimits.api, requirePermission('read'), testRoutes);
apiRoutes.use('/extract', rateLimits.write, requirePermission('write'), extractRoutes);
apiRoutes.use('/analysis', rateLimits.read, requirePermission('read'), analysisRoutes);

// Batch synchronization routes (write permission required)
apiRoutes.use('/batch', requirePermission('write'), batchRoutes);

// QuickBooks transfer queue routes (write permission required)
apiRoutes.use('/quickbooks', requirePermission('write'), quickbooksRoutes);

// Authentication routes (write permission required)
// Temporarily disabled to avoid route conflicts
// apiRoutes.use('/auth', requirePermission('write'), authRoutes);

// Token management routes (write permission required)
apiRoutes.use('/tokens', requirePermission('write'), tokenManagementRoutes);

// Admin routes (admin permission required)
apiRoutes.use('/admin', rateLimits.admin, adminRoutes);

