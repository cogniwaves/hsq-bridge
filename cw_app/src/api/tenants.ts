import { Router, Response } from 'express';
import { logger } from '../utils/logger';
import { createSuccessResponse, createErrorResponse, createPaginatedResponse } from '../utils/responses';
import { rateLimits } from '../middleware/rateLimiting';
import { 
  jwtAuth, 
  JWTAuthenticatedRequest, 
  requireTenantRole, 
  requireTenant,
  auditLog,
  tenantIsolation
} from '../middleware/jwtAuth';
import { tenantService } from '../services/auth/tenantService';
import { 
  validateRequest,
  tenantCreationSchema,
  tenantUpdateSchema,
  tenantSwitchSchema,
  memberRoleUpdateSchema,
  removeMemberSchema,
  ValidationError
} from '../utils/auth/validationSchemas';
import { TenantRole } from '@prisma/client';

/**
 * Tenant Management API Routes
 * Handles tenant CRUD operations, member management, and tenant switching
 */
export const tenantRoutes = Router();

// Apply JWT authentication to all tenant routes
tenantRoutes.use(jwtAuth);

/**
 * GET /api/tenants - List user's tenants
 */
tenantRoutes.get('/', rateLimits.api, async (req: JWTAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenants = await tenantService.getUserTenants(req.auth!.userId);

    res.json(createSuccessResponse({
      tenants: tenants.map(membership => ({
        id: membership.tenant.id,
        name: membership.tenant.name,
        slug: membership.tenant.slug,
        description: membership.tenant.description,
        domain: membership.tenant.domain,
        logo: membership.tenant.logo,
        isActive: membership.tenant.isActive,
        role: membership.role,
        joinedAt: membership.createdAt,
        isCurrentTenant: req.tenant?.id === membership.tenant.id,
        memberCount: membership.tenant._count?.memberships || 0,
      })),
      currentTenantId: req.tenant?.id || null,
    }, 'Tenants retrieved successfully'));

  } catch (error) {
    logger.error('Failed to retrieve user tenants', {
      userId: req.auth!.userId,
      error: error.message,
    });

    res.status(500).json(createErrorResponse(
      'Tenant retrieval failed',
      'Unable to retrieve your tenants. Please try again.'
    ));
  }
});

/**
 * POST /api/tenants - Create new tenant
 */
tenantRoutes.post('/', rateLimits.write, auditLog('tenant_creation'), async (req: JWTAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validatedData = validateRequest(tenantCreationSchema, req.body);

    const tenant = await tenantService.createTenant(req.auth!.userId, validatedData);

    logger.info('Tenant created successfully', {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      createdBy: req.auth!.userId,
      ip: req.ip,
    });

    res.status(201).json(createSuccessResponse({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        description: tenant.description,
        domain: tenant.domain,
        industry: tenant.industry,
        size: tenant.size,
        country: tenant.country,
        timezone: tenant.timezone,
        logo: tenant.logo,
        isActive: tenant.isActive,
        createdAt: tenant.createdAt,
      },
      membership: {
        role: TenantRole.OWNER,
        joinedAt: new Date().toISOString(),
      },
    }, 'Tenant created successfully'));

  } catch (error) {
    logger.error('Tenant creation failed', {
      userId: req.auth!.userId,
      tenantSlug: req.body?.slug,
      error: error.message,
      ip: req.ip,
    });

    if (error instanceof ValidationError) {
      res.status(400).json(createErrorResponse(
        'Validation failed',
        'Please check your input and try again',
        error.errors
      ));
      return;
    }

    if (error.message.includes('slug already exists')) {
      res.status(409).json(createErrorResponse(
        'Tenant slug unavailable',
        'This tenant name is already taken. Please choose a different one.'
      ));
      return;
    }

    if (error.message.includes('domain already exists')) {
      res.status(409).json(createErrorResponse(
        'Domain unavailable',
        'This domain is already associated with another tenant.'
      ));
      return;
    }

    res.status(500).json(createErrorResponse(
      'Tenant creation failed',
      'Unable to create tenant. Please try again later.'
    ));
  }
});

/**
 * GET /api/tenants/:id - Get tenant details
 */
