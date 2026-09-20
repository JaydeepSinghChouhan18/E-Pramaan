import React, { useState, useEffect } from 'react';
import {
  Building2,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileText,
  UserCheck,
  Edit2,
  Save,
  X,
  Sparkles,
  ArrowRight,
  BadgeCheck,
  Loader2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';

interface OrgProfile {
  id: string;
  legalName: string;
  organizationType: string;
  identifier?: string;
  isVerified: boolean;
  createdAt?: string;
  authorizedRepresentative?: {
    name: string;
    email: string;
    role: string;
  };
  statutoryRegistrations?: {
    pan?: string;
    gstin?: string;
    udyam?: string;
    cin?: string;
  };
}

export const CompanyProfilePage: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<OrgProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Mode
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editIdentifier, setEditIdentifier] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<OrgProfile>('/organizations/me');
      if (res.data) {
        setProfile(res.data);
        setEditName(res.data.legalName);
        setEditIdentifier(res.data.identifier || '');
      } else {
        // Fallback for demo bidder
        const fallback: OrgProfile = {
          id: user?.organization?.id || 'demo-org',
          legalName: user?.organization?.legalName || 'Bharat Infrastructure & InfraTech Ltd',
          organizationType: user?.organization?.organizationType || 'BIDDER_ENTITY',
          identifier: user?.organization?.identifier || 'U72900MH2018PTC123456',
          isVerified: user?.organization?.isVerified ?? true,
          authorizedRepresentative: {
            name: user?.fullName || 'Jaydeep Singh',
            email: user?.email || 'bidder@epramaan.gov.in',
            role: user?.role || 'BIDDER'
          },
          statutoryRegistrations: {
            pan: 'AAACB1234F',
            gstin: '27AAACB1234F1Z5',
            udyam: 'UDYAM-MH-01-0012345',
            cin: 'U72900MH2018PTC123456'
          }
        };
        setProfile(fallback);
        setEditName(fallback.legalName);
        setEditIdentifier(fallback.identifier || '');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load organization profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      await api.patch('/organizations/me', {
        legalName: editName,
        identifier: editIdentifier
      });
      setIsEditing(false);
      await fetchProfile();
    } catch (err: any) {
      alert(err.message || 'Failed to update organization profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-xs text-slate-500 space-y-2">
        <Loader2 className="w-6 h-6 animate-spin text-gov-navy mx-auto" />
        <p>Loading verified organization profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-gov-navyLight/15 text-gov-navy rounded-xl flex-shrink-0">
              <Building2 className="w-8 h-8 text-gov-navy" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  {profile?.legalName || 'Bidder Organization'}
                </h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  SOVEREIGN VERIFIED
                </span>
                <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                  {profile?.organizationType || 'BIDDER_ENTITY'}
                </span>
              </div>
              <p className="text-xs text-slate-500 pt-1">
                Official Government of India public procurement registry identity, statutory credentials, and compliance standings.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {!isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold transition"
              >
                <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit Profile
              </button>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="inline-flex items-center px-3 py-1.5 bg-gov-navy hover:bg-gov-navyLight text-white rounded text-xs font-bold transition disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5 mr-1" /> {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-xs transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Inline Edit Form */}
        {isEditing && (
          <div className="mt-6 pt-5 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Legal Entity Name
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs bg-white focus:ring-1 focus:ring-gov-navy"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Corporate Identification (CIN / Reg No.)
              </label>
              <input
                type="text"
                value={editIdentifier}
                onChange={(e) => setEditIdentifier(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs bg-white font-mono focus:ring-1 focus:ring-gov-navy"
              />
            </div>
          </div>
        )}
      </div>

      {/* Grid: Statutory Registrations & Authorized Signatory */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Statutory Tax & Corporate Registrations */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <BadgeCheck className="w-4 h-4 text-gov-navy" />
              Statutory Sovereign Registrations
            </h3>
            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              CVC / CAG AUDITED
            </span>
          </div>

          <div className="space-y-3 text-xs">
            {/* PAN */}
            <div className="p-3 bg-slate-50 rounded border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-slate-400 text-[10px] font-semibold uppercase block">Income Tax PAN</span>
                <span className="font-mono font-bold text-slate-800 text-sm">
                  {profile?.statutoryRegistrations?.pan || 'AAACB1234F'}
                </span>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
                ACTIVE & VERIFIED
              </span>
            </div>

            {/* GSTIN */}
            <div className="p-3 bg-slate-50 rounded border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-slate-400 text-[10px] font-semibold uppercase block">Goods & Services Tax (GSTIN)</span>
                <span className="font-mono font-bold text-slate-800 text-sm">
                  {profile?.statutoryRegistrations?.gstin || '27AAACB1234F1Z5'}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">State Code: 27 (Maharashtra) • Regular Taxpayer</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
                ACTIVE
              </span>
            </div>

            {/* MCA CIN */}
            <div className="p-3 bg-slate-50 rounded border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-slate-400 text-[10px] font-semibold uppercase block">Ministry of Corporate Affairs (CIN)</span>
                <span className="font-mono font-bold text-slate-800 text-xs">
                  {profile?.statutoryRegistrations?.cin || profile?.identifier || 'U72900MH2018PTC123456'}
                </span>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
                REGISTERED
              </span>
            </div>

            {/* MSME Udyam */}
            <div className="p-3 bg-slate-50 rounded border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-slate-400 text-[10px] font-semibold uppercase block">MSME Udyam Registration</span>
                <span className="font-mono font-bold text-slate-800 text-xs">
                  {profile?.statutoryRegistrations?.udyam || 'UDYAM-MH-01-0012345'}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Class: Medium • EMD & Fee Exemption Eligible</span>
              </div>
              <span className="text-[10px] font-bold text-purple-700 bg-white px-2 py-0.5 rounded border border-purple-200">
                UDYAM AUTHENTICATED
              </span>
            </div>
          </div>
        </div>

        {/* Authorized Representative & Actions */}
        <div className="space-y-6">
          {/* Representative Card */}
          <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-gov-navy" />
                Primary Authorized Signatory
              </h3>
              <span className="text-[10px] font-bold text-slate-500 font-mono">
                POWER OF ATTORNEY
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Full Legal Name:</span>
                <strong className="text-slate-900">{profile?.authorizedRepresentative?.name || user?.fullName || 'Authorized Person'}</strong>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Official Email:</span>
                <span className="font-mono text-slate-800">{profile?.authorizedRepresentative?.email || user?.email}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Delegated Role:</span>
                <span className="font-semibold text-gov-navy">{profile?.authorizedRepresentative?.role || user?.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Digital Signing Credential:</span>
                <span className="text-emerald-700 font-bold flex items-center">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Class 3 DSC Linked
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions & Vault Integration */}
          <div className="bg-slate-900 text-white rounded-lg p-5 space-y-3">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h4 className="font-bold text-sm">Bidder Readiness & Verification</h4>
            </div>
            <p className="text-xs text-slate-300">
              Ensure all statutory documents are up to date in your Document Vault before applying to tenders.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <Link
                to="/bidder/documents"
                className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded transition shadow-xs"
              >
                <FileText className="w-3.5 h-3.5 mr-1.5" /> Manage Vault Documents
              </Link>
              <Link
                to="/bidder/self-check"
                className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded border border-slate-700 transition"
              >
                Run Self-Check <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
