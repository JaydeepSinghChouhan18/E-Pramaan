import {
  RegisterRequest,
  LoginRequest,
  AuthSessionResponse,
  UserProfile,
  UserRole,
  MembershipRole,
  OrganizationType
} from '@e-pramaan/shared';
import { getSupabasePublicClient, getSupabaseAdminClient } from '../../config/supabase.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { config } from '../../config/env.js';

export class AuthService {
  /**
   * Register a new user with Supabase Auth and initialize public.users and organization if provided.
   */
  static async register(payload: RegisterRequest): Promise<AuthSessionResponse> {
    if (!config.hasSupabaseConfigured()) {
      throw new AppError(
        'Supabase is not configured on the backend. Please provide SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
        503,
        'DATABASE_UNCONFIGURED'
      );
    }

    const publicClient = getSupabasePublicClient();
    const adminClient = getSupabaseAdminClient();

    // Security Enforcement: Public registration is strictly restricted to BIDDER.
    // Privileged roles (OFFICER, AUDITOR, ADMIN) can only be provisioned by authorized administrators.
    const assignedRole = UserRole.BIDDER;

    // 1. Create auth user in Supabase Auth
    const { data: authData, error: authError } = await publicClient.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: {
          full_name: payload.fullName,
          role: assignedRole
        }
      }
    });

    if (authError || !authData.user) {
      throw new AppError(
        authError?.message || 'Failed to register account with authentication service',
        400,
        'REGISTRATION_FAILED',
        authError
      );
    }

    const userId = authData.user.id;

    // 2. Upsert user into public.users using admin client
    const { error: insertUserError } = await adminClient
      .from('users')
      .upsert({
        id: userId,
        email: payload.email,
        full_name: payload.fullName,
        role: assignedRole,
        is_active: true
      });

    if (insertUserError) {
      throw new AppError(
        'Failed to create user profile in database',
        500,
        'DB_USER_CREATION_FAILED',
        insertUserError
      );
    }

    // 3. If organization name provided, register organization and membership
    let orgSummary = null;
    if (payload.organizationName) {
      const orgType = OrganizationType.BIDDER_ENTITY;
      const membershipRole = MembershipRole.AUTHORIZED_REPRESENTATIVE;

      const { data: orgData, error: orgError } = await adminClient
        .from('organizations')
        .insert({
          legal_name: payload.organizationName,
          organization_type: orgType,
          identifier: payload.organizationIdentifier || null,
          is_verified: false
        })
        .select()
        .single();

      if (!orgError && orgData) {
        await adminClient
          .from('organization_members')
          .insert({
            user_id: userId,
            organization_id: orgData.id,
            membership_role: membershipRole
          });

        orgSummary = {
          id: orgData.id,
          legalName: orgData.legal_name,
          organizationType: orgData.organization_type,
          identifier: orgData.identifier,
          membershipRole,
          isVerified: orgData.is_verified
        };
      }
    }

    const userProfile: UserProfile = {
      id: userId,
      email: payload.email,
      fullName: payload.fullName,
      role: assignedRole,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      organization: orgSummary
    };

    return {
      accessToken: authData.session?.access_token || '',
      refreshToken: authData.session?.refresh_token,
      expiresIn: authData.session?.expires_in,
      user: userProfile
    };
  }

  /**
   * Log in user via Supabase Auth and return safe profile and session.
   */
  static async login(payload: LoginRequest): Promise<AuthSessionResponse> {
    if (!config.hasSupabaseConfigured()) {
      throw new AppError(
        'Supabase is not configured on the backend. Please provide SUPABASE_URL and SUPABASE_ANON_KEY.',
        503,
        'DATABASE_UNCONFIGURED'
      );
    }

    const publicClient = getSupabasePublicClient();
    const adminClient = getSupabaseAdminClient();

    const { data: authData, error: authError } = await publicClient.auth.signInWithPassword({
      email: payload.email,
      password: payload.password
    });

    if (authError || !authData.user || !authData.session) {
      throw new AppError('Invalid credentials. Please verify your email and password.', 401, 'INVALID_CREDENTIALS');
    }

    const userId = authData.user.id;

    // Fetch user profile from database
    const { data: userRecord, error: userError } = await adminClient
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
      throw new AppError('User profile not found in database.', 404, 'USER_NOT_FOUND');
    }

    if (!userRecord.is_active) {
      throw new AppError('Your account has been deactivated.', 403, 'ACCOUNT_DEACTIVATED');
    }

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

    const userProfile: UserProfile = {
      id: userRecord.id,
      email: userRecord.email,
      fullName: userRecord.full_name,
      role: userRecord.role as UserRole,
      isActive: userRecord.is_active,
      createdAt: userRecord.created_at,
      updatedAt: userRecord.updated_at,
      organization: orgSummary
    };

    return {
      accessToken: authData.session.access_token,
      refreshToken: authData.session.refresh_token,
      expiresIn: authData.session.expires_in,
      user: userProfile
    };
  }

  /**
   * Log out session.
   */
  static async logout(token?: string): Promise<void> {
    if (token && config.hasSupabaseConfigured()) {
      try {
        const publicClient = getSupabasePublicClient();
        await publicClient.auth.signOut();
      } catch (err) {
        // Log error silently, session is cleared client-side
        console.warn('[AuthService] Logout warning:', err);
      }
    }
  }
}