tenantRoutes.get('/:id', rateLimits.api, requireTenant, async (req: JWTAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.params.id;

    // Verify user has access to this tenant
    const membership = await tenantService.getUserTenantMembership(req.auth!.userId, tenantId);
    if (!membership) {
      res.status(403).json(createErrorResponse(
        'Access denied',
        'You do not have access to this tenant'
      ));
      return;
    }

    const tenantDetails = await tenantService.getTenantDetails(tenantId);

    res.json(createSuccessResponse({
      tenant: {
        id: tenantDetails.id,
        name: tenantDetails.name,
        slug: tenantDetails.slug,
        description: tenantDetails.description,
        domain: tenantDetails.domain,
        industry: tenantDetails.industry,
        size: tenantDetails.size,
        country: tenantDetails.country,
        timezone: tenantDetails.timezone,
        billingEmail: tenantDetails.billingEmail,
        technicalEmail: tenantDetails.technicalEmail,
        logo: tenantDetails.logo,
        settings: tenantDetails.settings,
        isActive: tenantDetails.isActive,
        createdAt: tenantDetails.createdAt,
        updatedAt: tenantDetails.updatedAt,
      },
      membership: {
        role: membership.role,
        joinedAt: membership.createdAt,
        isActive: membership.isActive,
      },
      statistics: {
        totalMembers: tenantDetails._count?.memberships || 0,
        activeMembers: tenantDetails.memberships?.filter(m => m.isActive).length || 0,
        pendingInvitations: tenantDetails._count?.invitations || 0,
      },
    }, 'Tenant details retrieved successfully'));

  } catch (error) {
    logger.error('Failed to retrieve tenant details', {
      tenantId: req.params.id,
      userId: req.auth!.userId,
      error: error.message,
    });

    res.status(500).json(createErrorResponse(
      'Tenant retrieval failed',
      'Unable to retrieve tenant details. Please try again.'
    ));
  }
});

/**
 * PUT /api/tenants/:id - Update tenant settings
 */
tenantRoutes.put('/:id', 
  rateLimits.write, 
  requireTenant, 
  requireTenantRole(TenantRole.ADMIN, TenantRole.OWNER),
  auditLog('tenant_update'),
  async (req: JWTAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const tenantId = req.params.id;
      const validatedData = validateRequest(tenantUpdateSchema, req.body);

      // Verify user has admin access to this tenant
      if (req.tenant!.id !== tenantId) {
        res.status(403).json(createErrorResponse(
          'Access denied',
          'You can only update your current tenant'
        ));
        return;
      }

      const updatedTenant = await tenantService.updateTenant(tenantId, validatedData);

      logger.info('Tenant updated successfully', {
        tenantId,
        updatedBy: req.auth!.userId,
        changes: Object.keys(validatedData),
        ip: req.ip,
      });

      res.json(createSuccessResponse({
        tenant: {
          id: updatedTenant.id,
          name: updatedTenant.name,
          slug: updatedTenant.slug,
          description: updatedTenant.description,
          domain: updatedTenant.domain,
          industry: updatedTenant.industry,
          size: updatedTenant.size,
          country: updatedTenant.country,
          timezone: updatedTenant.timezone,
          billingEmail: updatedTenant.billingEmail,
          technicalEmail: updatedTenant.technicalEmail,
          logo: updatedTenant.logo,
          settings: updatedTenant.settings,
          updatedAt: updatedTenant.updatedAt,
        },
      }, 'Tenant updated successfully'));

    } catch (error) {
      logger.error('Tenant update failed', {
        tenantId: req.params.id,
        userId: req.auth!.userId,
        error: error.message,
        ip: req.ip,
      });

      if (error instanceof ValidationError) {
        res.status(400).json(createErrorResponse(
          'Validation failed',
          'Please check your input and try again',
          error.errors
        ));
        return;
      }

      if (error.message.includes('domain already exists')) {
        res.status(409).json(createErrorResponse(
          'Domain unavailable',
          'This domain is already associated with another tenant.'
        ));
        return;
      }

      res.status(500).json(createErrorResponse(
        'Tenant update failed',
        'Unable to update tenant. Please try again.'
      ));
    }
  }
);

/**
 * DELETE /api/tenants/:id - Delete tenant (owner only)
 */
tenantRoutes.delete('/:id', 
  rateLimits.admin, 
  requireTenant, 
  requireTenantRole(TenantRole.OWNER),
  auditLog('tenant_deletion'),
  async (req: JWTAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const tenantId = req.params.id;

      // Verify user is deleting their current tenant
      if (req.tenant!.id !== tenantId) {
        res.status(403).json(createErrorResponse(
          'Access denied',
          'You can only delete your current tenant'
        ));
        return;
      }

      await tenantService.deleteTenant(tenantId, req.auth!.userId);

      logger.info('Tenant deleted successfully', {
        tenantId,
        deletedBy: req.auth!.userId,
        ip: req.ip,
      });

      res.json(createSuccessResponse(null, 'Tenant deleted successfully'));

    } catch (error) {
      logger.error('Tenant deletion failed', {
        tenantId: req.params.id,
        userId: req.auth!.userId,
        error: error.message,
        ip: req.ip,
      });

      if (error.message.includes('cannot delete tenant with active members')) {
        res.status(400).json(createErrorResponse(
          'Cannot delete tenant',
          'You must remove all other members before deleting the tenant.'
        ));
        return;
      }

      if (error.message.includes('cannot delete tenant with active data')) {
        res.status(400).json(createErrorResponse(
          'Cannot delete tenant',
          'This tenant has active data that must be backed up or transferred first.'
        ));
        return;
      }

      res.status(500).json(createErrorResponse(
        'Tenant deletion failed',
        'Unable to delete tenant. Please try again.'
      ));
    }
  }
);

