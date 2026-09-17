import React from 'react';
import { LucideIcon } from 'lucide-react';

interface ModulePlaceholderProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  actionTitle?: string;
  actionButtonText?: string;
  onActionClick?: () => void;
  workflowSteps?: string[];
  currentStep?: number;
}

export const ModulePlaceholder: React.FC<ModulePlaceholderProps> = ({
  title,
  subtitle,
  icon: Icon,
  actionTitle,
  actionButtonText,
  workflowSteps,
  currentStep = 1,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-gov-navyLight/10 text-gov-navy rounded-lg">
            <Icon className="w-6 h-6 text-gov-navy" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h1>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>
        {actionButtonText && (
          <button
            type="button"
            className="mt-3 sm:mt-0 inline-flex items-center px-4 py-2 text-xs font-semibold tracking-wide text-white uppercase transition-colors bg-gov-navy hover:bg-gov-navyLight rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gov-navy"
          >
            {actionButtonText}
          </button>
        )}
      </div>

      {workflowSteps && workflowSteps.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Workflow Lifecycle</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            {workflowSteps.map((step, idx) => (
              <div
                key={step}
                className={`p-3 rounded-md border text-xs flex items-center justify-between ${
                  idx + 1 === currentStep
                    ? 'border-gov-navy bg-slate-50 text-gov-navy font-semibold'
                    : idx + 1 < currentStep
                    ? 'border-emerald-200 bg-emerald-50/50 text-emerald-800'
                    : 'border-slate-100 bg-slate-50/50 text-slate-400'
                }`}
              >
                <span>{idx + 1}. {step}</span>
                {idx + 1 < currentStep && <span className="text-[10px] uppercase font-bold text-emerald-600">Done</span>}
                {idx + 1 === currentStep && <span className="text-[10px] uppercase font-bold text-gov-navy">Active</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 p-8 shadow-sm">
        <div className="max-w-2xl">
          <div className="inline-block px-2.5 py-1 rounded text-[11px] font-semibold tracking-wide uppercase bg-gov-goldLight text-gov-goldDark mb-3">
            Phase 1 Foundation Placeholder
          </div>
          <h2 className="text-base font-semibold text-slate-900 mb-1">{actionTitle || 'Module Structure Ready'}</h2>
          <p className="text-sm text-slate-600 mb-6">
            This module has been structurally registered in the router, role navigation tree, and layout hierarchy.
            Its backend services, verification checks, and state machines will be integrated in subsequent workflow phases.
          </p>

          <div className="p-4 bg-slate-50 rounded-md border border-slate-200 font-mono text-xs text-slate-600 space-y-1">
            <div className="text-slate-500 font-semibold mb-1 uppercase font-sans">Module Contract Status:</div>
            <div>• Component Mount: Ready</div>
            <div>• Route Resolution: Active</div>
            <div>• Permission Boundary: Strict (Backend-validated)</div>
            <div>• Verification Model: Non-binary (Supports UNAVAILABLE / ACCESS_PENDING states)</div>
          </div>
        </div>
      </div>
    </div>
  );
};
