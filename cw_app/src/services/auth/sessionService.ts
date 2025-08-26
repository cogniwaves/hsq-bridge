import { PrismaClient, UserSession, User, Tenant, TenantMembership } from '@prisma/client';
import { logger } from '../../utils/logger';
import { createError } from '../../utils/errorHandler';
import {
  verifyAccessToken,
  verifyRefreshToken,
  generateTokenPair,
  isTokenExpiringSoon,
  AccessTokenPayload,
  RefreshTokenPayload,
} from '../../utils/auth/jwtUtils';
import { generateSessionId } from '../../utils/auth/tokenUtils';

const prisma = new PrismaClient();

// Configuration constants
const SESSION_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
const MAX_SESSIONS_PER_USER = parseInt(process.env.MAX_SESSIONS_PER_USER || '5', 10);
const SESSION_ACTIVITY_UPDATE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

export interface SessionInfo {
  session: UserSession;
  user: User;
  tenant?: Tenant;
  membership?: TenantMembership;
}

export interface RefreshResult {
  tokens: {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiry: Date;
    refreshTokenExpiry: Date;
  };
  user: User;
  tenant?: Tenant;
  membership?: TenantMembership;
}

/**
 * Session Management Service
 * Handles JWT session creation, validation, refresh, and cleanup
 */
