import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service.js';
import { ApiResponseHelper } from '../../utils/apiResponse.js';

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const session = await AuthService.register(req.body);
      ApiResponseHelper.success(res, session, 'Account registration completed successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const session = await AuthService.login(req.body);
      ApiResponseHelper.success(res, session, 'Authentication successful');
    } catch (error) {
      next(error);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await AuthService.logout(req.authToken);
      ApiResponseHelper.success(res, { loggedOut: true }, 'Signed out successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        ApiResponseHelper.error(res, 'Authentication required', 'UNAUTHENTICATED', 401);
        return;
      }
      ApiResponseHelper.success(res, req.user, 'Current user profile loaded');
    } catch (error) {
      next(error);
    }
  }
}
