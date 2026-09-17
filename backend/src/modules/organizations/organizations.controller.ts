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
}
