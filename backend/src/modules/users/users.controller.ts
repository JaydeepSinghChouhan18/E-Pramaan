import { Request, Response, NextFunction } from 'express';
import { ApiResponseHelper } from '../../utils/apiResponse.js';
import { getSupabaseAdminClient } from '../../config/supabase.js';

export class UsersController {
  static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        ApiResponseHelper.error(res, 'Authentication required', 'UNAUTHENTICATED', 401);
        return;
      }
      ApiResponseHelper.success(res, req.user, 'Authenticated profile retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  static async listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const admin = getSupabaseAdminClient();
      const { data, error } = await admin
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        ApiResponseHelper.error(res, error.message, 'DB_ERROR', 500);
        return;
      }
      ApiResponseHelper.success(res, data || [], 'Users retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  static async provisionUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, fullName, role } = req.body;
      if (!email || !password || !fullName || !role) {
        ApiResponseHelper.error(res, 'Missing required fields: email, password, fullName, role', 'VALIDATION_ERROR', 400);
        return;
      }

      const admin = getSupabaseAdminClient();
      const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, role }
      });

      if (authErr || !authUser.user) {
        ApiResponseHelper.error(res, authErr?.message || 'Failed to provision user', 'PROVISION_FAILED', 400);
        return;
      }

      const { error: dbErr } = await admin
        .from('users')
        .upsert({
          id: authUser.user.id,
          email,
          full_name: fullName,
          role,
          is_active: true
        });

      if (dbErr) {
        ApiResponseHelper.error(res, dbErr.message, 'DB_ERROR', 500);
        return;
      }

      ApiResponseHelper.success(res, { id: authUser.user.id, email, fullName, role }, 'User provisioned successfully', 201);
    } catch (error) {
      next(error);
    }
  }
}
