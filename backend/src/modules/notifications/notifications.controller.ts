import { Request, Response } from 'express';
import { NotificationsService } from './notifications.service.js';

export class NotificationsController {
  static async listNotifications(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const data = await NotificationsService.listUserNotifications(user, limit);
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Failed to list notifications' });
    }
  }

  static async markRead(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      await NotificationsService.markAsRead(user, id);
      res.json({ success: true, message: 'Notification marked as read' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Failed to update notification' });
    }
  }

  static async markAllRead(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      await NotificationsService.markAllAsRead(user);
      res.json({ success: true, message: 'All notifications marked as read' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message || 'Failed to update notifications' });
    }
  }
}
