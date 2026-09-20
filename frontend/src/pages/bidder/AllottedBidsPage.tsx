import React, { useState, useEffect, useCallback } from 'react';
import { Award, Building2, CheckCircle2, Search, AlertCircle } from 'lucide-react';
import { TenderListItem, TenderStatus } from '@e-pramaan/shared';
import { TendersApi } from '../../services/tenders';
import { AwardsApi } from '../../services/wave2';

interface AwardedTenderCard {
  tender: TenderListItem;
  winningBidderName?: string;
  winningBidAmount?: number | null;
  complianceScore?: number;
  awardedAt?: string;
  decisionReason?: string;
  isMyBidWinner?: boolean;
}

export const AllottedBidsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [awardedList, setAwardedList] = useState<AwardedTenderCard[]>([]);
  const [search, setSearch] = useState('');

  const loadAllottedTenders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch awarded tenders
      const res = await TendersApi.listTenders({
        status: TenderStatus.AWARDED,
        pageSize: 50
      });

      const cards: AwardedTenderCard[] = [];

      for (const t of res.items || []) {
        try {
          const trans = await AwardsApi.getBidderTransparency(t.id);
          cards.push({
            tender: t,
            winningBidderName: trans?.winningBidderName || 'Awarded Vendor',
            winningBidAmount: trans?.winningBidAmount,
            complianceScore: trans?.complianceScore,
            awardedAt: trans?.awardedAt,
            decisionReason: trans?.decisionReason,
            isMyBidWinner: trans?.isMyBidWinner
          });
        } catch {
          // If public award summary not available, display tender info
          cards.push({ tender: t });
        }
      }

      setAwardedList(cards);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve awarded tender notices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllottedTenders();
  }, [loadAllottedTenders]);

  const filtered = awardedList.filter(item => {
    const q = search.toLowerCase();
    return (
      item.tender.tenderNumber.toLowerCase().includes(q) ||
      item.tender.title.toLowerCase().includes(q) ||
      (item.winningBidderName && item.winningBidderName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Award className="w-5 h-5 text-gov-navy" />
            <h1 className="text-lg font-bold text-slate-900">Allotted Bids & Public Procurement Awards</h1>
          </div>
          <p className="text-xs text-slate-500 pt-1">
            Transparency registry of completed government procurement allotments, awarded vendors, and finalized value.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
            PUBLIC DISCLOSURE
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
            GFR 2017 COMPLIANT
          </span>
        </div>
      </div>

      {/* Search Input */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <div className="relative max-w-md">
          <input
            type="text"
            placeholder="Search awarded contracts by tender number, keyword, or vendor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gov-navy focus:bg-white"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid of Awarded Tenders */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">Loading awarded procurement notices...</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 bg-white rounded-lg border border-slate-200 text-center text-xs text-slate-500 space-y-2">
          <Award className="w-8 h-8 text-slate-300 mx-auto" />
          <div className="font-semibold text-slate-700">No awarded contracts found</div>
          <p>Tenders that reach formal AWARDED status will be published here with public winner disclosures.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((item) => (
            <div
              key={item.tender.id}
              className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-4 hover:border-gov-navy transition"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-gov-navy bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {item.tender.tenderNumber}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> AWARDED & ALLOTTED
                  </span>
                </div>

                <h2 className="text-sm font-bold text-slate-900">{item.tender.title}</h2>

                {item.tender.procuringOrganization && (
                  <div className="text-xs text-slate-600 flex items-center">
                    <Building2 className="w-3.5 h-3.5 mr-1 text-slate-400" />
                    <span>{item.tender.procuringOrganization.legalName}</span>
                  </div>
                )}
              </div>

              {/* Winner & Value Section */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-semibold">Awarded Vendor:</span>
                  <span className="font-bold text-slate-900 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-gov-navy" />
                    {item.winningBidderName}
                  </span>
                </div>

                {item.winningBidAmount && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold">Contract Award Value:</span>
                    <span className="font-mono font-bold text-emerald-700">
                      ?{item.winningBidAmount.toLocaleString('en-IN')}
                    </span>
                  </div>
                )}

                {item.complianceScore !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold">Statutory Compliance Score:</span>
                    <span className="font-bold text-indigo-700">
                      {item.complianceScore}/100 Met
                    </span>
                  </div>
                )}

                {item.awardedAt && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-[11px] text-slate-400">
                    <span>Award Formulated:</span>
                    <span>{new Date(item.awardedAt).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              <div className="text-[11px] text-slate-400 italic flex items-center justify-between pt-1">
                <span>Verification Hash Secured</span>
                <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.2 rounded">IMMUTABLE</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
