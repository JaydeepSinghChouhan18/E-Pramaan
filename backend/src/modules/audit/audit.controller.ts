import { Request, Response, NextFunction } from 'express';
import { AuditService } from './audit.service.js';

export class AuditController {
  static async listEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const data = await AuditService.listAuditEvents(user, req.query as any);
      res.json({
        success: true,
        data
      });
    } catch (err) {
      next(err);
    }
  }

  static async recordAIOverride(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const data = await AuditService.recordAIOverride(user, req.body);
      res.status(201).json({
        success: true,
        message: 'AI override recorded.',
        data
      });
    } catch (err) {
      next(err);
    }
  }

  static async listAIOverrides(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await AuditService.listAIOverrides(req.query as any);
      res.json({
        success: true,
        data
      });
    } catch (err) {
      next(err);
    }
  }

  static async exportAuditPackage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const tenderId = req.query.tenderId as string | undefined;
      const zipBuffer = await AuditService.exportAuditPackage(user, { tenderId });

      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `e-pramaan-audit-package-${dateStr}.zip`;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', zipBuffer.length);
      res.status(200).send(zipBuffer);
    } catch (err) {
      next(err);
    }
  }
}
