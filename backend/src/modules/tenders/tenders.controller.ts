import { Request, Response, NextFunction } from 'express';
import { TendersService } from './tenders.service.js';
import { ApiResponseHelper } from '../../utils/apiResponse.js';
import { AppError } from '../../middlewares/errorHandler.js';

export class TendersController {
  static async createTender(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
      }
      const tender = await TendersService.createTender(req.user, req.body);
      ApiResponseHelper.success(res, tender, 'Tender created in DRAFT status', 201);
    } catch (error) {
      next(error);
    }
  }

  static async listTenders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
      }
      const queryParams = req.query as any;
      const result = await TendersService.listTenders(req.user, queryParams);
      ApiResponseHelper.success(res, result, 'Tenders retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getTenderById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
      }
      const tender = await TendersService.getTenderById(req.user, req.params.id);
      ApiResponseHelper.success(res, tender, 'Tender details retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async updateTender(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
      }
      const updated = await TendersService.updateTender(req.user, req.params.id, req.body);
      ApiResponseHelper.success(res, updated, 'Tender updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async addRequirement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
      }
      const reqRecord = await TendersService.addRequirement(req.user, req.params.id, req.body);
      ApiResponseHelper.success(res, reqRecord, 'Requirement added to tender', 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateRequirement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
      }
      const updated = await TendersService.updateRequirement(
        req.user,
        req.params.id,
        req.params.requirementId,
        req.body
      );
      ApiResponseHelper.success(res, updated, 'Requirement updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async deleteRequirement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
      }
      await TendersService.deleteRequirement(req.user, req.params.id, req.params.requirementId);
      ApiResponseHelper.success(res, { deleted: true }, 'Requirement removed from tender');
    } catch (error) {
      next(error);
    }
  }

  static async publishTender(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
      }
      const published = await TendersService.publishTender(req.user, req.params.id);
      ApiResponseHelper.success(res, published, 'Tender published successfully');
    } catch (error) {
      next(error);
    }
  }

  static async transitionLifecycle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
      }
      const transitioned = await TendersService.transitionLifecycle(
        req.user,
        req.params.id,
        req.body.action
      );
      ApiResponseHelper.success(res, transitioned, 'Tender lifecycle status updated');
    } catch (error) {
      next(error);
    }
  }
}
