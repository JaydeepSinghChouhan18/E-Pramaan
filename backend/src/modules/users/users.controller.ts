import { Request, Response, NextFunction } from 'express';
import { ApiResponseHelper } from '../../utils/apiResponse.js';

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
}
