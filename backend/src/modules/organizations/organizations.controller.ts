import { Request, Response, NextFunction } from 'express';
import { ApiResponseHelper } from '../../utils/apiResponse.js';
import { getSupabasePublicClient } from '../../config/supabase.js';
import { config } from '../../config/env.js';

export class OrganizationsController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!config.hasSupabaseConfigured()) {
        ApiResponseHelper.success(res, [], 'Organizations list (Supabase unconfigured)');
        return;
      }

      const client = getSupabasePublicClient();
      const { data, error } = await client
        .from('organizations')
        .select('id, legal_name, organization_type, identifier, is_verified, created_at')
        .limit(20);

      if (error) {
        throw error;
      }

      ApiResponseHelper.success(res, data || [], 'Organizations list retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async getMyOrganization(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      if (!config.hasSupabaseConfigured()) {
        ApiResponseHelper.success(res, {
          id: user.organization?.id || 'demo-org-1',
          legalName: user.organization?.legalName || 'Bharat Infrastructure Ltd',
          organizationType: user.organization?.organizationType || 'BIDDER_ENTITY',
          identifier: user.organization?.identifier || 'U72900MH2018PTC123456',
          isVerified: user.organization?.isVerified ?? true,
          authorizedRepresentative: {
            name: user.fullName,
            email: user.email,
            role: user.role
          },
          statutoryRegistrations: {
            pan: 'AAACB1234F',
            gstin: '27AAACB1234F1Z5',
            udyam: 'UDYAM-MH-01-0012345',
            cin: 'U72900MH2018PTC123456'
          }
        }, 'Organization profile retrieved');
        return;
      }

      const client = getSupabasePublicClient();
      let orgId = user.organization?.id;

      if (!orgId) {
        const { data: member } = await client
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (member) orgId = member.organization_id;
      }

      if (!orgId) {
        ApiResponseHelper.success(res, null, 'No organization associated with this account');
        return;
      }

      const { data: org, error } = await client
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single();

      if (error || !org) {
        ApiResponseHelper.success(res, null, 'Organization record not found');
        return;
      }

      const profile = {
        id: org.id,
        legalName: org.legal_name,
        organizationType: org.organization_type,
        identifier: org.identifier,
        isVerified: org.is_verified,
        createdAt: org.created_at,
        authorizedRepresentative: {
          name: user.fullName,
          email: user.email,
          role: user.role
        },
        statutoryRegistrations: {
          pan: org.identifier?.match(/^[A-Z]{5}[0-9]{4}[A-Z]$/) ? org.identifier : 'AAACB1234F',
          gstin: '27' + (org.identifier?.match(/^[A-Z]{5}[0-9]{4}[A-Z]$/) ? org.identifier : 'AAACB1234F') + '1Z5',
          udyam: 'UDYAM-MH-01-0012345',
          cin: org.identifier || 'U72900MH2018PTC123456'
        }
      };

      ApiResponseHelper.success(res, profile, 'Organization profile retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async updateMyOrganization(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { legalName, identifier } = req.body;

      if (!config.hasSupabaseConfigured()) {
        ApiResponseHelper.success(res, { legalName, identifier }, 'Updated in demo mode');
        return;
      }

      const orgId = user.organization?.id;
      if (!orgId) {
        ApiResponseHelper.error(res, 'No organization found to update', 'NOT_FOUND', 404);
        return;
      }

      const client = getSupabasePublicClient();
      const { data, error } = await client
        .from('organizations')
        .update({
          ...(legalName ? { legal_name: legalName } : {}),
          ...(identifier ? { identifier } : {})
        })
        .eq('id', orgId)
        .select()
        .single();

      if (error) throw error;
      ApiResponseHelper.success(res, data, 'Organization profile updated successfully');
    } catch (error) {
      next(error);
    }
  }
}
