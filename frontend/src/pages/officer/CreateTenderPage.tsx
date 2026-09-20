import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FilePlus, CheckCircle2, AlertCircle, Trash2, ArrowRight, ArrowLeft, BookOpen, Upload } from 'lucide-react';
import { RequirementCategory, RequirementType, CreateRequirementPayload } from '@e-pramaan/shared';
import { TendersApi } from '../../services/tenders';
import { useAuth } from '../../contexts/AuthContext';
import { REQUIREMENT_TEMPLATES, RequirementTemplatePreset } from '../../utils/requirementTemplates';

export const CreateTenderPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEditMode = Boolean(id);

  // Multi-step workflow state: 1: Basic Info, 2: Timeline, 3: Eligibility, 4: Requirements, 5: Review & Publish
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [tenderNumber, setTenderNumber] = useState(`GEM-${new Date().getFullYear()}-T-${Math.floor(1000 + Math.random() * 9000)}`);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tenderDocument, setTenderDocument] = useState<string>('CPCL_RFP_Technical_Specifications_v1.pdf');
  const [estimatedValue, setEstimatedValue] = useState<string>('');
  const [currency, setCurrency] = useState('INR');
  const [procuringOrgId] = useState(user?.organization?.id || '');

  // Timeline
  const defaultDeadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  const [submissionDeadline, setSubmissionDeadline] = useState(defaultDeadline);
  const [openingDate, setOpeningDate] = useState('');

  // Eligibility
  const [minimumCompanyAge, setMinimumCompanyAge] = useState<string>('3');

  // Requirements Builder
  const [requirements, setRequirements] = useState<CreateRequirementPayload[]>([
    REQUIREMENT_TEMPLATES[0].defaultPayload,
    REQUIREMENT_TEMPLATES[2].defaultPayload,
    REQUIREMENT_TEMPLATES[3].defaultPayload
  ]);

  // Load existing tender data if in edit mode
  useEffect(() => {
    if (!id) return;
    const fetchTender = async () => {
      try {
        const t = await TendersApi.getTenderById(id);
        setTenderNumber(t.tenderNumber);
        setTitle(t.title);
        setDescription(t.description || '');
        if (t.tenderDocument) setTenderDocument(t.tenderDocument);
        if (t.estimatedValue) setEstimatedValue(String(t.estimatedValue));
        if (t.currency) setCurrency(t.currency);
        if (t.submissionDeadline) setSubmissionDeadline(new Date(t.submissionDeadline).toISOString().slice(0, 16));
        if (t.openingDate) setOpeningDate(new Date(t.openingDate).toISOString().slice(0, 16));
        if (t.minimumCompanyAgeYears) setMinimumCompanyAge(String(t.minimumCompanyAgeYears));
        if (t.requirements && t.requirements.length > 0) {
          setRequirements(t.requirements.map(r => ({
            code: r.code,
            name: (r as any).title || r.name || '',
            description: r.description || '',
            category: r.category,
            requirementType: r.requirementType,
            isMandatory: r.isMandatory,
            isApplicable: r.isApplicable,
            weight: r.weight,
            configuration: r.configuration || {},
            evidenceTypes: r.evidenceTypes || ['DOCUMENT_UPLOAD'],
            verificationSources: r.verificationSources || []
          })));
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load existing tender details');
      }
    };
    fetchTender();
  }, [id]);

  // Drawer / Template selector modal state
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Custom requirement form state
  const [customReq, setCustomReq] = useState<CreateRequirementPayload>({
    code: '',
    name: '',
    description: '',
    category: RequirementCategory.TENDER_SPECIFIC,
    requirementType: RequirementType.DOCUMENT,
    isMandatory: true,
    isApplicable: true,
    weight: 10,
    configuration: {},
    evidenceTypes: [],
    verificationSources: []
  });

  const handleAddTemplate = (template: RequirementTemplatePreset) => {
    // Avoid duplicate codes
    if (requirements.some(r => r.code === template.defaultPayload.code)) {
      alert(`Requirement with code '${template.defaultPayload.code}' is already added.`);
      return;
    }
    setRequirements([...requirements, { ...template.defaultPayload }]);
    setShowTemplateModal(false);
  };

  const handleAddCustomRequirement = () => {
    if (!customReq.code || !customReq.name) {
      alert('Code and Name are required for custom requirements.');
      return;
    }
    if (requirements.some(r => r.code === customReq.code.toUpperCase())) {
      alert('Requirement code must be unique.');
      return;
    }
    setRequirements([
      ...requirements,
      {
        ...customReq,
        code: customReq.code.toUpperCase(),
        evidenceTypes: customReq.evidenceTypes?.length ? customReq.evidenceTypes : ['DOCUMENT_UPLOAD']
      }
    ]);
    setCustomReq({
      code: '',
      name: '',
      description: '',
      category: RequirementCategory.TENDER_SPECIFIC,
      requirementType: RequirementType.DOCUMENT,
      isMandatory: true,
      isApplicable: true,
      weight: 10,
      configuration: {},
      evidenceTypes: [],
      verificationSources: []
    });
  };

  const handleRemoveRequirement = (index: number) => {
    setRequirements(requirements.filter((_, idx) => idx !== index));
  };

  const handleUpdateRequirementWeight = (index: number, weight: number) => {
    const updated = [...requirements];
    updated[index].weight = weight;
    setRequirements(updated);
  };

  const handleToggleMandatory = (index: number) => {
    const updated = [...requirements];
    updated[index].isMandatory = !updated[index].isMandatory;
    setRequirements(updated);
  };

  const handleSaveDraftOrPublish = async (shouldPublish: boolean) => {
    setError(null);
    setIsSubmitting(true);

    try {
      if (!title) {
        throw new Error('Tender Title is required.');
      }
      if (!submissionDeadline) {
        throw new Error('Submission deadline is required.');
      }
      if (new Date(submissionDeadline) <= new Date()) {
        throw new Error('Submission deadline must be set to a future date.');
      }
      if (shouldPublish && requirements.length === 0) {
        throw new Error('At least one requirement is required to publish a tender.');
      }

      if (isEditMode && id) {
        // Update existing tender
        await TendersApi.updateTender(id, {
          title,
          description,
          tenderDocument: tenderDocument || undefined,
          submissionDeadline: new Date(submissionDeadline).toISOString(),
          openingDate: openingDate ? new Date(openingDate).toISOString() : undefined,
          estimatedValue: estimatedValue ? parseFloat(estimatedValue) : undefined,
          currency,
          minimumCompanyAgeYears: minimumCompanyAge ? parseInt(minimumCompanyAge, 10) : undefined
        });

        if (shouldPublish) {
          await TendersApi.publishTender(id);
        }

        navigate(`/officer/tenders/${id}`);
        return;
      }

      // 1. Create tender in DRAFT
      const tender = await TendersApi.createTender({
        tenderNumber,
        title,
        description,
        tenderDocument: tenderDocument || undefined,
        procuringOrganizationId: procuringOrgId || undefined,
        submissionDeadline: new Date(submissionDeadline).toISOString(),
        openingDate: openingDate ? new Date(openingDate).toISOString() : undefined,
        estimatedValue: estimatedValue ? parseFloat(estimatedValue) : undefined,
        currency,
        minimumCompanyAgeYears: minimumCompanyAge ? parseInt(minimumCompanyAge, 10) : undefined
      });

      // 2. Add requirements
      for (const req of requirements) {
        await TendersApi.addRequirement(tender.id, req);
      }

      // 3. Publish if requested
      if (shouldPublish) {
        await TendersApi.publishTender(tender.id);
      }

      navigate(`/officer/tenders/${tender.id}`);
    } catch (err: any) {
      setError(err.message || 'Operation failed. Check tender data.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { num: 1, label: 'Basic Info' },
    { num: 2, label: 'Timeline' },
    { num: 3, label: 'Eligibility' },
    { num: 4, label: 'Requirements' },
    { num: 5, label: 'Review & Publish' }
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-gov-navyLight/10 text-gov-navy rounded-lg">
            <FilePlus className="w-6 h-6 text-gov-navy" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {isEditMode ? 'Edit Draft Procurement Tender' : 'Create Procurement Tender'}
            </h1>
            <p className="text-xs text-slate-500">
              {isEditMode
                ? 'Modify official tender draft scope, timeline and statutory rules before publishing'
                : 'Formulate official government procurement scope, timeline and structured rules'}
            </p>
          </div>
        </div>
        <div className="mt-3 sm:mt-0 flex space-x-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSaveDraftOrPublish(false)}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 shadow-sm cursor-pointer"
          >
            {isEditMode ? 'Update Draft' : 'Save as Draft'}
          </button>
        </div>
      </div>

      {/* Progress Step Bar */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
        <div className="grid grid-cols-5 gap-2">
          {steps.map((s) => (
            <button
              key={s.num}
              type="button"
              onClick={() => setCurrentStep(s.num)}
              className={`p-2 text-left rounded-md border text-xs transition ${
                currentStep === s.num
                  ? 'border-gov-navy bg-slate-50 font-bold text-gov-navy shadow-xs'
                  : currentStep > s.num
                  ? 'border-emerald-200 bg-emerald-50/50 text-emerald-800'
                  : 'border-slate-200 text-slate-500'
              }`}
            >
              <div className="text-[10px] uppercase tracking-wider text-slate-400">Step {s.num}</div>
              <div className="truncate">{s.label}</div>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-md flex items-start space-x-2 text-xs text-rose-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Step 1: Basic Information */}
      {currentStep === 1 && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
            1. Tender Identification & Value
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="tenderNo">
                Tender Number / Reference ID *
              </label>
              <input
                id="tenderNo"
                type="text"
                required
                value={tenderNumber}
                onChange={(e) => setTenderNumber(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gov-navy"
              />
              <p className="text-[10px] text-slate-400 mt-1">Unique institutional identifier for national gazette / GeM portal.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="procuringOrg">
                Procuring Authority / Ministry
              </label>
              <input
                id="procuringOrg"
                type="text"
                disabled
                value={user?.organization?.legalName || 'Ministry of Finance / Autonomous Board'}
                className="w-full px-3 py-2 text-xs bg-slate-100 text-slate-600 border border-slate-300 rounded-md cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="title">
              Tender Title / Work Scope Description *
            </label>
            <input
              id="title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Supply and Installation of High-Precision Hardware Instrumentation"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gov-navy"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="description">
              Detailed Scope of Work & Institutional Context
            </label>
            <textarea
              id="description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide technical specifications, delivery terms, and background..."
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gov-navy"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="tenderDoc">
              Official Tender Document / RFP Specifications (PDF)
            </label>
            <div className="flex items-center space-x-3">
              <div className="relative flex-1">
                <input
                  id="tenderDoc"
                  type="text"
                  value={tenderDocument}
                  onChange={(e) => setTenderDocument(e.target.value)}
                  placeholder="e.g. CPCL_RFP_Technical_Specifications.pdf"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gov-navy font-mono"
                />
              </div>
              <label className="inline-flex items-center px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-xs font-semibold text-slate-700 cursor-pointer transition shadow-2xs">
                <Upload className="w-3.5 h-3.5 mr-1 text-gov-navy" />
                <span>Upload PDF</span>
                <input
                  type="file"
                  accept=".pdf,.docx,.zip"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setTenderDocument(file.name);
                    }
                  }}
                />
              </label>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Upload the complete Gazette / GeM tender document or RFP specifications made available for bidder download.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="estValue">
                Estimated Project Value
              </label>
              <input
                id="estValue"
                type="number"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(e.target.value)}
                placeholder="e.g. 15000000"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gov-navy"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="currency">
                Currency
              </label>
              <select
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gov-navy"
              >
                <option value="INR">INR (Indian Rupee - ₹)</option>
                <option value="USD">USD (US Dollar - $)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-gov-navy hover:bg-gov-navyLight rounded-md"
            >
              Continue to Timeline <ArrowRight className="w-4 h-4 ml-1.5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Timeline */}
      {currentStep === 2 && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
            2. Procurement Timeline & Deadlines
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="subDeadline">
                Submission Deadline *
              </label>
              <input
                id="subDeadline"
                type="datetime-local"
                required
                value={submissionDeadline}
                onChange={(e) => setSubmissionDeadline(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gov-navy"
              />
              <p className="text-[10px] text-slate-400 mt-1">Bids received after this timestamp are cryptographically locked out.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="openDate">
                Technical Bid Opening Date
              </label>
              <input
                id="openDate"
                type="datetime-local"
                value={openingDate}
                onChange={(e) => setOpeningDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gov-navy"
              />
              <p className="text-[10px] text-slate-400 mt-1">Scheduled automated decryption & committee evaluation opening.</p>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="inline-flex items-center px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-gov-navy hover:bg-gov-navyLight rounded-md"
            >
              Continue to Eligibility <ArrowRight className="w-4 h-4 ml-1.5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Eligibility Rules */}
      {currentStep === 3 && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
            3. Vendor Qualifications & Operational Eligibility
          </h2>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="minAge">
              Minimum Operating Vintage (Years from Incorporation)
            </label>
            <input
              id="minAge"
              type="number"
              min="0"
              value={minimumCompanyAge}
              onChange={(e) => setMinimumCompanyAge(e.target.value)}
              className="w-full max-w-xs px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gov-navy"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Used in automated verification against Ministry of Corporate Affairs (MCA21) registry.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-600 space-y-1">
            <div className="font-semibold text-slate-800">Automated Statutory Pre-Filter Rule:</div>
            <div>• Entities incorporated fewer than {minimumCompanyAge || 0} years ago will be flagged or require explicit startup exemption.</div>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="inline-flex items-center px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-gov-navy hover:bg-gov-navyLight rounded-md"
            >
              Configure Requirements <ArrowRight className="w-4 h-4 ml-1.5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Structured Compliance Requirements Builder */}
      {currentStep === 4 && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  4. Structured Compliance Requirements ({requirements.length})
                </h2>
                <p className="text-xs text-slate-500">Configure verifiable statutory, tax, MSME and technical rules</p>
              </div>
              <div className="mt-2 sm:mt-0 flex space-x-2">
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(true)}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-gov-navy bg-gov-navyLight/10 hover:bg-gov-navyLight/20 rounded-md"
                >
                  <BookOpen className="w-4 h-4 mr-1.5" />
                  Select Standard Template
                </button>
              </div>
            </div>

            {/* List of active requirements */}
            <div className="space-y-3">
              {requirements.map((req, idx) => (
                <div
                  key={req.code}
                  className="p-4 rounded-md border border-slate-200 bg-slate-50/50 hover:bg-white transition flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-gov-navy px-1.5 py-0.5 bg-slate-200 rounded">
                        {req.code}
                      </span>
                      <span className="text-xs font-bold text-slate-900">{req.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${
                        req.isMandatory ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {req.isMandatory ? 'Mandatory' : 'Optional'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{req.description}</p>
                    <div className="flex flex-wrap gap-2 text-[10px] text-slate-500 pt-1">
                      <span className="font-semibold">Category:</span> {req.category} |
                      <span className="font-semibold">Type:</span> {req.requirementType} |
                      <span className="font-semibold">Sources:</span> {req.verificationSources?.join(', ') || 'Self Attestation'}
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="flex flex-col">
                      <label className="text-[10px] text-slate-400 font-semibold uppercase">Weight (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={req.weight}
                        onChange={(e) => handleUpdateRequirementWeight(idx, parseFloat(e.target.value) || 0)}
                        className="w-16 px-2 py-1 text-xs border border-slate-300 rounded text-center bg-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleMandatory(idx)}
                      className="px-2 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100"
                    >
                      Toggle {req.isMandatory ? 'Optional' : 'Mandatory'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveRequirement(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition"
                      title="Remove requirement"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Custom requirement builder accordion */}
            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Add Custom Institutional Requirement
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Code (e.g. REQ_ISO_9001)"
                  value={customReq.code}
                  onChange={(e) => setCustomReq({ ...customReq, code: e.target.value })}
                  className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded"
                />
                <input
                  type="text"
                  placeholder="Requirement Title"
                  value={customReq.name}
                  onChange={(e) => setCustomReq({ ...customReq, name: e.target.value })}
                  className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded sm:col-span-2"
                />
                <select
                  value={customReq.category}
                  onChange={(e) => setCustomReq({ ...customReq, category: e.target.value as RequirementCategory })}
                  className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded"
                >
                  {Object.values(RequirementCategory).map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <select
                  value={customReq.requirementType}
                  onChange={(e) => setCustomReq({ ...customReq, requirementType: e.target.value as RequirementType })}
                  className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded"
                >
                  {Object.values(RequirementType).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddCustomRequirement}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded"
                >
                  Add Requirement
                </button>
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="inline-flex items-center px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md"
              >
                <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(5)}
                className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-gov-navy hover:bg-gov-navyLight rounded-md"
              >
                Review & Verification Summary <ArrowRight className="w-4 h-4 ml-1.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Review & Publish */}
      {currentStep === 5 && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-6">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-gov-goldLight text-gov-goldDark">
              Verification Pre-Publish Check
            </span>
            <h2 className="text-base font-bold text-slate-900 mt-1">Review Tender Scope and Criteria Before Publishing</h2>
            <p className="text-xs text-slate-500">
              Once published, requirements and deadlines cannot be altered without a formal corrigendum notice.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500">Tender Reference:</span>
              <div className="font-mono font-bold text-slate-900">{tenderNumber}</div>
            </div>
            <div>
              <span className="text-slate-500">Title:</span>
              <div className="font-semibold text-slate-900">{title || '(Not set)'}</div>
            </div>
            <div>
              <span className="text-slate-500">Submission Deadline:</span>
              <div className="font-semibold text-slate-900">{new Date(submissionDeadline).toLocaleString()}</div>
            </div>
            <div>
              <span className="text-slate-500">Estimated Value:</span>
              <div className="font-semibold text-slate-900">
                {estimatedValue ? `${currency} ${Number(estimatedValue).toLocaleString()}` : 'Unspecified'}
              </div>
            </div>
            <div>
              <span className="text-slate-500">Total Configured Requirements:</span>
              <div className="font-bold text-gov-navy">{requirements.length}</div>
            </div>
            <div>
              <span className="text-slate-500">Mandatory Criteria:</span>
              <div className="font-bold text-rose-600">
                {requirements.filter(r => r.isMandatory).length}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Configured Requirement Checklist</h3>
            <div className="border border-slate-200 rounded-md divide-y divide-slate-200 text-xs">
              {requirements.map((r) => (
                <div key={r.code} className="p-3 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="font-mono font-bold text-slate-700">{r.code}</span>
                    <span className="text-slate-900">{r.name}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    r.isMandatory ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {r.isMandatory ? 'Mandatory' : 'Optional'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              className="inline-flex items-center px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Edit
            </button>

            <div className="flex space-x-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSaveDraftOrPublish(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Save as Draft Only
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSaveDraftOrPublish(true)}
                className="inline-flex items-center px-5 py-2 text-xs font-bold tracking-wide uppercase text-white bg-gov-navy hover:bg-gov-navyLight rounded-md shadow-sm"
              >
                {isSubmitting ? 'Publishing...' : 'Publish Tender Official Notice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Requirement Template Selection Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 max-w-2xl w-full p-6 shadow-xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Standard Statutory & Compliance Templates
                </h3>
                <p className="text-xs text-slate-500">Pick pre-structured rules aligned with Indian Government public procurement manuals</p>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className="text-xs text-slate-400 hover:text-slate-700"
              >
                ✕ Close
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {REQUIREMENT_TEMPLATES.map((tmpl) => {
                const isAdded = requirements.some(r => r.code === tmpl.defaultPayload.code);
                return (
                  <div
                    key={tmpl.id}
                    className={`p-3.5 rounded-md border text-xs flex flex-col justify-between ${
                      isAdded ? 'border-emerald-200 bg-emerald-50/40 opacity-70' : 'border-slate-200 hover:border-gov-navy hover:bg-slate-50/50'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-slate-900">{tmpl.name}</div>
                      <div className="font-mono text-[10px] text-slate-400 mt-0.5">{tmpl.defaultPayload.code}</div>
                      <p className="text-[11px] text-slate-500 mt-1">{tmpl.description}</p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] uppercase font-semibold text-slate-400">{tmpl.category}</span>
                      <button
                        type="button"
                        disabled={isAdded}
                        onClick={() => handleAddTemplate(tmpl)}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded ${
                          isAdded
                            ? 'text-emerald-700 bg-emerald-100 cursor-not-allowed'
                            : 'text-white bg-gov-navy hover:bg-gov-navyLight'
                        }`}
                      >
                        {isAdded ? 'Added' : '+ Add to Tender'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