/**
 * POST /api/tenants/:id/switch - Switch to tenant
 */
tenantRoutes.post('/:id/switch', rateLimits.api, async (req: JWTAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.params.id;

    // Verify user has access to this tenant
    const membership = await tenantService.getUserTenantMembership(req.auth!.userId, tenantId);
    if (!membership) {
      res.status(403).json(createErrorResponse(
        'Access denied',
        'You are not a member of this tenant'
      ));
      return;
    }

    if (!membership.isActive) {
      res.status(403).json(createErrorResponse(
        'Access denied',
        'Your membership in this tenant is inactive'
      ));
      return;
    }

    // Switch the user's session to this tenant
    const switchResult = await tenantService.switchTenant(req.auth!.sessionId!, tenantId);

    logger.info('Tenant switch successful', {
      userId: req.auth!.userId,
      fromTenantId: req.tenant?.id,
      toTenantId: tenantId,
      sessionId: req.auth!.sessionId,
      ip: req.ip,
    });

    res.json(createSuccessResponse({
      tenant: {
        id: switchResult.tenant.id,
        name: switchResult.tenant.name,
        slug: switchResult.tenant.slug,
        role: switchResult.membership.role,
      },
      tokens: {
        accessToken: switchResult.tokens.accessToken,
        refreshToken: switchResult.tokens.refreshToken,
        expiresAt: switchResult.tokens.expiresAt,
      },
    }, 'Switched to tenant successfully'));

  } catch (error) {
    logger.error('Tenant switch failed', {
      tenantId: req.params.id,
      userId: req.auth!.userId,
      error: error.message,
      ip: req.ip,
    });

    res.status(500).json(createErrorResponse(
      'Tenant switch failed',
      'Unable to switch tenant. Please try again.'
    ));
  }
});

/**
 * GET /api/tenants/:id/members - List tenant members
 */
tenantRoutes.get('/:id/members', 
  rateLimits.api, 
  requireTenant, 
  tenantIsolation,
  async (req: JWTAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const tenantId = req.params.id;

      // Verify user has access to this tenant
      if (req.tenant!.id !== tenantId) {
        res.status(403).json(createErrorResponse(
          'Access denied',
          'You can only view members of your current tenant'
        ));
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const role = req.query.role as TenantRole;
      const search = req.query.search as string;

      const result = await tenantService.getTenantMembers(tenantId, {
        page,
        limit,
        role,
        search,
      });

      const mappedMembers = result.members.map(membership => ({
        id: membership.id,
        user: {
          id: membership.user.id,
          email: membership.user.email,
          firstName: membership.user.firstName,
          lastName: membership.user.lastName,
          avatarUrl: membership.user.avatarUrl,
          lastLoginAt: membership.user.lastLoginAt,
        },
        role: membership.role,
        isActive: membership.isActive,
        joinedAt: membership.createdAt,
        invitedBy: membership.invitedBy ? {
          id: membership.invitedBy.id,
          email: membership.invitedBy.email,
          firstName: membership.invitedBy.firstName,
          lastName: membership.invitedBy.lastName,
        } : null,
      }));

      res.json(createPaginatedResponse(
        mappedMembers,
        page,
        limit,
        result.total,
        'Tenant members retrieved successfully'
      ));

    } catch (error) {
      logger.error('Failed to retrieve tenant members', {
        tenantId: req.params.id,
        userId: req.auth!.userId,
        error: error.message,
      });

      res.status(500).json(createErrorResponse(
        'Member retrieval failed',
        'Unable to retrieve tenant members. Please try again.'
      ));
    }
  }
);

/**
 * PUT /api/tenants/:id/members/:userId/role - Update member role
 */
