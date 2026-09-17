import { Request, Response, NextFunction } from 'express';
import { ComplianceService } from './compliance.service.js';
import { AppError } from '../../middlewares/errorHandler.js';

export class ComplianceController {
  /**
   * POST /api/v1/compliance/bids/:bidId/run
   * Start or execute a verification run for a submitted bid.
   */
  static async runVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const run = await ComplianceService.runVerification(user, req.params.bidId);
      res.status(201).json({
        success: true,
        message: 'Verification run completed successfully.',
        data: run
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/compliance/bids/:bidId/latest
   * Retrieve latest verification run with requirement evaluations and discrepancies.
   */
  static async getLatestRun(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const run = await ComplianceService.getLatestVerificationRun(user, req.params.bidId);
      if (!run) {
        throw new AppError('No verification run found for this bid.', 404, 'NOT_FOUND');
      }
      res.json({
        success: true,
        data: run
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/compliance/bids/:bidId/bidder-summary
   * Bidder view: Retrieve privacy-safe compliance status without officer notes.
   */
  static async getBidderSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const summary = await ComplianceService.getBidderVerificationSummary(user, req.params.bidId);
      if (!summary) {
        throw new AppError('Verification has not yet been processed for this application.', 404, 'NOT_FOUND');
      }
      res.json({
        success: true,
        data: summary
      });
    } catch (err) {
      next(err);
    }
  }
}
