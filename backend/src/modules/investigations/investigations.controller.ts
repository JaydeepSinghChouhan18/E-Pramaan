import { Request, Response, NextFunction } from 'express';
import { InvestigationsService } from './investigations.service.js';
import { AppError } from '../../middlewares/errorHandler.js';

export class InvestigationsController {
  static async createInvestigation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const data = await InvestigationsService.createInvestigation(user, req.body);
      res.status(201).json({
        success: true,
        message: 'Investigation case created successfully.',
        data
      });
    } catch (err) {
      next(err);
    }
  }

  static async listInvestigations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const data = await InvestigationsService.listInvestigations(user, req.query as any);
      res.json({
        success: true,
        data
      });
    } catch (err) {
      next(err);
    }
  }

  static async getInvestigationById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const data = await InvestigationsService.getInvestigationById(user, req.params.id);
      res.json({
        success: true,
        data
      });
    } catch (err) {
      next(err);
    }
  }

  static async addNote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      if (!req.body.noteText) {
        throw new AppError('Note text is required', 400, 'VALIDATION_ERROR');
      }
      await InvestigationsService.addNote(user, req.params.id, req.body.noteText);
      res.json({
        success: true,
        message: 'Investigator note added to timeline.'
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const data = await InvestigationsService.updateStatus(user, req.params.id, req.body);
      res.json({
        success: true,
        message: 'Investigation status updated.',
        data
      });
    } catch (err) {
      next(err);
    }
  }
}
