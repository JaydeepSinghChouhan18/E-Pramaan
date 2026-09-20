import { Request, Response, NextFunction } from 'express';
import { AwardsService } from './awards.service.js';
import { TendersService } from '../tenders/tenders.service.js';

export class AwardsController {
  static async getTenderBidComparison(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const tenderId = req.params.tenderId;
      const [bids, existingDecision, tender] = await Promise.all([
        AwardsService.getTenderBidComparison(user, tenderId),
        AwardsService.getDecisionByTenderId(user, tenderId),
        TendersService.getTenderById(user, tenderId).catch(() => null)
      ]);

      res.json({
        success: true,
        data: {
          tender,
          bids,
          existing_decision: existingDecision
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async recordAwardDecision(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const data = await AwardsService.recordAwardDecision(user, req.body);
      res.status(201).json({
        success: true,
        message: 'Award decision recorded.',
        data
      });
    } catch (err) {
      next(err);
    }
  }

  static async getDecisionByTenderId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const data = await AwardsService.getDecisionByTenderId(user, req.params.tenderId);
      res.json({
        success: true,
        data
      });
    } catch (err) {
      next(err);
    }
  }

  static async getDecisionReconstruction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const data = await AwardsService.getDecisionReconstruction(user, req.params.decisionId);
      res.json({
        success: true,
        data
      });
    } catch (err) {
      next(err);
    }
  }

  static async getBidderTransparency(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const data = await AwardsService.getBidderTransparency(user, req.params.tenderId);
      res.json({
        success: true,
        data
      });
    } catch (err) {
      next(err);
    }
  }

  static async revokeAwardDecision(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { tenderId } = req.params;
      const { justification } = req.body;
      const data = await AwardsService.revokeAwardDecision(user, tenderId, justification);
      res.json({
        success: true,
        message: data.message,
        data
      });
    } catch (err) {
      next(err);
    }
  }
}
