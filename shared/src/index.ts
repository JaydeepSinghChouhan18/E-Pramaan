/**
 * e-Pramaan Core Domain Enums and Shared Contracts
 * Source of Truth for Verification, Risk, Compliance, Roles, Tenders, and Requirements
 */

export enum UserRole {
  OFFICER = 'OFFICER',
  BIDDER = 'BIDDER',
  ADMIN = 'ADMIN',
  AUDITOR = 'AUDITOR'
}

export enum OrganizationType {
  BIDDER_ENTITY = 'BIDDER_ENTITY',
  GOVERNMENT_ENTITY = 'GOVERNMENT_ENTITY',
  PROCURING_AGENCY = 'PROCURING_AGENCY',
  REGULATORY_BODY = 'REGULATORY_BODY'
}

export enum MembershipRole {
  PRIMARY_OFFICER = 'PRIMARY_OFFICER',
  EVALUATOR = 'EVALUATOR',
  SIGNATORY = 'SIGNATORY',
  AUTHORIZED_REPRESENTATIVE = 'AUTHORIZED_REPRESENTATIVE',
  COMPLIANCE_OFFICER = 'COMPLIANCE_OFFICER',
  MEMBER = 'MEMBER'
}

export enum VerificationStatus {
  NOT_APPLICABLE = 'NOT_APPLICABLE',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  VERIFIED = 'VERIFIED',
  PARTIALLY_VERIFIED = 'PARTIALLY_VERIFIED',
  DISCREPANCY = 'DISCREPANCY',
  NON_COMPLIANT = 'NON_COMPLIANT',
  UNABLE_TO_VERIFY = 'UNABLE_TO_VERIFY',
  SOURCE_UNAVAILABLE = 'SOURCE_UNAVAILABLE',
  ACCESS_PENDING = 'ACCESS_PENDING',
  ERROR = 'ERROR'
}

export enum IntegrationStatus {
  PRODUCTION_CONNECTED = 'PRODUCTION_CONNECTED',
  SANDBOX = 'SANDBOX',
  ACCESS_PENDING = 'ACCESS_PENDING',
  UNAVAILABLE = 'UNAVAILABLE',
  ERROR = 'ERROR'
}

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum ComplianceStatus {
  COMPLIANT = 'COMPLIANT',
  NON_COMPLIANT = 'NON_COMPLIANT',
  UNDER_REVIEW = 'UNDER_REVIEW',
  CONDITIONAL = 'CONDITIONAL',
  EXEMPTED = 'EXEMPTED',
  NOT_APPLICABLE = 'NOT_APPLICABLE'
}

// -------------------------------------------------------------------
// Phase 3: Tender & Requirements Domain Models
// -------------------------------------------------------------------

export enum TenderStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  CLOSED = 'CLOSED',
  UNDER_EVALUATION = 'UNDER_EVALUATION',
  AWARDED = 'AWARDED',
  CANCELLED = 'CANCELLED'
}

export enum TenderLifecycleAction {
  PUBLISH = 'PUBLISH',
  CLOSE = 'CLOSE',
  START_EVALUATION = 'START_EVALUATION',
  AWARD = 'AWARD',
  CANCEL = 'CANCEL'
}

export enum RequirementCategory {
  STATUTORY = 'STATUTORY',
  TAX = 'TAX',
  MSME = 'MSME',
  LOCAL_CONTENT = 'LOCAL_CONTENT',
  EMPLOYMENT_COMPLIANCE = 'EMPLOYMENT_COMPLIANCE',
  STARTUP = 'STARTUP',
  OEM = 'OEM',
  DOCUMENT = 'DOCUMENT',
  COMPANY = 'COMPANY',
  TENDER_SPECIFIC = 'TENDER_SPECIFIC',
  OTHER = 'OTHER'
}

