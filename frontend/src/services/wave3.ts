import { api } from './api';
import {
  AIAssistantResponse,
  AIAssistantQueryPayload,
  TenderAISummary,
  IntegrationSourceHealth,
  AppNotification,
  GlobalSearchResponse,
} from '@e-pramaan/shared';

export class Wave3Api {
  // --- AI Assistant ---
  static async queryAssistant(payload: AIAssistantQueryPayload): Promise<AIAssistantResponse> {
    const res = await api.post<AIAssistantResponse>('/ai/query', payload);
    if (!res.data) throw new Error(res.message || 'AI Assistant query failed');
    return res.data;
  }

  static async getTenderSummary(tenderId: string): Promise<TenderAISummary> {
    const res = await api.get<TenderAISummary>(`/ai/tenders/${tenderId}/summary`);
    if (!res.data) throw new Error(res.message || 'Failed to fetch tender AI summary');
    return res.data;
  }

  static async getIntegrationHealth(): Promise<IntegrationSourceHealth[]> {
    const res = await api.get<IntegrationSourceHealth[]>('/ai/integration-health');
    return res.data || [];
  }

  // --- Notifications ---
  static async listNotifications(limit: number = 50): Promise<{
    total: number;
    unreadCount: number;
    notifications: AppNotification[];
  }> {
    const res = await api.get<{
      total: number;
      unreadCount: number;
      notifications: AppNotification[];
    }>(`/notifications?limit=${limit}`);
    return res.data || { total: 0, unreadCount: 0, notifications: [] };
  }

  static async markNotificationRead(id: string): Promise<void> {
    await api.patch(`/notifications/${id}/read`, {});
  }

  static async markAllNotificationsRead(): Promise<void> {
    await api.post('/notifications/mark-all-read', {});
  }

  // --- Global Search ---
  static async globalSearch(query: string, limit: number = 20): Promise<GlobalSearchResponse> {
    const res = await api.get<GlobalSearchResponse>(`/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    return res.data || { query, total: 0, results: [] };
  }
}
