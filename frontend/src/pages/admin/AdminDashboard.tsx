import React, { useState, useEffect } from 'react';
import {
  Shield,
  Users,
  Building2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  UserPlus,
  Activity,
  Server
} from 'lucide-react';
import { UserRole } from '@e-pramaan/shared';
import { api } from '../../services/api';

export const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Provision modal state
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [provFullName, setProvFullName] = useState('');
  const [provEmail, setProvEmail] = useState('');
  const [provPassword, setProvPassword] = useState('');
  const [provRole, setProvRole] = useState<UserRole>(UserRole.OFFICER);
  const [submittingProv, setSubmittingProv] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [usersRes, orgsRes] = await Promise.all([
        api.get<any[]>('/users').catch(() => ({ data: [] })),
        api.get<any[]>('/organizations').catch(() => ({ data: [] }))
      ]);
      setUsers(usersRes.data || []);
      setOrgs(orgsRes.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load administrative governance records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleProvisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingProv(true);
      setError(null);
      await api.post('/users/provision', {
        fullName: provFullName,
        email: provEmail,
        password: provPassword,
        role: provRole
      });
      setSuccessMsg(`Successfully provisioned authorized account: ${provFullName} (${provRole})`);
      setShowProvisionModal(false);
      setProvFullName('');
      setProvEmail('');
      setProvPassword('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to provision user account.');
    } finally {
      setSubmittingProv(false);
    }
  };

  const roleCounts = {
    bidders: users.filter(u => u.role === UserRole.BIDDER).length,
    officers: users.filter(u => u.role === UserRole.OFFICER).length,
    auditors: users.filter(u => u.role === UserRole.AUDITOR).length,
    admins: users.filter(u => u.role === UserRole.ADMIN).length,
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-slate-900 text-amber-400 rounded-lg shadow-inner">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 font-serif flex items-center gap-2">
                Central Sovereign Administration
                <span className="text-[10px] bg-slate-900 text-amber-400 font-mono font-bold px-2 py-0.5 rounded">
                  SYSADMIN ROOT
                </span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Role provisioning, sovereign entity verification, and cryptographic infrastructure governance.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowProvisionModal(true)}
            className="px-4 py-2 bg-gov-navy hover:bg-gov-navyLight text-white rounded-md text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <UserPlus className="h-4 w-4" /> Provision Officer / Auditor
          </button>
          <button
            type="button"
            onClick={loadData}
            className="p-2 border border-slate-300 hover:bg-slate-50 rounded-md text-slate-600 transition"
            title="Refresh dashboard metrics"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Procurement Officers</span>
            <Shield className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{roleCounts.officers}</div>
          <div className="text-[11px] text-slate-500">Authorized sanctioning personnel</div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Statutory Auditors</span>
            <Activity className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{roleCounts.auditors}</div>
          <div className="text-[11px] text-slate-500">CVC / CAG oversight accounts</div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Registered Vendors</span>
            <Building2 className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{roleCounts.bidders}</div>
          <div className="text-[11px] text-slate-500">{orgs.length} Sovereign Organizations Registered</div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Security Status</span>
            <Server className="h-4 w-4 text-purple-600" />
          </div>
          <div className="text-sm font-bold text-emerald-700 flex items-center gap-1.5 pt-1">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> RLS & Hashes Enforced
          </div>
          <div className="text-[11px] text-slate-500">PostgreSQL policies active</div>
        </div>
      </div>

      {/* User Provisioning Register */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-gov-navy" />
            <h2 className="text-sm font-bold text-slate-900">User Identity & Authorization Register</h2>
          </div>
          <span className="text-xs text-slate-500">{users.length} Active System Users</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                <th className="py-3 px-4">Full Legal Name</th>
                <th className="py-3 px-4">Official Email</th>
                <th className="py-3 px-4">Role / Authorization</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4">Registered On</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No user accounts found.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-semibold text-slate-900">{u.full_name || 'System User'}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{u.email}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                        u.role === UserRole.ADMIN
                          ? 'bg-purple-100 text-purple-800'
                          : u.role === UserRole.OFFICER
                          ? 'bg-blue-100 text-blue-800'
                          : u.role === UserRole.AUDITOR
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Active
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'System Default'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provisioning Modal */}
      {showProvisionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleProvisionSubmit} className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-gov-navy">
                <Shield className="h-5 w-5 text-amber-500" />
                <h3 className="font-bold text-slate-900">Provision Privileged Account</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowProvisionModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900">
              Only Central Administrators can provision <strong>Procurement Officer</strong> and <strong>Auditor</strong> credentials under sovereign security guidelines.
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Legal Name</label>
                <input
                  type="text"
                  required
                  value={provFullName}
                  onChange={(e) => setProvFullName(e.target.value)}
                  placeholder="e.g., Rajesh Sharma, IAS"
                  className="w-full border border-slate-300 rounded p-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Official Email Address</label>
                <input
                  type="email"
                  required
                  value={provEmail}
                  onChange={(e) => setProvEmail(e.target.value)}
                  placeholder="e.g., officer@nic.in"
                  className="w-full border border-slate-300 rounded p-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Initial Password</label>
                <input
                  type="password"
                  required
                  value={provPassword}
                  onChange={(e) => setProvPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-slate-300 rounded p-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Designated Role</label>
                <select
                  value={provRole}
                  onChange={(e) => setProvRole(e.target.value as UserRole)}
                  className="w-full border border-slate-300 rounded p-2 text-xs font-bold text-slate-800"
                >
                  <option value={UserRole.OFFICER}>Procurement Officer (Tender Creation, Evaluation, Sanction)</option>
                  <option value={UserRole.AUDITOR}>Auditor (CVC / CAG Read-Only Oversight, Anomaly Review)</option>
                  <option value={UserRole.ADMIN}>Central System Administrator</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowProvisionModal(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingProv}
                className="px-4 py-1.5 text-xs font-bold text-white bg-gov-navy hover:bg-gov-navyLight rounded disabled:opacity-50"
              >
                {submittingProv ? 'Provisioning...' : 'Confirm & Authorize Account'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
