import {
  UserProfile,
  AppNotification,
  NotificationType
} from '@e-pramaan/shared';
import { getSupabaseAdminClient } from '../../config/supabase.js';
import { config } from '../../config/env.js';

export class NotificationsService {
  static async listUserNotifications(
    user: UserProfile,
    limit: number = 50
  ): Promise<{ total: number; unreadCount: number; notifications: AppNotification[] }> {
    if (!config.hasSupabaseConfigured()) {
      return { total: 0, unreadCount: 0, notifications: [] };
    }

    const admin = getSupabaseAdminClient();
    const { data: list, error, count } = await admin
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('recipient_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to load notifications: ${error.message}`);
    }

    const unread = (list || []).filter((n: any) => !n.is_read).length;

    const notifications: AppNotification[] = (list || []).map((n: any) => ({
      id: n.id,
      recipientUserId: n.recipient_user_id,
      type: n.type as NotificationType,
      title: n.title,
      message: n.message,
      entityType: n.entity_type,
      entityId: n.entity_id,
      isRead: n.is_read,
      createdAt: n.created_at
    }));

    return {
      total: count || notifications.length,
      unreadCount: unread,
      notifications
    };
  }

  static async markAsRead(user: UserProfile, notificationId: string): Promise<void> {
    if (!config.hasSupabaseConfigured()) return;
    const admin = getSupabaseAdminClient();
    const { error } = await admin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('recipient_user_id', user.id);

    if (error) {
      throw new Error(`Failed to mark notification as read: ${error.message}`);
    }
  }

  static async markAllAsRead(user: UserProfile): Promise<void> {
    if (!config.hasSupabaseConfigured()) return;
    const admin = getSupabaseAdminClient();
    const { error } = await admin
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_user_id', user.id)
      .eq('is_read', false);

    if (error) {
      throw new Error(`Failed to mark all as read: ${error.message}`);
    }
  }

  static async createNotification(payload: {
    recipientUserId: string;
    type: NotificationType;
    title: string;
    message: string;
    entityType?: string;
    entityId?: string;
  }): Promise<void> {
    if (!config.hasSupabaseConfigured()) return;
    const admin = getSupabaseAdminClient();
    await admin.from('notifications').insert({
      recipient_user_id: payload.recipientUserId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      entity_type: payload.entityType || null,
      entity_id: payload.entityId || null,
      is_read: false
    });
  }
}