export class SessionService {
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start periodic cleanup
    this.startCleanupScheduler();
  }

  /**
   * Validate access token and get session info
   */
  async validateSession(accessToken: string): Promise<SessionInfo> {
    try {
      // Verify and decode token
      const payload = verifyAccessToken(accessToken);

      // Find session
      const session = await prisma.userSession.findFirst({
        where: {
          sessionToken: accessToken,
          userId: payload.userId,
          revokedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
        include: {
          user: true,
        },
      });

      if (!session) {
        throw createError('Invalid or expired session', 401);
      }

      // Check if user is active
      if (!session.user.isActive) {
        throw createError('User account is disabled', 403);
      }

      // Get tenant and membership if applicable
      let tenant: Tenant | undefined;
      let membership: TenantMembership | undefined;

      if (payload.tenantId) {
        const tenantData = await prisma.tenant.findUnique({
          where: { id: payload.tenantId },
        });

        if (!tenantData || !tenantData.isActive) {
          throw createError('Tenant not found or inactive', 403);
        }

        tenant = tenantData;

        // Get membership
        const membershipData = await prisma.tenantMembership.findUnique({
          where: {
            userId_tenantId: {
              userId: payload.userId,
              tenantId: payload.tenantId,
            },
          },
        });

        if (!membershipData) {
          throw createError('Tenant membership not found', 403);
        }

        membership = membershipData;
      }

      // Update last activity if threshold passed
      const now = new Date();
      if (
        !session.lastActivityAt ||
        now.getTime() - session.lastActivityAt.getTime() > SESSION_ACTIVITY_UPDATE_THRESHOLD
      ) {
        await this.updateSessionActivity(session.id);
      }

      return {
        session,
        user: session.user,
        tenant,
        membership,
      };
    } catch (error) {
      logger.error('Session validation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Refresh session tokens
   */
  async refreshSession(refreshToken: string): Promise<RefreshResult> {
    try {
      // Verify refresh token
      const payload = verifyRefreshToken(refreshToken);

      // Find session
      const session = await prisma.userSession.findFirst({
        where: {
          refreshToken,
          userId: payload.userId,
          revokedAt: null,
        },
        include: {
          user: {
            include: {
              tenantMemberships: {
                where: payload.tenantId ? { tenantId: payload.tenantId } : undefined,
                include: {
                  tenant: true,
                },
              },
            },
          },
        },
      });

      if (!session) {
        // Possible token reuse attack
        logger.warn('Refresh token reuse detected', {
          userId: payload.userId,
          tokenFamily: payload.tokenFamily,
        });
        
        // Revoke all sessions with this token family for security
        if (payload.tokenFamily) {
          await this.revokeTokenFamily(payload.userId, payload.tokenFamily);
        }
        
        throw createError('Invalid refresh token', 401);
      }

      // Check if refresh token is expired
      if (session.refreshExpiresAt && session.refreshExpiresAt < new Date()) {
        throw createError('Refresh token expired', 401);
      }

      // Check if user is active
      if (!session.user.isActive) {
        throw createError('User account is disabled', 403);
      }

      // Get tenant and membership info
      let tenant: Tenant | undefined;
      let membership: TenantMembership | undefined;
      
      if (session.user.tenantMemberships.length > 0) {
        membership = session.user.tenantMemberships[0];
        tenant = membership.tenant;
        
        // Verify tenant is still active
        if (!tenant.isActive) {
          throw createError('Tenant is inactive', 403);
        }
      }

      // Generate new token pair with same family
      const tokens = generateTokenPair(
        session.user.id,
        session.user.email,
        tenant?.id,
        tenant?.slug,
        membership?.role,
        session.id,
        undefined,
        session.user.isSuperAdmin,
        payload.tokenFamily
      );

      // Update session with new tokens
      await prisma.userSession.update({
        where: { id: session.id },
        data: {
          sessionToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.accessTokenExpiry,
          refreshExpiresAt: tokens.refreshTokenExpiry,
          lastActivityAt: new Date(),
        },
      });

      logger.info('Session refreshed successfully', {
        userId: session.user.id,
        sessionId: session.id,
      });

      // Remove sensitive data
      const { passwordHash, ...userWithoutPassword } = session.user;

      return {
        tokens,
        user: userWithoutPassword as User,
        tenant,
        membership,
      };
    } catch (error) {
      logger.error('Session refresh failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Create a new session
   */
  async createSession(
    userId: string,
    tenantId?: string,
    ipAddress?: string,
    userAgent?: string,
    deviceInfo?: any
  ): Promise<{ session: UserSession; tokens: any }> {
    try {
      // Check session limit
      const activeSessions = await prisma.userSession.count({
        where: {
          userId,
          revokedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      if (activeSessions >= MAX_SESSIONS_PER_USER) {
        // Revoke oldest session
        await this.revokeOldestSession(userId);
      }

      // Get user and membership info
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          tenantMemberships: {
            where: tenantId ? { tenantId } : undefined,
            include: {
              tenant: true,
            },
          },
        },
      });

      if (!user) {
        throw createError('User not found', 404);
      }

      const membership = user.tenantMemberships[0];
      const tenant = membership?.tenant;

      // Generate tokens
      const sessionId = generateSessionId();
      const tokens = generateTokenPair(
        user.id,
        user.email,
        tenant?.id,
        tenant?.slug,
        membership?.role,
        sessionId,
        undefined,
        user.isSuperAdmin
      );

      // Create session
      const session = await prisma.userSession.create({
        data: {
          userId,
          tenantId,
          sessionToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          ipAddress,
          userAgent,
          deviceInfo,
          expiresAt: tokens.accessTokenExpiry,
          refreshExpiresAt: tokens.refreshTokenExpiry,
          lastActivityAt: new Date(),
        },
      });

      logger.info('Session created', {
        userId,
        sessionId: session.id,
        tenantId,
      });

      return { session, tokens };
    } catch (error) {
      logger.error('Failed to create session', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string, reason: string = 'Manual revocation'): Promise<void> {
    try {
      await prisma.userSession.update({
        where: { id: sessionId },
        data: {
          revokedAt: new Date(),
          revokedReason: reason,
        },
      });

      logger.info('Session revoked', { sessionId, reason });
    } catch (error) {
      logger.error('Failed to revoke session', { error: error.message, sessionId });
      throw error;
    }
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllUserSessions(userId: string, reason: string = 'Revoke all sessions'): Promise<void> {
    try {
      const result = await prisma.userSession.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
          revokedReason: reason,
        },
      });

      logger.info('All user sessions revoked', {
        userId,
        count: result.count,
        reason,
      });
    } catch (error) {
      logger.error('Failed to revoke user sessions', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get active sessions for a user
   */
  async getUserSessions(userId: string): Promise<UserSession[]> {
    try {
      const sessions = await prisma.userSession.findMany({
        where: {
          userId,
          revokedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
        orderBy: {
          lastActivityAt: 'desc',
        },
      });

      return sessions;
    } catch (error) {
      logger.error('Failed to get user sessions', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      // Delete sessions that have been expired for more than 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const result = await prisma.userSession.deleteMany({
        where: {
          OR: [
            {
              expiresAt: {
                lt: thirtyDaysAgo,
              },
            },
            {
              refreshExpiresAt: {
                lt: thirtyDaysAgo,
              },
            },
            {
              revokedAt: {
                lt: thirtyDaysAgo,
              },
            },
          ],
        },
      });

      if (result.count > 0) {
        logger.info('Expired sessions cleaned up', { count: result.count });
      }

      return result.count;
    } catch (error) {
      logger.error('Failed to cleanup expired sessions', { error: error.message });
      return 0;
    }
  }

  /**
   * Update session activity timestamp
   */
  private async updateSessionActivity(sessionId: string): Promise<void> {
    try {
      await prisma.userSession.update({
        where: { id: sessionId },
        data: {
          lastActivityAt: new Date(),
        },
      });

      // Also update user's last activity
      const session = await prisma.userSession.findUnique({
        where: { id: sessionId },
      });

      if (session) {
        await prisma.user.update({
          where: { id: session.userId },
          data: {
            lastActivityAt: new Date(),
          },
        });
      }
    } catch (error) {
      // Non-critical error, just log it
      logger.debug('Failed to update session activity', { error: error.message, sessionId });
    }
  }

  /**
   * Revoke oldest session when limit is reached
   */
  private async revokeOldestSession(userId: string): Promise<void> {
    try {
      const oldestSession = await prisma.userSession.findFirst({
        where: {
          userId,
          revokedAt: null,
        },
        orderBy: {
          lastActivityAt: 'asc',
        },
      });

      if (oldestSession) {
        await this.revokeSession(oldestSession.id, 'Session limit reached');
      }
    } catch (error) {
      logger.error('Failed to revoke oldest session', { error: error.message, userId });
    }
  }

  /**
   * Revoke all sessions with a specific token family (for security)
   */
  private async revokeTokenFamily(userId: string, tokenFamily: string): Promise<void> {
    try {
      // This would require storing token family in the session
      // For now, revoke all user sessions as a security measure
      await this.revokeAllUserSessions(userId, 'Token reuse detected');
    } catch (error) {
      logger.error('Failed to revoke token family', {
        error: error.message,
        userId,
        tokenFamily,
      });
    }
  }

  /**
   * Start periodic cleanup scheduler
   */
  private startCleanupScheduler(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(async () => {
      try {
        await this.cleanupExpiredSessions();
      } catch (error) {
        logger.error('Session cleanup scheduler error', { error: error.message });
      }
    }, SESSION_CLEANUP_INTERVAL);

    logger.info('Session cleanup scheduler started', {
      interval: SESSION_CLEANUP_INTERVAL,
    });
  }

  /**
   * Stop cleanup scheduler
   */
  stopCleanupScheduler(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('Session cleanup scheduler stopped');
    }
  }
}

// Export singleton instance
export const sessionService = new SessionService();