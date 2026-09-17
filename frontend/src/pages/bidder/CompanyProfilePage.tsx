import React from 'react';
import { Building2 } from 'lucide-react';
import { ModulePlaceholder } from '../../components/common/ModulePlaceholder';

export const CompanyProfilePage: React.FC = () => (
  <ModulePlaceholder
    title="Bidder Organization Profile"
    subtitle="Corporate registry records, shareholding patterns, and operational clearances"
    icon={Building2}
    actionTitle="Organization Registry"
    actionButtonText="Update MCA Data"
    workflowSteps={['Entity Details', 'Authorized Signatories', 'Compliance Registrations', 'Verified Profile']}
    currentStep={3}
  />
);
