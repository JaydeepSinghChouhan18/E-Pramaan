import React, { useState } from 'react';
import {
  HelpCircle,
  Search,
  FileCheck,
  ShieldAlert,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import { useRoleContext } from '../../contexts/RoleContext';
import { UserRole } from '@e-pramaan/shared';

interface FAQItem {
  question: string;
  answer: string;
  category: 'OFFICER' | 'BIDDER' | 'GENERAL';
}

const FAQS: FAQItem[] = [
  {
    category: 'GENERAL',
    question: 'What is e-Pramaan?',
    answer: 'e-Pramaan is India’s sovereign AI-powered trust, verification, and compliance platform designed for national public procurement. It evaluates submitted vendor qualifications directly against verifiable source databases (GSTN, PAN, MCA21, EPFO, Udyam) to eradicate bid fraud and corruption while accelerating genuine awards.'
  },
  {
    category: 'GENERAL',
    question: 'Does the AI make final qualification or award decisions?',
    answer: 'No. Under General Financial Rules (GFR 2017), the AI functions strictly as an explainable decision-support advisor. All final procurement qualification determinations, disqualifications, and binding contract sanctions are executed solely by authorized Procurement Officers.'
  },
  {
    category: 'OFFICER',
    question: 'How does the Verification Engine score bids?',
    answer: 'Scores are computed deterministically (0–100) using tender-defined criteria weights. Mandatory requirements must be 100% fulfilled for compliant qualification. Discrepancies between self-declarations and verified sovereign data directly penalize the compliance score and raise risk indicators.'
  },
  {
    category: 'OFFICER',
    question: 'When is a statutory justification mandatory during contract awards?',
    answer: 'If an officer selects a contender with a lower compliance score or elevated risk level compared to other qualified bidders, the Central Vigilance Commission (CVC) / CAG statutory audit protocol mandates recording a comprehensive written justification before final sanction.'
  },
  {
    category: 'BIDDER',
    question: 'What is Self-Check for bidders?',
    answer: 'Self-Check allows prospective bidders to run an automated pre-submission readiness scan on their company credentials and uploaded evidence before formal submission, highlighting missing documents or discrepancies privately.'
  },
  {
    category: 'BIDDER',
    question: 'What information is published after contract award?',
    answer: 'Once a tender award is finalized and published, the public and competing vendors can inspect the winning bidder entity name, contract value, award date, and compliance fulfillment status. Sensitive trade secrets, proprietary financial statements, internal risk scores, and investigations remain confidential under RTI Section 8(1)(d).'
  }
];

export const HelpPage: React.FC = () => {
  const { activeRole } = useRoleContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const filteredFaqs = FAQS.filter((f) => {
    if (activeRole === UserRole.OFFICER && f.category === 'BIDDER') return false;
    if (activeRole === UserRole.BIDDER && f.category === 'OFFICER') return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <HelpCircle className="h-6 w-6 text-gov-navy" />
            <h1 className="text-xl font-bold text-slate-900 font-serif">e-Pramaan Knowledge & Help Center</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Official operating guidelines, procurement compliance workflows, and transparency standards.
          </p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search FAQs & guides..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-gov-navy focus:border-gov-navy"
          />
        </div>
      </div>

      {/* Guide Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs">
            <FileCheck className="h-4 w-4" />
            Verification Workflows
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Understand automated cross-checks, source gateway connections, and document evidence extraction.
          </p>
        </div>

        <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-amber-700 font-bold text-xs">
            <ShieldAlert className="h-4 w-4" />
            Risk & Investigation
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Neutral anomaly reviews, timeline audit logs, and conflict of interest indicators.
          </p>
        </div>

        <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-purple-700 font-bold text-xs">
            <Sparkles className="h-4 w-4" />
            Procurement AI Co-Pilot
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Conversational assistance strictly grounded in verified database evidence with Web Speech playback.
          </p>
        </div>
      </div>

      {/* Frequently Asked Questions */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Statutory Procurement Questions & Answers</h2>
          <span className="text-xs text-slate-500 font-medium">Role: {activeRole}</span>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredFaqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div key={idx} className="p-5 hover:bg-slate-50 transition">
                <button
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full text-left flex items-center justify-between gap-4"
                >
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <span className="text-indigo-600">Q{idx + 1}.</span> {faq.question}
                  </span>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600 leading-relaxed">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sovereign Notice */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 flex items-start gap-3">
        <Info className="h-5 w-5 text-slate-400 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-700">Official Portal Advisory: </span>
          All evaluations, audit logs, and decisions are permanently archived pursuant to the Public Records Act and Central Vigilance Commission guidelines.
        </div>
      </div>
    </div>
  );
};