export enum RequirementType {
  DOCUMENT = 'DOCUMENT',
  REGISTRATION = 'REGISTRATION',
  TAX_COMPLIANCE = 'TAX_COMPLIANCE',
  RETURN_FILING = 'RETURN_FILING',
  COMPANY_AGE = 'COMPANY_AGE',
  LOCAL_CONTENT = 'LOCAL_CONTENT',
  CERTIFICATION = 'CERTIFICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  GOVERNMENT_VERIFICATION = 'GOVERNMENT_VERIFICATION',
  DECLARATION = 'DECLARATION',
  CUSTOM = 'CUSTOM'
}

export interface RequirementConfiguration {
  rule?: string;
  value?: number | string | boolean;
  unit?: string;
  registration?: string;
  documentType?: string;
  criteria?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface TenderRequirement {
  id: string;
  tenderId: string;
  code: string;
  name: string;
  description?: string | null;
  category: RequirementCategory;
  requirementType: RequirementType;
  isMandatory: boolean;
  isApplicable: boolean;
  weight: number;
  minimumThreshold?: number | null;
  configuration: RequirementConfiguration;
  evidenceTypes: string[];
  verificationSources: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Tender {
  id: string;
  tenderNumber: string;
  title: string;
  description?: string | null;
  tenderDocument?: string | null;
  procuringOrganizationId?: string | null;
  createdBy?: string | null;
  publicationDate?: string | null;
  submissionDeadline: string;
  openingDate?: string | null;
  status: TenderStatus;
  estimatedValue?: number | null;
  currency: string;
  minimumCompanyAgeYears?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface TenderListItem {
  id: string;
  tenderNumber: string;
  title: string;
  tenderDocument?: string | null;
  procuringOrganization?: {
    id: string;
    legalName: string;
  } | null;
  status: TenderStatus;
  submissionDeadline: string;
  estimatedValue?: number | null;
  currency: string;
  requirementCount: number;
  mandatoryRequirementCount: number;
  createdAt: string;
}

export interface TenderDetail extends Tender {
  tenderDocument?: string | null;
  procuringOrganization?: {
    id: string;
    legalName: string;
    organizationType: OrganizationType;
    identifier?: string | null;
  } | null;
  creator?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  requirements: TenderRequirement[];
}

export interface CreateTenderPayload {
  tenderNumber: string;
  title: string;
  description?: string;
  tenderDocument?: string;
  procuringOrganizationId?: string;
  publicationDate?: string;
  submissionDeadline: string;
  openingDate?: string;
  estimatedValue?: number;
  currency?: string;
  minimumCompanyAgeYears?: number;
}

export interface UpdateTenderPayload {
  title?: string;
  description?: string;
  tenderDocument?: string;
  submissionDeadline?: string;
  openingDate?: string;
  estimatedValue?: number;
  currency?: string;
  minimumCompanyAgeYears?: number;
}

export interface CreateRequirementPayload {
  code: string;
  name: string;
  description?: string;
  category: RequirementCategory;
  requirementType: RequirementType;
  isMandatory?: boolean;
  isApplicable?: boolean;
  weight?: number;
  minimumThreshold?: number;
  configuration?: RequirementConfiguration;
  evidenceTypes?: string[];
  verificationSources?: string[];
}

export interface UpdateRequirementPayload {
  name?: string;
  description?: string;
  category?: RequirementCategory;
  requirementType?: RequirementType;
  isMandatory?: boolean;
  isApplicable?: boolean;
  weight?: number;
  minimumThreshold?: number;
  configuration?: RequirementConfiguration;
  evidenceTypes?: string[];
  verificationSources?: string[];
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// -------------------------------------------------------------------
// User and Organization domain interfaces
// -------------------------------------------------------------------

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  organization?: OrganizationSummary | null;
}

export interface OrganizationSummary {
  id: string;
  legalName: string;
  organizationType: OrganizationType;
  identifier?: string | null;
  membershipRole: MembershipRole;
  isVerified: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  organizationName?: string;
  organizationType?: OrganizationType;
  organizationIdentifier?: string;
}

export interface AuthSessionResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  user: UserProfile;
}

export interface CriterionEvaluation {
  criterionId: string;
  criterionName: string;
  isMandatory: boolean;
  isApplicable: boolean;
  exemptionReason?: string;
  verificationStatus: VerificationStatus;
  complianceStatus: ComplianceStatus;
  evaluatedAt?: string;
  notes?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
    version?: string;
  };
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  service: string;
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
}

// -------------------------------------------------------------------
// Phase 4: Bid Submission & Document Management Domain Models
// -------------------------------------------------------------------

export enum BidStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  WITHDRAWN = 'WITHDRAWN',
  UNDER_REVIEW = 'UNDER_REVIEW',
  QUALIFIED = 'QUALIFIED',
  DISQUALIFIED = 'DISQUALIFIED'
}

