import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Shield, Lock, Mail, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '@e-pramaan/shared';


export const LoginPage: React.FC = () => {
  const { login, error } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setIsSubmitting(true);

    try {
      const loggedUser = await login({ email, password });
      const role = loggedUser?.role;
      let defaultDest = '/bidder/dashboard';
      if (role === UserRole.ADMIN) defaultDest = '/admin/dashboard';
      else if (role === UserRole.AUDITOR) defaultDest = '/auditor/dashboard';
      else if (role === UserRole.OFFICER) defaultDest = '/officer/dashboard';

      const from = (location.state as any)?.from?.pathname;

      // Validate return path belongs to authenticated user's actual database role
      let targetDest = defaultDest;
      if (from && typeof from === 'string' && from.startsWith('/')) {
        if (role === UserRole.ADMIN) {
          if (from.startsWith('/admin') || from.startsWith('/officer') || from === '/help' || from === '/notifications') {
            targetDest = from;
          }
        } else if (role === UserRole.AUDITOR) {
          if (from.startsWith('/auditor') || from.startsWith('/officer') || from === '/help' || from === '/notifications') {
            targetDest = from;
          }
        } else if (role === UserRole.OFFICER) {
          if (from.startsWith('/officer') || from === '/help' || from === '/notifications') {
            targetDest = from;
          }
        } else if (role === UserRole.BIDDER) {
          if (from.startsWith('/bidder') || from === '/help' || from === '/notifications') {
            targetDest = from;
          }
        }
      }

      navigate(targetDest, { replace: true });
    } catch (err: any) {
      setLocalError(err.message || 'Authentication failed. Verify credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSessionExpired = new URLSearchParams(location.search).get('expired') === '1';

  return (
    <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full bg-white rounded-lg border border-slate-200 shadow-sm p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gov-navy text-white rounded-lg mb-3 shadow-inner">
            <Shield className="w-6 h-6 text-amber-400" />
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Portal Authentication</h1>
          <p className="text-xs text-slate-500 mt-1">
            Official National Procurement Verification Gateway
          </p>
        </div>

        {isSessionExpired && !localError && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start space-x-2 text-xs text-amber-800">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
            <span>Your session has expired. Please sign in again.</span>
          </div>
        )}

        {(localError || error) && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-md flex items-start space-x-2 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{localError || error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="email">
              Official Email Address
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="officer@gov.in or vendor@company.com"
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gov-navy focus:bg-white"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gov-navy focus:bg-white"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 text-xs font-semibold tracking-wide text-white uppercase bg-gov-navy hover:bg-gov-navyLight disabled:opacity-50 rounded-md transition shadow-sm"
          >
            {isSubmitting ? 'Authenticating...' : 'Sign In Securely'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
          Need a verified procurement account?{' '}
          <Link to="/register" className="font-semibold text-gov-navy hover:underline">
            Register Entity
          </Link>
        </div>
      </div>
    </div>
  );
};
