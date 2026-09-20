import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Shield,
  Globe,
  UserCheck,
  ChevronDown,
  Bell,
  LogOut,
  Search,
  Clock,
  CheckCheck,
  X,
  Menu
} from 'lucide-react';
import { UserRole, SupportedLanguage, AppNotification, SearchResultItem } from '@e-pramaan/shared';
import { useRoleContext } from '../../contexts/RoleContext';
import { useAuth } from '../../contexts/AuthContext';
import { LANGUAGE_OPTIONS } from '../../i18n/translations';
import { Wave3Api } from '../../services/wave3';

interface HeaderProps {
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileMenu }) => {
  const { activeRole, setActiveRole, language, setLanguage, t } = useRoleContext();
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  // Notification states
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);

  // Global Search states
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // User Profile Menu state
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAuthenticated) {
      loadNotifications();
      const interval = setInterval(loadNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadNotifications = async () => {
    try {
      const data = await Wave3Api.listNotifications(20);
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // silent fallback
    }
  };

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      setSearching(true);
      const res = await Wave3Api.globalSearch(q.trim(), 10);
      setSearchResults(res.results || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const markRead = async (id: string, url?: string) => {
    try {
      await Wave3Api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      if (url) {
        setNotificationsOpen(false);
        navigate(url);
      }
    } catch {
      // ignore
    }
  };

  const markAllRead = async () => {
    try {
      await Wave3Api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextRole = e.target.value as UserRole;
    setActiveRole(nextRole);
    if (nextRole === UserRole.OFFICER) {
      navigate('/officer/dashboard');
    } else if (nextRole === UserRole.BIDDER) {
      navigate('/bidder/dashboard');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
      {/* Sovereign National Portal Ribbon */}
      <div className="bg-gov-navy text-white text-[11px] py-1 px-4 sm:px-8 flex justify-between items-center tracking-wide font-medium">
        <div className="flex items-center space-x-2">
          <span>भारत सरकार | Government of India</span>
          <span className="text-slate-400">|</span>
          <span className="text-slate-300">Chennai Petroleum Corporation Limited (CPCL)</span>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5 text-xs text-slate-200">
            <Globe className="w-3.5 h-3.5" />
            <select
              aria-label="Select Language"
              value={language}
              onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
              className="bg-transparent border-none text-white text-xs py-0.5 focus:outline-none cursor-pointer"
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code} className="text-slate-900">
                  {opt.nativeLabel} ({opt.label})
                </option>
              ))}
            </select>
          </div>
          <span className="text-slate-500">|</span>
          <span className="text-gov-gold font-semibold tracking-wider">OFFICIAL SYSTEM</span>
        </div>
      </div>

      {/* Main Header Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          {onToggleMobileMenu && (
            <button
              type="button"
              onClick={onToggleMobileMenu}
              className="md:hidden p-1.5 rounded-md text-slate-600 hover:text-gov-navy hover:bg-slate-100"
              aria-label="Open sidebar menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <Link to="/" className="flex items-center space-x-3 flex-shrink-0">
            <div className="w-9 h-9 rounded bg-gov-navy flex items-center justify-center text-white shadow-inner">
              <Shield className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-black tracking-tight text-gov-navy">{t('portal.title')}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">v1.0</span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 hidden sm:block">
                {t('portal.subtitle')}
              </p>
            </div>
          </Link>
        </div>

        {/* Global Search Input */}
        <div className="relative flex-1 max-w-md hidden md:block" ref={searchRef}>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={t('action.search')}
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-gov-navy focus:border-gov-navy transition"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Search Dropdown Results */}
          {searchOpen && searchQuery.trim() && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden z-50">
              <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                <span>Search Results for "{searchQuery}"</span>
                <span>{searchResults.length} matches</span>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 text-xs">
                {searching ? (
                  <div className="p-4 text-center text-slate-500">Searching records...</div>
                ) : searchResults.length === 0 ? (
                  <div className="p-4 text-center text-slate-500">No records found matching query.</div>
                ) : (
                  searchResults.map((item) => (
                    <div
                      key={`${item.entityType}-${item.id}`}
                      onClick={() => {
                        setSearchOpen(false);
                        navigate(item.url);
                      }}
                      className="p-3 hover:bg-slate-50 cursor-pointer flex items-start justify-between gap-2 transition"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                            item.entityType === 'TENDER'
                              ? 'bg-blue-100 text-blue-800'
                              : item.entityType === 'BID'
                              ? 'bg-purple-100 text-purple-800'
                              : item.entityType === 'INVESTIGATION'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {item.entityType}
                          </span>
                          <span className="font-bold text-slate-900">{item.title}</span>
                        </div>
                        <p className="text-slate-600 text-[11px] mt-0.5 line-clamp-1">{item.subtitle}</p>
                      </div>
                      {item.status && (
                        <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 whitespace-nowrap">
                          {item.status}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-3 sm:space-x-4 flex-shrink-0">
          {/* Demo Role Switcher shown only when not logged in */}
          {!isAuthenticated && (
            <div className="flex items-center space-x-2 bg-slate-100/90 border border-slate-300 px-2.5 py-1 rounded-md">
              <UserCheck className="w-3.5 h-3.5 text-gov-navy" />
              <div className="text-[10px] text-slate-600 font-semibold uppercase hidden lg:inline">Role:</div>
              <div className="relative">
                <select
                  aria-label="Switch User Role"
                  value={activeRole}
                  onChange={handleRoleChange}
                  className="text-xs font-bold text-gov-navy bg-white border border-slate-300 rounded px-2 py-0.5 pr-6 cursor-pointer focus:outline-none"
                >
                  <option value={UserRole.OFFICER}>Procurement Officer</option>
                  <option value={UserRole.BIDDER}>Registered Bidder</option>
                </select>
                <ChevronDown className="w-3 h-3 text-slate-500 absolute right-1.5 top-1.5 pointer-events-none" />
              </div>
            </div>
          )}

          {!isAuthenticated && <div className="h-6 w-px bg-slate-200" />}

          {/* Authenticated User Area */}
          {isAuthenticated && user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center space-x-2.5 p-1 rounded-md hover:bg-slate-100 transition text-left"
              >
                <div className="w-8 h-8 rounded-full bg-gov-navy text-white flex items-center justify-center font-bold text-xs shadow-inner">
                  {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-bold text-slate-900 leading-tight">{user.fullName}</span>
                  <div className="flex items-center space-x-1 text-[10px] text-slate-500">
                    <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 font-semibold uppercase">{user.role}</span>
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden">
                  <div className="p-3 bg-slate-50 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900 leading-tight">{user.fullName}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">{user.email}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                        {user.role}
                      </span>
                      {user.organization && (
                        <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded truncate max-w-[160px]" title={user.organization.legalName}>
                          {user.organization.legalName}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="p-1">
                    <Link
                      to={user.role === 'BIDDER' ? '/bidder/company-profile' : '/officer/dashboard'}
                      onClick={() => setUserMenuOpen(false)}
                      className="block px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 rounded transition"
                    >
                      {user.role === 'BIDDER' ? 'Company Profile' : 'Officer Dashboard'}
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full text-left flex items-center space-x-2 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded transition"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Link
                to="/login"
                className="text-xs font-bold text-gov-navy hover:text-gov-navyLight px-2.5 py-1.5 rounded"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="text-xs font-semibold text-white bg-gov-navy hover:bg-gov-navyLight px-3 py-1.5 rounded shadow-xs"
              >
                Register
              </Link>
            </div>
          )}

          {/* Notification Bell with Dropdown */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              aria-label="Notifications"
              className="p-1.5 rounded-md text-slate-500 hover:text-gov-navy hover:bg-slate-100 relative transition"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden">
                <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-gov-navy" />
                    <span className="font-bold text-xs text-slate-900">{t('notification.title')}</span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.2 rounded">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-[11px] text-indigo-700 hover:text-indigo-900 font-semibold flex items-center gap-1"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      {t('notification.mark_all')}
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 text-xs">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      {t('notification.empty')}
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => markRead(n.id)}
                        className={`p-3 hover:bg-slate-50 cursor-pointer transition flex items-start justify-between gap-2 ${
                          !n.isRead ? 'bg-indigo-50/40' : ''
                        }`}
                      >
                        <div className="flex-1 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            {!n.isRead && (
                              <span className="w-2 h-2 rounded-full bg-indigo-600 flex-shrink-0" />
                            )}
                            <h4 className="font-bold text-slate-900">{n.title}</h4>
                          </div>
                          <p className="text-slate-600 text-[11px]">{n.message}</p>
                          <span className="text-[10px] text-slate-400 flex items-center gap-1 pt-1 font-mono">
                            <Clock className="w-3 h-3" />
                            {new Date(n.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-2 border-t border-slate-100 bg-slate-50 text-center">
                  <Link
                    to="/notifications"
                    onClick={() => setNotificationsOpen(false)}
                    className="text-xs font-semibold text-gov-navy hover:underline"
                  >
                    View All Notifications & Alerts →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