export interface BidDocument {
  id: string;
  bidId: string;
  tenderRequirementId: string;
  documentName: string;
  storagePath: string;
  fileSize: number;
  mimeType: string;
  sha256Hash?: string | null;
  verificationStatus: VerificationStatus;
  metadata?: Record<string, unknown>;
  uploadedAt: string;
  uploadedBy: string;
  // Enriched requirement details for display
  requirementCode?: string;
  requirementName?: string;
  category?: RequirementCategory;
  isMandatory?: boolean;
  version?: number;
}

export interface Bid {
  id: string;
  tenderId: string;
  bidderOrganizationId: string;
  submittedByUserId: string;
  bidNumber: string;
  status: BidStatus;
  bidAmount?: number | null;
  submissionNotes?: string | null;
  submittedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BidListItem {
  id: string;
  bidNumber: string;
  tenderId: string;
  tenderNumber: string;
  tenderTitle: string;
  bidderOrganizationId: string;
  bidderOrganizationName: string;
  status: BidStatus;
  bidAmount?: number | null;
  submissionDeadline: string;
  submittedAt?: string | null;
  documentCount: number;
  mandatoryRequirementCount: number;
  mandatorySatisfiedCount: number;
  createdAt: string;
}

export interface RequirementDocumentMapItem {
  requirement: TenderRequirement;
  documents: BidDocument[];
  isSatisfied: boolean;
}

export interface BidDetail extends Bid {
  tender?: TenderDetail | null;
  bidderOrganization?: {
    id: string;
    legalName: string;
    organizationType: OrganizationType;
    identifier?: string | null;
    isVerified: boolean;
  } | null;
  submittedBy?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  documents: BidDocument[];
  requirementsMap?: RequirementDocumentMapItem[];
  canEdit: boolean;
  canSubmit: boolean;
  missingMandatoryRequirements: string[];
}

export interface CreateBidPayload {
  tenderId: string;
  bidAmount?: number;
  submissionNotes?: string;
}

export interface AttachDocumentPayload {
  tenderRequirementId: string;
  documentName: string;
  fileSize: number;
  mimeType: string;
  storagePath?: string;
  sha256Hash?: string;
  metadata?: Record<string, unknown>;
}

export interface SubmitBidPayload {
  confirmation: boolean;
  bidAmount?: number;
  submissionNotes?: string;
}

// -------------------------------------------------------------------
// Phase 5: Verification & Compliance Engine Domain Models
// -------------------------------------------------------------------

export enum RunStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export enum DiscrepancySeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL'
}

export interface ExtractedField {
  fieldName: string;
  fieldValue: string | number | boolean | null;
  confidence: number | null; // 0.0 to 1.0, null if not applicable
  sourceDocumentId?: string;
  sourceDocumentName?: string;
  locationReference?: string; // e.g. "Page 1, Box 3"
  extractedAt: string;
}

export interface ExtractedEvidence {
  id: string;
  bidDocumentId: string;
  documentName: string;
  fields: Record<string, ExtractedField>;
  rawSnippet?: string | null;
  provider: string; // e.g. "SYSTEM_EXTRACTOR", "AI_DOC_INTELLIGENCE"
  status: VerificationStatus;
  createdAt: string;
}

export interface Discrepancy {
  id: string;
  code: string;
  title: string;
  description: string;
  severity: DiscrepancySeverity;
  affectedRequirementIds: string[];
  affectedDocumentIds: string[];
  expectedValue?: string | number | null;
  actualValue?: string | number | null;
  detectedAt: string;
}

