import { Request, Response, NextFunction } from 'express';
import { UserRole, UserProfile } from '@e-pramaan/shared';
import { AppError } from './errorHandler.js';
import { config } from '../config/env.js';
import { getSupabasePublicClient, getSupabaseAdminClient } from '../config/supabase.js';

// Extend Express Request interface to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: UserProfile;
      authToken?: string;
    }
  }
}

/**
 * Validates the Authorization Bearer JWT token from headers.
 * Extracts the user session from Supabase Auth and hydrates user profile from the database.
 */
export async function requireAuthenticatedUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Authentication required. Missing or malformed Bearer token.', 401, 'UNAUTHENTICATED'));
  }

  const token = authHeader.split(' ')[1];
  req.authToken = token;

  if (!config.hasSupabaseConfigured()) {
    return next(
      new AppError(
        'Authentication backend service is currently unconfigured. Set SUPABASE_URL and SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY.',
        503,
        'AUTH_SERVICE_UNCONFIGURED'
      )
    );
  }

  try {
    const supabase = getSupabasePublicClient();
    const { data: authData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authData.user) {
      return next(new AppError('Invalid or expired authentication session.', 401, 'INVALID_TOKEN', authError));
    }

    const userId = authData.user.id;

    // Retrieve full profile from public.users with organization membership if exists
    const admin = getSupabaseAdminClient();
    const { data: userRecord, error: userError } = await admin
      .from('users')
      .select(`
        id,
        email,
        full_name,
        role,
        is_active,
        created_at,
        updated_at,
        organization_members (
          membership_role,
          organizations (
            id,
            legal_name,
            organization_type,
            identifier,
            is_verified
          )
        )
      `)
      .eq('id', userId)
      .single();

    if (userError || !userRecord) {
      return next(new AppError('User profile not found or access revoked.', 401, 'USER_NOT_FOUND'));
    }

    if (!userRecord.is_active) {
      return next(new AppError('Your account has been deactivated. Contact an administrator.', 403, 'ACCOUNT_DEACTIVATED'));
    }

    // Map organization membership if exists
    let orgSummary = null;
    const memberRecord = Array.isArray(userRecord.organization_members) && userRecord.organization_members.length > 0
      ? userRecord.organization_members[0]
      : null;

    if (memberRecord && memberRecord.organizations) {
      const org: any = Array.isArray(memberRecord.organizations) ? memberRecord.organizations[0] : memberRecord.organizations;
      if (org) {
        orgSummary = {
          id: org.id,
          legalName: org.legal_name,
          organizationType: org.organization_type,
          identifier: org.identifier,
          membershipRole: memberRecord.membership_role,
          isVerified: org.is_verified
        };
      }
    }

    req.user = {
      id: userRecord.id,
      email: userRecord.email,
      fullName: userRecord.full_name,
      role: userRecord.role as UserRole,
      isActive: userRecord.is_active,
      createdAt: userRecord.created_at,
      updatedAt: userRecord.updated_at,
      organization: orgSummary
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware to require a specific UserRole.
 */
export function requireRole(role: UserRole) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Authentication required prior to role verification.', 401, 'UNAUTHENTICATED'));
    }

    if (req.user.role !== role) {
      return next(
        new AppError(
          `Forbidden. Action requires '${role}' role. Current role: '${req.user.role}'.`,
          403,
          'FORBIDDEN'
        )
      );
    }

    next();
  };
}

/**
 * Middleware to require any of the permitted UserRoles.
 */
export function requireAnyRole(allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Authentication required prior to role verification.', 401, 'UNAUTHENTICATED'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          `Forbidden. Action requires one of: [${allowedRoles.join(', ')}]. Current role: '${req.user.role}'.`,
          403,
          'FORBIDDEN'
        )
      );
    }

    next();
  };
}
