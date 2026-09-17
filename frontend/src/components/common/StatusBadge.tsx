import React from 'react';
import { VerificationStatus, ComplianceStatus, RiskLevel } from '@e-pramaan/shared';

export const StatusBadge: React.FC<{ status: VerificationStatus | ComplianceStatus | RiskLevel }> = ({ status }) => {
  const getBadgeStyle = () => {
    switch (status) {
      case VerificationStatus.VERIFIED:
      case ComplianceStatus.COMPLIANT:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case VerificationStatus.PARTIALLY_VERIFIED:
      case ComplianceStatus.CONDITIONAL:
      case ComplianceStatus.UNDER_REVIEW:
      case VerificationStatus.PENDING_VERIFICATION:
      case RiskLevel.MEDIUM:
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case VerificationStatus.DISCREPANCY:
      case VerificationStatus.NON_COMPLIANT:
      case ComplianceStatus.NON_COMPLIANT:
      case RiskLevel.HIGH:
      case RiskLevel.CRITICAL:
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case VerificationStatus.UNABLE_TO_VERIFY:
      case VerificationStatus.SOURCE_UNAVAILABLE:
      case VerificationStatus.ACCESS_PENDING:
      case VerificationStatus.ERROR:
        return 'bg-purple-50 text-purple-700 border-purple-200 font-medium';
      case VerificationStatus.NOT_APPLICABLE:
      case ComplianceStatus.EXEMPTED:
      case ComplianceStatus.NOT_APPLICABLE:
      case RiskLevel.LOW:
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${getBadgeStyle()}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
};