export interface RequirementEvaluation {
  id: string;
  verificationRunId: string;
  tenderRequirementId: string;
  requirementCode: string;
  requirementName: string;
  category: RequirementCategory;
  isMandatory: boolean;
  isApplicable: boolean;
  verificationStatus: VerificationStatus;
  complianceStatus: ComplianceStatus;
  weight: number;
  scoreAwarded: number;
  maxScore: number;
  evidenceFound: boolean;
  documentReferences: Array<{
    documentId: string;
    documentName: string;
    verificationStatus: VerificationStatus;
  }>;
  extractedFields: Record<string, ExtractedField>;
  reasons: string[];
  discrepancies: Discrepancy[];
  evaluatedAt: string;
}

export interface ComplianceScore {
  overallScore: number; // 0 - 100
  totalPossibleScore: number;
  mandatoryComplied: boolean;
  mandatoryMetCount: number;
  mandatoryTotalCount: number;
  optionalMetCount: number;
  optionalTotalCount: number;
  categoryBreakdown: Record<string, {
    score: number;
    maxScore: number;
    satisfied: boolean;
  }>;
}

export interface RiskAssessment {
  riskLevel: RiskLevel;
  riskScore: number; // 0 - 100
  factors: Array<{
    factor: string;
    severity: RiskLevel;
    description: string;
    groundedIn: string[]; // references to requirements, discrepancies, or documents
  }>;
  recommendationSummary: string;
}

export interface AIRecommendation {
  status: 'AVAILABLE' | 'AI_UNAVAILABLE' | 'ACCESS_PENDING' | 'ERROR';
  summary?: string;
  rationale?: string;
  flaggedObservations?: string[];
  evidenceGroundedRefs?: string[];
  model?: string;
  provider?: string;
  generatedAt?: string;
}

export interface VerificationSourceStatus {
  sourceId: string;
  sourceName: string;
  category: string;
  status: IntegrationStatus;
  lastChecked?: string;
  message?: string;
}

export interface VerificationRun {
  id: string;
  bidId: string;
  tenderId: string;
  bidNumber: string;
  runStatus: RunStatus;
  verificationStatus: VerificationStatus;
  complianceScore: ComplianceScore;
  riskAssessment: RiskAssessment;
  aiRecommendation: AIRecommendation;
  evaluations: RequirementEvaluation[];
  discrepancies: Discrepancy[];
  sourcesStatus: VerificationSourceStatus[];
  executedByUserId?: string | null;
  executedByRole?: string | null;
  startedAt: string;
  completedAt?: string | null;
  isLatest: boolean;
}

export interface BidderVerificationSummary {
  runId: string;
  bidNumber: string;
  verificationStatus: VerificationStatus;
  mandatoryComplied: boolean;
  evaluations: Array<{
    requirementCode: string;
    requirementName: string;
    category: RequirementCategory;
    isMandatory: boolean;
    isApplicable: boolean;
    verificationStatus: VerificationStatus;
    complianceStatus: ComplianceStatus;
    reasons: string[];
    evidenceAttached: boolean;
    discrepanciesCount: number;
  }>;
  discrepancies: Array<{
    code: string;
    title: string;
    description: string;
    severity: DiscrepancySeverity;
  }>;
  completedAt?: string | null;
}

// -------------------------------------------------------------------
// Wave 2: Risk & Investigation, Awards, and Audit & Governance Domain Models
// -------------------------------------------------------------------

export enum InvestigationStatus {
  OPEN = 'OPEN',
  IN_REVIEW = 'IN_REVIEW',
  ACTION_REQUIRED = 'ACTION_REQUIRED',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED'
}

export enum InvestigationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum InvestigationType {
  COMPLIANCE_DISCREPANCY = 'COMPLIANCE_DISCREPANCY',
  DOCUMENT_INCONSISTENCY = 'DOCUMENT_INCONSISTENCY',
  STATUTORY_VERIFICATION = 'STATUTORY_VERIFICATION',
  ENTITY_RISK = 'ENTITY_RISK',
  BLACKLISTING_DEBARMENT = 'BLACKLISTING_DEBARMENT',
  TENDER_SPECIFIC = 'TENDER_SPECIFIC',
  OTHER = 'OTHER'
}