tenantRoutes.put('/:id/members/:userId/role', 
  rateLimits.write, 
  requireTenant, 
  requireTenantRole(TenantRole.ADMIN, TenantRole.OWNER),
  auditLog('member_role_update'),
  tenantIsolation,
  async (req: JWTAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const tenantId = req.params.id;
      const targetUserId = req.params.userId;
      const validatedData = validateRequest(memberRoleUpdateSchema, {
        ...req.body,
        userId: targetUserId,
      });

      // Verify user has access to this tenant
      if (req.tenant!.id !== tenantId) {
        res.status(403).json(createErrorResponse(
          'Access denied',
          'You can only manage members of your current tenant'
        ));
        return;
      }

      // Prevent self-role modification for owners
      if (req.auth!.userId === targetUserId && req.membership!.role === TenantRole.OWNER) {
        res.status(400).json(createErrorResponse(
          'Cannot modify own role',
          'Tenant owners cannot modify their own role'
        ));
        return;
      }

      // Only owners can promote to owner or demote owners
      const targetMembership = await tenantService.getUserTenantMembership(targetUserId, tenantId);
      if (!targetMembership) {
        res.status(404).json(createErrorResponse(
          'Member not found',
          'The specified user is not a member of this tenant'
        ));
        return;
      }

      if ((validatedData.role === TenantRole.OWNER || targetMembership.role === TenantRole.OWNER) &&
          req.membership!.role !== TenantRole.OWNER) {
        res.status(403).json(createErrorResponse(
          'Insufficient permissions',
          'Only tenant owners can modify owner roles'
        ));
        return;
      }

      const updatedMembership = await tenantService.updateMemberRole(tenantId, targetUserId, validatedData.role);

      logger.info('Member role updated successfully', {
        tenantId,
        targetUserId,
        oldRole: targetMembership.role,
        newRole: validatedData.role,
        updatedBy: req.auth!.userId,
        ip: req.ip,
      });

      res.json(createSuccessResponse({
        membership: {
          id: updatedMembership.id,
          user: {
            id: updatedMembership.user.id,
            email: updatedMembership.user.email,
            firstName: updatedMembership.user.firstName,
            lastName: updatedMembership.user.lastName,
          },
          role: updatedMembership.role,
          isActive: updatedMembership.isActive,
          updatedAt: updatedMembership.updatedAt,
        },
      }, 'Member role updated successfully'));

    } catch (error) {
      logger.error('Member role update failed', {
        tenantId: req.params.id,
        targetUserId: req.params.userId,
        userId: req.auth!.userId,
        error: error.message,
        ip: req.ip,
      });

      if (error instanceof ValidationError) {
        res.status(400).json(createErrorResponse(
          'Validation failed',
          'Please check your input and try again',
          error.errors
        ));
        return;
      }

      res.status(500).json(createErrorResponse(
        'Role update failed',
        'Unable to update member role. Please try again.'
      ));
    }
  }
);

/**
 * DELETE /api/tenants/:id/members/:userId - Remove member
 */
tenantRoutes.delete('/:id/members/:userId', 
  rateLimits.write, 
  requireTenant, 
  requireTenantRole(TenantRole.ADMIN, TenantRole.OWNER),
  auditLog('member_removal'),
  tenantIsolation,
  async (req: JWTAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const tenantId = req.params.id;
      const targetUserId = req.params.userId;

      // Verify user has access to this tenant
      if (req.tenant!.id !== tenantId) {
        res.status(403).json(createErrorResponse(
          'Access denied',
          'You can only manage members of your current tenant'
        ));
        return;
      }

      // Prevent self-removal for owners
      if (req.auth!.userId === targetUserId && req.membership!.role === TenantRole.OWNER) {
        res.status(400).json(createErrorResponse(
          'Cannot remove self',
          'Tenant owners cannot remove themselves. Transfer ownership first.'
        ));
        return;
      }

      // Check if target member exists and get their role
      const targetMembership = await tenantService.getUserTenantMembership(targetUserId, tenantId);
      if (!targetMembership) {
        res.status(404).json(createErrorResponse(
          'Member not found',
          'The specified user is not a member of this tenant'
        ));
        return;
      }

      // Only owners can remove other owners
      if (targetMembership.role === TenantRole.OWNER && req.membership!.role !== TenantRole.OWNER) {
        res.status(403).json(createErrorResponse(
          'Insufficient permissions',
          'Only tenant owners can remove other owners'
        ));
        return;
      }

      await tenantService.removeMember(tenantId, targetUserId);

      logger.info('Member removed successfully', {
        tenantId,
        removedUserId: targetUserId,
        removedRole: targetMembership.role,
        removedBy: req.auth!.userId,
        ip: req.ip,
      });

      res.json(createSuccessResponse(null, 'Member removed successfully'));

    } catch (error) {
      logger.error('Member removal failed', {
        tenantId: req.params.id,
        targetUserId: req.params.userId,
        userId: req.auth!.userId,
        error: error.message,
        ip: req.ip,
      });

      res.status(500).json(createErrorResponse(
        'Member removal failed',
        'Unable to remove member. Please try again.'
      ));
    }
  }
);