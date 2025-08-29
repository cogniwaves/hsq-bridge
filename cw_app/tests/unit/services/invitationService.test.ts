/**
 * Invitation Service Unit Tests
 * Comprehensive testing for the invitation management service
 */

import { InvitationStatus, TenantRole } from '@prisma/client';
import { invitationService } from '../../../src/services/auth/invitationService';
import testSetup, { testPrisma, createTestTenant, createTestUser } from '../../helpers/testSetup';

describe('InvitationService', () => {
  let testTenant: any;
  let testUser: any;
  let inviterUser: any;

  beforeAll(async () => {
    await testSetup.setupTestEnvironment();
  });

  afterAll(async () => {
    await testSetup.teardownTestEnvironment();
  });

  beforeEach(async () => {
    await testSetup.cleanTestDatabase();
    
    // Create test tenant
    testTenant = await createTestTenant({
      name: 'Test Company',
      slug: 'test-company',
    });

    // Create inviter user (admin)
    inviterUser = await createTestUser({
      email: 'admin@test.com',
      firstName: 'Admin',
      lastName: 'User',
    });

    // Create inviter membership
    await testPrisma.tenantMembership.create({
      data: {
        userId: inviterUser.id,
        tenantId: testTenant.id,
        role: TenantRole.ADMIN,
        isPrimary: true,
      },
    });

    // Create regular test user
    testUser = await createTestUser({
      email: 'user@test.com',
    });
  });

  describe('createInvitation', () => {
    it('should create an invitation successfully', async () => {
      const invitationData = {
        tenantId: testTenant.id,
        email: 'newuser@test.com',
        role: TenantRole.MEMBER,
        message: 'Welcome to our team!',
        sendEmail: false,
        invitedBy: inviterUser.id,
      };

      const result = await invitationService.createInvitation(invitationData);

      expect(result).toBeDefined();
      expect(result.email).toBe(invitationData.email);
      expect(result.role).toBe(invitationData.role);
      expect(result.status).toBe(InvitationStatus.PENDING);
      expect(result.tenant).toBeDefined();
      expect(result.invitedBy).toBeDefined();
      expect(result.invitedBy.id).toBe(inviterUser.id);
    });

    it('should throw error if inviter is not a member', async () => {
      const outsideUser = await createTestUser({
        email: 'outsider@test.com',
      });

      const invitationData = {
        tenantId: testTenant.id,
        email: 'newuser@test.com',
        role: TenantRole.MEMBER,
        invitedBy: outsideUser.id,
      };

      await expect(invitationService.createInvitation(invitationData))
        .rejects.toThrow('You are not a member of this tenant');
    });

    it('should throw error if user is already a member', async () => {
      // Make test user a member first
      await testPrisma.tenantMembership.create({
        data: {
          userId: testUser.id,
          tenantId: testTenant.id,
          role: TenantRole.MEMBER,
        },
      });

      const invitationData = {
        tenantId: testTenant.id,
        email: testUser.email,
        role: TenantRole.MEMBER,
        invitedBy: inviterUser.id,
      };

      await expect(invitationService.createInvitation(invitationData))
        .rejects.toThrow('User is already a member of this tenant');
    });

    it('should throw error if pending invitation already exists', async () => {
      const email = 'duplicate@test.com';

      // Create first invitation
      await invitationService.createInvitation({
        tenantId: testTenant.id,
        email,
        role: TenantRole.MEMBER,
        invitedBy: inviterUser.id,
      });

      // Try to create duplicate
      await expect(invitationService.createInvitation({
        tenantId: testTenant.id,
        email,
        role: TenantRole.MEMBER,
        invitedBy: inviterUser.id,
      })).rejects.toThrow('An invitation has already been sent to this email');
    });
  });

  describe('rejectInvitation', () => {
    let testInvitation: any;

    beforeEach(async () => {
      testInvitation = await testPrisma.tenantInvitation.create({
        data: {
          tenantId: testTenant.id,
          email: 'reject@test.com',
          role: TenantRole.MEMBER,
          invitationToken: 'test-reject-token',
          invitedById: inviterUser.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    });

    it('should reject invitation successfully', async () => {
      const metadata = {
        ip: '192.168.1.1',
        userAgent: 'Test Browser',
      };

      const result = await invitationService.rejectInvitation(
        testInvitation.invitationToken,
        metadata
      );

      expect(result).toBeDefined();
      expect(result.status).toBe(InvitationStatus.REJECTED);
      expect(result.rejectedAt).toBeDefined();
      expect(result.tenant).toBeDefined();
    });

    it('should throw error for invalid token', async () => {
      await expect(invitationService.rejectInvitation('invalid-token'))
        .rejects.toThrow('Invalid invitation token');
    });

    it('should throw error if invitation already processed', async () => {
      // First reject the invitation
      await invitationService.rejectInvitation(testInvitation.invitationToken);

      // Try to reject again
      await expect(invitationService.rejectInvitation(testInvitation.invitationToken))
        .rejects.toThrow('Invitation has already been rejected');
    });

    it('should handle metadata parameter as optional', async () => {
      // Should work without metadata
      const result = await invitationService.rejectInvitation(testInvitation.invitationToken);
      expect(result.status).toBe(InvitationStatus.REJECTED);

      // Create another invitation to test with metadata
      const anotherInvitation = await testPrisma.tenantInvitation.create({
        data: {
          tenantId: testTenant.id,
          email: 'reject2@test.com',
          role: TenantRole.MEMBER,
          invitationToken: 'test-reject-token-2',
          invitedById: inviterUser.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      // Should work with metadata
      const resultWithMeta = await invitationService.rejectInvitation(
        anotherInvitation.invitationToken,
        { ip: '192.168.1.1', userAgent: 'Test' }
      );
      expect(resultWithMeta.status).toBe(InvitationStatus.REJECTED);
    });
  });

  describe('getTenantInvitations', () => {
    beforeEach(async () => {
      // Create multiple test invitations
      for (let i = 0; i < 15; i++) {
        await testPrisma.tenantInvitation.create({
          data: {
            tenantId: testTenant.id,
            email: `test${i}@example.com`,
            role: i % 2 === 0 ? TenantRole.MEMBER : TenantRole.ADMIN,
            invitationToken: `test-token-${i}`,
            invitedById: inviterUser.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            status: i < 10 ? InvitationStatus.PENDING : InvitationStatus.REJECTED,
          },
        });
      }
    });

    it('should return paginated invitations', async () => {
      const result = await invitationService.getTenantInvitations(testTenant.id, {
        page: 1,
        limit: 5,
      });

      expect(result.invitations).toHaveLength(5);
      expect(result.total).toBe(15);
      expect(result.invitations[0]).toHaveProperty('invitedBy');
    });

    it('should filter by status', async () => {
      const result = await invitationService.getTenantInvitations(testTenant.id, {
        status: InvitationStatus.PENDING,
      });

      expect(result.invitations).toHaveLength(10);
      expect(result.total).toBe(10);
      result.invitations.forEach(inv => {
        expect(inv.status).toBe(InvitationStatus.PENDING);
      });
    });

    it('should filter by role', async () => {
      const result = await invitationService.getTenantInvitations(testTenant.id, {
        role: TenantRole.ADMIN,
      });

      // Should return 7-8 ADMIN invitations (depending on how 15 divides by 2)
      expect(result.invitations.length).toBeGreaterThan(5);
      result.invitations.forEach(inv => {
        expect(inv.role).toBe(TenantRole.ADMIN);
      });
    });

    it('should search by email', async () => {
      const result = await invitationService.getTenantInvitations(testTenant.id, {
        search: 'test1',
      });

      // Should match test1@, test10@, test11@, test12@, test13@, test14@
      expect(result.invitations.length).toBeGreaterThan(0);
      result.invitations.forEach(inv => {
        expect(inv.email).toContain('test1');
      });
    });
  });

  describe('getUserInvitations', () => {
    const userEmail = 'invited@test.com';

    beforeEach(async () => {
      // Create invitations for the user across different tenants
      const anotherTenant = await createTestTenant({
        name: 'Another Company',
        slug: 'another-company',
      });

      await testPrisma.tenantInvitation.create({
        data: {
          tenantId: testTenant.id,
          email: userEmail,
          role: TenantRole.MEMBER,
          invitationToken: 'user-token-1',
          invitedById: inviterUser.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      await testPrisma.tenantInvitation.create({
        data: {
          tenantId: anotherTenant.id,
          email: userEmail,
          role: TenantRole.ADMIN,
          invitationToken: 'user-token-2',
          invitedById: inviterUser.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: InvitationStatus.REJECTED,
        },
      });
    });

    it('should return all invitations for user', async () => {
      const result = await invitationService.getUserInvitations(userEmail);

      expect(result).toHaveLength(2);
      result.forEach(inv => {
        expect(inv.email).toBe(userEmail);
        expect(inv.tenant).toBeDefined();
        expect(inv.invitedBy).toBeDefined();
      });
    });

    it('should filter by status', async () => {
      const pendingResult = await invitationService.getUserInvitations(
        userEmail,
        InvitationStatus.PENDING
      );

      expect(pendingResult).toHaveLength(1);
      expect(pendingResult[0].status).toBe(InvitationStatus.PENDING);

      const rejectedResult = await invitationService.getUserInvitations(
        userEmail,
        InvitationStatus.REJECTED
      );

      expect(rejectedResult).toHaveLength(1);
      expect(rejectedResult[0].status).toBe(InvitationStatus.REJECTED);
    });
  });

  describe('getInvitationByToken', () => {
    let testInvitation: any;

    beforeEach(async () => {
      testInvitation = await testPrisma.tenantInvitation.create({
        data: {
          tenantId: testTenant.id,
          email: 'token@test.com',
          role: TenantRole.MEMBER,
          invitationToken: 'test-get-token',
          invitedById: inviterUser.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    });

    it('should return invitation by token', async () => {
      const result = await invitationService.getInvitationByToken(
        testInvitation.invitationToken
      );

      expect(result).toBeDefined();
      expect(result!.id).toBe(testInvitation.id);
      expect(result!.tenant).toBeDefined();
      expect(result!.invitedBy).toBeDefined();
    });

    it('should return null for invalid token', async () => {
      const result = await invitationService.getInvitationByToken('invalid-token');
      expect(result).toBeNull();
    });
  });

  describe('resendInvitation', () => {
    let testInvitation: any;

    beforeEach(async () => {
      testInvitation = await testPrisma.tenantInvitation.create({
        data: {
          tenantId: testTenant.id,
          email: 'resend@test.com',
          role: TenantRole.MEMBER,
          invitationToken: 'test-resend-token',
          invitedById: inviterUser.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    });

    it('should resend invitation successfully', async () => {
      const options = {
        tenantId: testTenant.id,
        userId: inviterUser.id,
      };

      const result = await invitationService.resendInvitation(
        testInvitation.id,
        options
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(testInvitation.id);
      expect(result.invitationToken).not.toBe(testInvitation.invitationToken); // Should be new token
      expect(result.expiresAt).not.toEqual(testInvitation.expiresAt); // Should be extended
    });

    it('should throw error for non-existent invitation', async () => {
      const options = {
        tenantId: testTenant.id,
        userId: inviterUser.id,
      };

      await expect(invitationService.resendInvitation('non-existent-id', options))
        .rejects.toThrow('Invitation not found');
    });

    it('should throw error if invitation belongs to different tenant', async () => {
      const anotherTenant = await createTestTenant({
        name: 'Other Company',
        slug: 'other-company',
      });

      const options = {
        tenantId: anotherTenant.id,
        userId: inviterUser.id,
      };

      await expect(invitationService.resendInvitation(testInvitation.id, options))
        .rejects.toThrow('Invitation not found');
    });
  });

  describe('revokeInvitation', () => {
    let testInvitation: any;

    beforeEach(async () => {
      testInvitation = await testPrisma.tenantInvitation.create({
        data: {
          tenantId: testTenant.id,
          email: 'revoke@test.com',
          role: TenantRole.MEMBER,
          invitationToken: 'test-revoke-token',
          invitedById: inviterUser.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    });

    it('should revoke invitation successfully', async () => {
      const options = {
        tenantId: testTenant.id,
        userId: inviterUser.id,
      };

      const result = await invitationService.revokeInvitation(
        testInvitation.id,
        options
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(testInvitation.id);
      expect(result.status).toBe(InvitationStatus.EXPIRED); // We use EXPIRED as revoked
    });

    it('should throw error for non-existent invitation', async () => {
      const options = {
        tenantId: testTenant.id,
        userId: inviterUser.id,
      };

      await expect(invitationService.revokeInvitation('non-existent-id', options))
        .rejects.toThrow('Invitation not found');
    });
  });
});