export interface InvestigationRiskSignal {
  id: string;
  sourceReference: string;
  severity: RiskLevel;
  explanation: string;
  status: string;
  timestamp: string;
}

export interface InvestigationEvidenceReference {
  id: string;
  type: string; // e.g. "DISCREPANCY", "DOCUMENT", "REQUIREMENT", "AI_OBSERVATION"
  referenceId: string;
  title: string;
  description?: string;
  attachedAt: string;
}

export interface InvestigationEvent {
  id: string;
  investigationId: string;
  actorUserId: string;
  actorName: string;
  actorRole: UserRole;
  eventType: string; // "CREATED", "ASSIGNED", "STATUS_CHANGED", "NOTE_ADDED", "EVIDENCE_ADDED", "RESOLVED", "CLOSED"
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface InvestigationCase {
  id: string;
  caseNumber: string;
  bidId: string;
  tenderId: string;
  bidderOrganizationId: string;
  title: string;
  description: string;
  investigationType: InvestigationType;
  priority: InvestigationPriority;
  status: InvestigationStatus;
  createdByUserId: string;
  assignedToUserId?: string | null;
  openedAt: string;
  resolvedAt?: string | null;
  resolutionSummary?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvestigationListItem {
  id: string;
  caseNumber: string;
  bidId: string;
  bidNumber: string;
  tenderId: string;
  tenderNumber: string;
  tenderTitle: string;
  bidderOrganizationId: string;
  bidderOrganizationName: string;
  title: string;
  investigationType: InvestigationType;
  priority: InvestigationPriority;
  status: InvestigationStatus;
  riskLevel: RiskLevel;
  assignedToName?: string | null;
  openedAt: string;
  createdAt: string;
}

export interface InvestigationDetail extends InvestigationCase {
  bidNumber: string;
  tenderNumber: string;
  tenderTitle: string;
  bidderOrganizationName: string;
  createdByName: string;
  assignedToName?: string | null;
  riskAssessment?: RiskAssessment | null;
  complianceScore?: ComplianceScore | null;
  discrepancies: Discrepancy[];
  evidenceReferences: InvestigationEvidenceReference[];
  timeline: InvestigationEvent[];
}

export interface CreateInvestigationPayload {
  bidId: string;
  title: string;
  description: string;
  investigationType: InvestigationType;
  priority: InvestigationPriority;
  assignedToUserId?: string;
  evidenceReferences?: Array<{
    type: string;
    referenceId: string;
    title: string;
    description?: string;
  }>;
}

// -------------------------------------------------------------------
// Awards & Comparative Bid Decisions
// -------------------------------------------------------------------

export enum AwardDecisionStatus {
  DRAFT = 'DRAFT',
  UNDER_REVIEW = 'UNDER_REVIEW',
  CLARIFICATION_REQUIRED = 'CLARIFICATION_REQUIRED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED'
}

export interface BidComparisonItem {
  bidId: string;
  bidNumber: string;
  bidderOrganizationId: string;
  bidderOrganizationName: string;
  bidStatus: BidStatus;
  bidAmount?: number | null;
  submittedAt?: string | null;
  complianceScore: number;
  riskLevel: RiskLevel;
  mandatoryComplied: boolean;
  mandatoryMetCount: number;
  mandatoryTotalCount: number;
  discrepanciesCount: number;
  criticalDiscrepanciesCount: number;
  openInvestigationsCount: number;
  verificationStatus: VerificationStatus;
  evidenceCount: number;

  // Real MCDA & Comparative Evaluation Fields
  eligibilityStatus?: 'PASS' | 'FAIL';
  ineligibilityReasons?: string[];
  experienceYears?: number | null;
  experienceScore?: number;
  experienceEvidenceNote?: string;
  priceScore?: number;
  mcdaScore?: number;
  rank?: number | null;
  rankingExplanation?: string;
  mcdaWeights?: {
    compliance: number;
    experience: number;
    price: number;
  };
}

export interface ComparativeEvaluationResult {
  tenderId: string;
  evaluatedAt: string;
  evaluationVersion: number;
  weights: {
    compliance: number;
    experience: number;
    price: number;
  };
  totalBidsCount: number;
  eligibleBidsCount: number;
  excludedBidsCount: number;
  lowestEligiblePrice: number | null;
  rankedBids: BidComparisonItem[];
  excludedBids: BidComparisonItem[];
  topRankedExplanation?: {
    bidId: string;
    bidNumber: string;
    bidderName: string;
    rank: number;
    mcdaScore: number;
    complianceScore: number;
    experienceScore: number;
    priceScore: number;
    bidAmount: number | null;
    lowestEligiblePrice: number | null;
    weights: { compliance: number; experience: number; price: number };
    keyVerifiedEvidence: string[];
    riskLevel: RiskLevel;
    discrepanciesCount: number;
    summary: string;
  } | null;
  existingDecision?: AwardDecision | null;
}

export interface AwardDecision {
  id: string;
  tenderId: string;
  selectedBidId: string;
  selectedBidderOrganizationId: string;
  decisionStatus: AwardDecisionStatus;
  selectedComplianceScore: number;
  selectedRiskLevel: RiskLevel;
  decisionReason: string;
  clarificationRequired: boolean;
  clarificationText?: string | null;
  justificationText?: string | null;
  evidenceReferences?: Array<{
    type: string;
    referenceId: string;
    title: string;
  }>;
  decidedByUserId: string;
  decidedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAwardDecisionPayload {
  tenderId: string;
  selectedBidId: string;
  decisionStatus: AwardDecisionStatus;
  decisionReason: string;
  clarificationRequired?: boolean;
  clarificationText?: string;
  justificationText?: string;
  evidenceReferences?: Array<{
    type: string;
    referenceId: string;
    title: string;
  }>;
}

export interface DecisionReconstruction {
  decision: AwardDecision;
  tenderNumber: string;
  tenderTitle: string;
  selectedBidderName: string;
  selectedBidNumber: string;
  decidedByName: string;
  comparedBidders: BidComparisonItem[];
  justificationProvided: boolean;
  lessFavorableWarningTriggered: boolean;
  aiRecommendationSummary?: string;
  aiOverrideRecord?: AIOverrideRecord | null;
  auditTimeline: AuditEventListItem[];
}

// -------------------------------------------------------------------
// Audit & Governance & AI Overrides
// -------------------------------------------------------------------

export enum AuditEventType {
  VERIFICATION_RUN = 'VERIFICATION_RUN',
  DISCREPANCY_DETECTED = 'DISCREPANCY_DETECTED',
  INVESTIGATION_CREATED = 'INVESTIGATION_CREATED',
  INVESTIGATION_STATUS_CHANGED = 'INVESTIGATION_STATUS_CHANGED',
  INVESTIGATION_RESOLVED = 'INVESTIGATION_RESOLVED',
  AWARD_DECISION_CREATED = 'AWARD_DECISION_CREATED',
  AWARD_APPROVED = 'AWARD_APPROVED',
  AWARD_REJECTED = 'AWARD_REJECTED',
  AI_RECOMMENDATION_GENERATED = 'AI_RECOMMENDATION_GENERATED',
  AI_RECOMMENDATION_OVERRIDDEN = 'AI_RECOMMENDATION_OVERRIDDEN',
  GOVERNANCE_OVERRIDE = 'GOVERNANCE_OVERRIDE'
}

export interface AuditEvent {
  id: string;
  eventType: AuditEventType;
  entityType: string;
  entityId: string;
  tenderId?: string | null;
  bidId?: string | null;
  actorUserId: string;
  actorRole: UserRole;
  metadata: Record<string, unknown>;
  reason?: string | null;
  timestamp: string;
}

export interface AuditEventListItem {
  id: string;
  eventType: AuditEventType;
  entityType: string;
  entityId: string;
  tenderId?: string | null;
  tenderNumber?: string | null;
  bidId?: string | null;
  bidNumber?: string | null;
  actorUserId: string;
  actorName: string;
  actorRole: UserRole;
  description: string;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface AIOverrideRecord {
  id: string;
  tenderId: string;
  bidId: string;
  aiRecommendationText: string;
  aiRecommendationTimestamp: string;
  decisionTaken: string;
  overrideReason: string;
  supportingEvidenceRefs: string[];
  officerUserId: string;
  officerName: string;
  createdAt: string;
}

export interface CreateAIOverridePayload {
  tenderId: string;
  bidId: string;
  aiRecommendationText: string;
  aiRecommendationTimestamp: string;
  decisionTaken: string;
  overrideReason: string;
  supportingEvidenceRefs?: string[];
}


// -------------------------------------------------------------------
// Wave 3: AI Assistant, Notifications, Search, & Multilingual Support
// -------------------------------------------------------------------

export enum SupportedLanguage {
  EN = 'en',
  HI = 'hi',
  BN = 'bn',
  TE = 'te',
  MR = 'mr',
  TA = 'ta',
  GU = 'gu',
  KN = 'kn',
  ML = 'ml',
  OR = 'or',
  PA = 'pa',
  AS = 'as',
  UR = 'ur'
}

export interface LanguageOption {
  code: SupportedLanguage;
  label: string;
  nativeLabel: string;
}

export enum NotificationType {
  BID_SUBMITTED = 'BID_SUBMITTED',
  BID_WITHDRAWN = 'BID_WITHDRAWN',
  VERIFICATION_COMPLETED = 'VERIFICATION_COMPLETED',
  DISCREPANCY_DETECTED = 'DISCREPANCY_DETECTED',
  INVESTIGATION_ASSIGNED = 'INVESTIGATION_ASSIGNED',
  INVESTIGATION_ACTION_REQUIRED = 'INVESTIGATION_ACTION_REQUIRED',
  AWARD_DECISION_RECORDED = 'AWARD_DECISION_RECORDED',
  AWARD_PUBLISHED = 'AWARD_PUBLISHED',
  SOURCE_UNAVAILABLE = 'SOURCE_UNAVAILABLE',
  SYSTEM_ALERT = 'SYSTEM_ALERT'
}

export interface AppNotification {
  id: string;
  recipientUserId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  entityType: 'TENDER' | 'BID' | 'INVESTIGATION' | 'AWARD' | 'DOCUMENT';
  status?: string;
  url: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export interface GlobalSearchResponse {
  query: string;
  total: number;
  results: SearchResultItem[];
}

export interface AIAssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  evidenceGroundedRefs?: Array<{
    type: string;
    id: string;
    title: string;
    url?: string;
  }>;
  status?: 'SUCCESS' | 'AI_UNAVAILABLE' | 'ERROR';
}

export interface AIAssistantQueryPayload {
  prompt: string;
  tenderId?: string;
  bidId?: string;
  language?: SupportedLanguage;
}

export interface AIAssistantResponse {
  answer: string;
  status: 'SUCCESS' | 'AI_UNAVAILABLE' | 'INSUFFICIENT_EVIDENCE' | 'ERROR';
  groundedReferences: Array<{
    type: string;
    id: string;
    title: string;
    url?: string;
  }>;
  provider: string;
  model: string;
  language: SupportedLanguage;
  timestamp: string;
}

export interface TenderAISummary {
  tenderId: string;
  tenderNumber: string;
  title: string;
  purposeAndScope: string;
  keyEligibilityCriteria: string[];
  mandatoryRequirements: string[];
  importantDates: Array<{ label: string; date: string }>;
  requiredDocuments: string[];
  complianceAreas: string[];
  warningsAndConditions: string[];
  status: 'AVAILABLE' | 'AI_UNAVAILABLE';
  generatedAt: string;
}

export interface IntegrationSourceHealth {
  sourceId: string;
  sourceName: string;
  category: string;
  status: IntegrationStatus;
  canVerify: boolean;
  description: string;
  lastChecked?: string;
}
