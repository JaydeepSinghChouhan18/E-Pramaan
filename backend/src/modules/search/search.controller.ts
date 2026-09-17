import { Request, Response } from 'express';
import { SearchService } from './search.service.js';

export class SearchController {
  static async searchGlobal(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const query = (req.query.q as string) || '';
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const data = await SearchService.searchGlobal(user, query, limit);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Global search failed' });
    }
  }
}
