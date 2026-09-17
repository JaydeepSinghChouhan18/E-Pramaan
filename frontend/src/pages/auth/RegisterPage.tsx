import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, User, Mail, Lock, Building2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole, OrganizationType } from '@e-pramaan/shared';

export const RegisterPage: React.FC = () => {
  const { register, error } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.BIDDER);
  const [organizationName, setOrganizationName] = useState('');
  const [organizationIdentifier, setOrganizationIdentifier] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setIsSubmitting(true);

    try {
      await register({
        email,
        password,
        fullName,
        role,
        organizationName: organizationName || undefined,
        organizationIdentifier: organizationIdentifier || undefined,
        organizationType: role === UserRole.OFFICER ? OrganizationType.GOVERNMENT_ENTITY : OrganizationType.BIDDER_ENTITY
      });

      if (role === UserRole.OFFICER) {
        navigate('/officer/dashboard', { replace: true });
      } else {
        navigate('/bidder/dashboard', { replace: true });
      }
    } catch (err: any) {
      setLocalError(err.message || 'Registration failed. Check details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center px-4 py-8">
      <div className="max-w-lg w-full bg-white rounded-lg border border-slate-200 shadow-sm p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gov-navy text-white rounded-lg mb-3 shadow-inner">
            <Shield className="w-6 h-6 text-amber-400" />
          </div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Register Verified Identity</h1>
          <p className="text-xs text-slate-500 mt-1">
            Government Procurement Officer or Participating Bidder Entity Registration
          </p>
        </div>

        {(localError || error) && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-md flex items-start space-x-2 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{localError || error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="fullName">
                Full Name
              </label>
              <div className="relative">
                <input
                  id="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Officer / Representative Name"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gov-navy focus:bg-white"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="role">
                Account Type / Role
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-300 rounded-md font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-gov-navy focus:bg-white"
              >
                <option value={UserRole.BIDDER}>Vendor / Bidder Entity</option>
                <option value={UserRole.OFFICER}>Procurement Officer</option>
                <option value={UserRole.AUDITOR}>Auditor / Oversight Authority</option>
              </select>
            </div>
          </div>

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
                placeholder="name@organization.gov.in"
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gov-navy focus:bg-white"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="password">
              Password (Min 8 characters)
            </label>
            <div className="relative">
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gov-navy focus:bg-white"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="orgName">
                Organization / Ministry
              </label>
              <div className="relative">
                <input
                  id="orgName"
                  type="text"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder="e.g. Ministry of Works / ABC Infra"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gov-navy focus:bg-white"
                />
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="orgId">
                CIN / PAN / Entity ID
              </label>
              <input
                id="orgId"
                type="text"
                value={organizationIdentifier}
                onChange={(e) => setOrganizationIdentifier(e.target.value)}
                placeholder="e.g. U72200DL2020PTC123456"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gov-navy focus:bg-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 text-xs font-semibold tracking-wide text-white uppercase bg-gov-navy hover:bg-gov-navyLight disabled:opacity-50 rounded-md transition shadow-sm"
          >
            {isSubmitting ? 'Registering Entity...' : 'Create Verified Account'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-gov-navy hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
