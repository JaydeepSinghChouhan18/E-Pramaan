import React, { useState, useEffect } from 'react';
import { Bell, CheckCheck, Clock, Shield, RefreshCw } from 'lucide-react';
import { AppNotification } from '@e-pramaan/shared';
import { Wave3Api } from '../../services/wave3';
import { useRoleContext } from '../../contexts/RoleContext';

export const NotificationsPage: React.FC = () => {
  const { t } = useRoleContext();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const data = await Wave3Api.listNotifications(100);
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // silent fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await Wave3Api.markNotificationRead(id);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount(c => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  };

  const markAllRead = async () => {
    try {
      await Wave3Api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  const displayedNotifications = filter === 'UNREAD' 
    ? notifications.filter(n => !n.isRead)
    : notifications;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Bell className="w-5 h-5 text-gov-navy" />
            {t('notification.title') || 'Notifications'}
          </h1>
          <p className="text-xs text-slate-500">Official security alerts, workflow changes & system updates</p>
        </div>
        <div className="mt-3 sm:mt-0 flex items-center space-x-2">
          <button
            onClick={fetchNotifications}
            className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Refresh
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-md shadow-sm"
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1" />
              {t('notification.mark_all') || 'Mark All Read'}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
            filter === 'ALL'
              ? 'bg-gov-navy text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('UNREAD')}
          className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
            filter === 'UNREAD'
              ? 'bg-gov-navy text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center text-slate-500 text-xs">
          Loading alerts and notifications...
        </div>
      ) : displayedNotifications.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <Shield className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-500">{t('notification.empty') || 'No notifications at this time.'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100 shadow-sm overflow-hidden">
          {displayedNotifications.map(n => (
            <div
              key={n.id}
              onClick={() => markAsRead(n.id)}
              className={`p-4 hover:bg-slate-50 transition cursor-pointer flex items-start justify-between gap-4 ${
                !n.isRead ? 'bg-indigo-50/30' : ''
              }`}
            >
              <div className="flex-1 space-y-1">
                <div className="flex items-center space-x-2">
                  {!n.isRead && (
                    <span className="w-2 h-2 rounded-full bg-indigo-600 flex-shrink-0" />
                  )}
                  <h3 className="text-xs font-bold text-slate-900">{n.title}</h3>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                    {n.type}
                  </span>
                </div>
                <p className="text-xs text-slate-600">{n.message}</p>
                <div className="flex items-center space-x-3 text-[10px] text-slate-400 pt-1 font-mono">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
              {!n.isRead && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    markAsRead(n.id);
                  }}
                  className="text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 px-2 py-1 rounded hover:bg-indigo-100/50"
                >
                  Mark Read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
