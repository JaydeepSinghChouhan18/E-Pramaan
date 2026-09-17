import { Request, Response } from 'express';
import { AIAssistantService } from './ai.service.js';

export class AIController {
  static async queryAssistant(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { prompt, tenderId, bidId, language } = req.body;

      if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({ success: false, message: 'Prompt text is required' });
        return;
      }

      const result = await AIAssistantService.queryAssistant(user, prompt, tenderId, bidId, language);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'AI Assistant query failed' });
    }
  }

  static async getTenderSummary(req: Request, res: Response): Promise<void> {
    try {
      const { tenderId } = req.params;
      if (!tenderId) {
        res.status(400).json({ success: false, message: 'Tender ID is required' });
        return;
      }

      const summary = await AIAssistantService.getTenderAISummary(tenderId);
      res.json({ success: true, data: summary });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Failed to generate tender AI summary' });
    }
  }

  static async getIntegrationHealth(_req: Request, res: Response): Promise<void> {
    try {
      const health = AIAssistantService.getIntegrationHealth();
      res.json({ success: true, data: health });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Failed to fetch integration health' });
    }
  }
}
