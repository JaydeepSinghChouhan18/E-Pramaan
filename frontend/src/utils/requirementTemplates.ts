import { RequirementCategory, RequirementType, CreateRequirementPayload } from '@e-pramaan/shared';

export interface RequirementTemplatePreset {
  id: string;
  name: string;
  category: RequirementCategory;
  requirementType: RequirementType;
  description: string;
  defaultPayload: CreateRequirementPayload;
}

export const REQUIREMENT_TEMPLATES: RequirementTemplatePreset[] = [
  {
    id: 'gst_reg',
    name: 'GST Registration Verification',
    category: RequirementCategory.TAX,
    requirementType: RequirementType.REGISTRATION,
    description: 'Active GSTIN registered under the relevant state jurisdiction.',
    defaultPayload: {
      code: 'REQ_GST_REG',
      name: 'Active GST Registration Certificate',
      description: 'Vendor must hold an active GSTIN with valid registration status on GSTN portal.',
      category: RequirementCategory.TAX,
      requirementType: RequirementType.REGISTRATION,
      isMandatory: true,
      isApplicable: true,
      weight: 15,
      configuration: {
        rule: 'REQUIRED_REGISTRATION',
        registration: 'GSTIN',
        allowedStatus: ['Active']
      },
      evidenceTypes: ['GST_CERTIFICATE_PDF', 'GSTIN_NUMBER'],
      verificationSources: ['GSTN_REGISTRY']
    }
  },
  {
    id: 'gst_returns',
    name: 'GST Return Filing Track Record',
    category: RequirementCategory.TAX,
    requirementType: RequirementType.RETURN_FILING,
    description: 'Consistent filing of GSTR-3B and GSTR-1 for the preceding 12 months.',
    defaultPayload: {
      code: 'REQ_GST_RETURNS',
      name: 'Timely GST Return Filing (Last 12 Months)',
      description: 'Demonstrated tax compliance through regular GSTR-3B and GSTR-1 return filing.',
      category: RequirementCategory.TAX,
      requirementType: RequirementType.RETURN_FILING,
      isMandatory: true,
      isApplicable: true,
      weight: 10,
      configuration: {
        rule: 'RETURN_FILING_HISTORY',
        monthsRequired: 12,
        maxLateAllowed: 2
      },
      evidenceTypes: ['GSTR3B_RECEIPTS', 'GSTR1_SUMMARY'],
      verificationSources: ['GSTN_RETURNS_API']
    }
  },
  {
    id: 'pan_verification',
    name: 'Permanent Account Number (PAN) Verification',
    category: RequirementCategory.STATUTORY,
    requirementType: RequirementType.GOVERNMENT_VERIFICATION,
    description: 'Valid PAN registered and linked with authorized signatories.',
    defaultPayload: {
      code: 'REQ_PAN_VERIFY',
      name: 'Valid Entity PAN Verification',
      description: 'Permanent Account Number issued by Income Tax Department matching entity name.',
      category: RequirementCategory.STATUTORY,
      requirementType: RequirementType.GOVERNMENT_VERIFICATION,
      isMandatory: true,
      isApplicable: true,
      weight: 10,
      configuration: {
        rule: 'PAN_NAME_MATCH',
        allowedStatus: ['OPERATIVE']
      },
      evidenceTypes: ['PAN_CARD_COPY', 'PAN_NUMBER'],
      verificationSources: ['INCOME_TAX_NSDL']
    }
  },
  {
    id: 'company_age',
    name: 'Minimum Operating Vintage (Company Age)',
    category: RequirementCategory.COMPANY,
    requirementType: RequirementType.COMPANY_AGE,
    description: 'Years of continuous commercial operations since incorporation date.',
    defaultPayload: {
      code: 'REQ_COMPANY_AGE',
      name: 'Minimum Company Operational Experience',
      description: 'Entity must be incorporated and actively operating for the specified minimum duration.',
      category: RequirementCategory.COMPANY,
      requirementType: RequirementType.COMPANY_AGE,
      isMandatory: true,
      isApplicable: true,
      weight: 15,
      minimumThreshold: 3,
      configuration: {
        rule: 'MIN_COMPANY_AGE',
        value: 3,
        unit: 'YEARS'
      },
      evidenceTypes: ['INCORPORATION_CERTIFICATE', 'MCA_REGISTRATION'],
      verificationSources: ['MCA21_REGISTRY']
    }
  },
  {
    id: 'msme_udyam',
    name: 'Udyam / MSME Registration & Benefits',
    category: RequirementCategory.MSME,
    requirementType: RequirementType.REGISTRATION,
    description: 'Valid Udyam Registration number for exemption eligibility (EMD/Tender Fee).',
    defaultPayload: {
      code: 'REQ_MSME_UDYAM',
      name: 'Udyam Registration Certificate',
      description: 'Micro or Small Enterprise status certificate issued by Ministry of MSME.',
      category: RequirementCategory.MSME,
      requirementType: RequirementType.REGISTRATION,
      isMandatory: false,
      isApplicable: true,
      weight: 10,
      configuration: {
        rule: 'MSME_CLASSIFICATION',
        allowedTiers: ['Micro', 'Small', 'Medium']
      },
      evidenceTypes: ['UDYAM_CERTIFICATE_PDF', 'UDYAM_NUMBER'],
      verificationSources: ['UDYAM_PORTAL_API']
    }
  },
  {
    id: 'local_content',
    name: 'Make in India Local Content Attestation',
    category: RequirementCategory.LOCAL_CONTENT,
    requirementType: RequirementType.LOCAL_CONTENT,
    description: 'Minimum domestic value addition under Public Procurement (Make in India) Order.',
    defaultPayload: {
      code: 'REQ_LOCAL_CONTENT',
      name: 'Class-I / Class-II Local Content Attestation',
      description: 'Minimum 50% domestic content in goods, services, or civil works offered.',
      category: RequirementCategory.LOCAL_CONTENT,
      requirementType: RequirementType.LOCAL_CONTENT,
      isMandatory: true,
      isApplicable: true,
      weight: 20,
      minimumThreshold: 50,
      configuration: {
        rule: 'MIN_LOCAL_CONTENT',
        value: 50,
        unit: 'PERCENT'
      },
      evidenceTypes: ['COST_AUDITOR_CERTIFICATE', 'SELF_DECLARATION'],
      verificationSources: ['STATUTORY_AUDITOR_ATTESTATION']
    }
  },
  {
    id: 'epfo_compliance',
    name: 'EPFO Registration & ECR Filings',
    category: RequirementCategory.EMPLOYMENT_COMPLIANCE,
    requirementType: RequirementType.REGISTRATION,
    description: 'Employees Provident Fund registration and continuous monthly contribution challans.',
    defaultPayload: {
      code: 'REQ_EPFO_COMPLIANCE',
      name: 'EPFO Registration and Contribution Clearance',
      description: 'Proof of EPFO code number and payment of provident fund contributions.',
      category: RequirementCategory.EMPLOYMENT_COMPLIANCE,
      requirementType: RequirementType.REGISTRATION,
      isMandatory: false,
      isApplicable: true,
      weight: 10,
      configuration: {
        rule: 'EPFO_ACTIVE_STATUS'
      },
      evidenceTypes: ['EPFO_REGISTRATION_COPY', 'LAST_ECR_CHALLAN'],
      verificationSources: ['EPFO_PORTAL']
    }
  },
  {
    id: 'esic_compliance',
    name: 'ESIC Statutory Compliance',
    category: RequirementCategory.EMPLOYMENT_COMPLIANCE,
    requirementType: RequirementType.REGISTRATION,
    description: 'Employees State Insurance Corporation registration code and regular returns.',
    defaultPayload: {
      code: 'REQ_ESIC_COMPLIANCE',
      name: 'ESIC Registration & Payment Proof',
      description: 'Valid ESIC establishment registration with updated monthly payments.',
      category: RequirementCategory.EMPLOYMENT_COMPLIANCE,
      requirementType: RequirementType.REGISTRATION,
      isMandatory: false,
      isApplicable: true,
      weight: 10,
      configuration: {
        rule: 'ESIC_ACTIVE_STATUS'
      },
      evidenceTypes: ['ESIC_REGISTRATION_CERTIFICATE', 'ESIC_CHALLAN'],
      verificationSources: ['ESIC_PORTAL']
    }
  },
  {
    id: 'dpiit_startup',
    name: 'Startup India (DPIIT) Recognition',
    category: RequirementCategory.STARTUP,
    requirementType: RequirementType.CERTIFICATION,
    description: 'DPIIT recognized startup for prior experience/turnover waiver consideration.',
    defaultPayload: {
      code: 'REQ_STARTUP_DPIIT',
      name: 'DPIIT Startup Recognition Certificate',
      description: 'Department for Promotion of Industry and Internal Trade recognition certificate.',
      category: RequirementCategory.STARTUP,
      requirementType: RequirementType.CERTIFICATION,
      isMandatory: false,
      isApplicable: true,
      weight: 5,
      configuration: {
        rule: 'STARTUP_RECOGNITION'
      },
      evidenceTypes: ['DPIIT_CERTIFICATE_PDF'],
      verificationSources: ['STARTUP_INDIA_API']
    }
  },
  {
    id: 'oem_authorization',
    name: 'Original Equipment Manufacturer (OEM) Authorization',
    category: RequirementCategory.OEM,
    requirementType: RequirementType.AUTHORIZATION,
    description: 'Manufacturer Authorization Form (MAF) directly from certified equipment maker.',
    defaultPayload: {
      code: 'REQ_OEM_MAF',
      name: 'Manufacturer Authorization Form (MAF)',
      description: 'Tender-specific authorization letter ensuring warranty and spare parts support.',
      category: RequirementCategory.OEM,
      requirementType: RequirementType.AUTHORIZATION,
      isMandatory: true,
      isApplicable: true,
      weight: 15,
      configuration: {
        rule: 'OEM_AUTHORIZATION_VERIFICATION'
      },
      evidenceTypes: ['MAF_LETTER_SIGNED_PDF'],
      verificationSources: ['OEM_AUTHORIZED_SIGNATORY']
    }
  },
  {
    id: 'non_blacklisting',
    name: 'Non-Debarment & Integrity Declaration',
    category: RequirementCategory.STATUTORY,
    requirementType: RequirementType.DECLARATION,
    description: 'Affidavit affirming firm has not been blacklisted by Central/State Governments.',
    defaultPayload: {
      code: 'REQ_NON_BLACKLIST',
      name: 'Non-Debarment & Non-Blacklisting Affidavit',
      description: 'Sworn affidavit on non-judicial stamp paper confirming zero active debarments.',
      category: RequirementCategory.STATUTORY,
      requirementType: RequirementType.DECLARATION,
      isMandatory: true,
      isApplicable: true,
      weight: 10,
      configuration: {
        rule: 'NON_DEBARMENT_DECLARATION'
      },
      evidenceTypes: ['NOTARIZED_AFFIDAVIT_PDF'],
      verificationSources: ['CENTRAL_DEBARMENT_DATABASE']
    }
  },
  {
    id: 'digilocker_vault',
    name: 'DigiLocker Verified Credential Attestation',
    category: RequirementCategory.DOCUMENT,
    requirementType: RequirementType.GOVERNMENT_VERIFICATION,
    description: 'Direct cryptographic verification from Government DigiLocker National Vault.',
    defaultPayload: {
      code: 'REQ_DIGILOCKER_DOC',
      name: 'DigiLocker Verified Statutory Document',
      description: 'Cryptographically signed document pulled directly from issuer DigiLocker repository.',
      category: RequirementCategory.DOCUMENT,
      requirementType: RequirementType.GOVERNMENT_VERIFICATION,
      isMandatory: false,
      isApplicable: true,
      weight: 10,
      configuration: {
        rule: 'DIGILOCKER_DIRECT_FETCH'
      },
      evidenceTypes: ['DIGILOCKER_URI', 'CRYPTOGRAPHIC_XML_PROOF'],
      verificationSources: ['DIGILOCKER_GOV_IN']
    }
  }
];
