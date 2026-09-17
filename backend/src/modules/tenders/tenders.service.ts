import {
  Tender,
  TenderDetail,
  TenderListItem,
  TenderRequirement,
  TenderStatus,
  TenderLifecycleAction,
  CreateTenderPayload,
  UpdateTenderPayload,
  CreateRequirementPayload,
  UpdateRequirementPayload,
  PaginatedResponse,
  UserProfile,
  UserRole
} from '@e-pramaan/shared';
import { getSupabaseAdminClient } from '../../config/supabase.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { config } from '../../config/env.js';

export class TendersService {
  /**
   * Create a tender in DRAFT status.
   * Procuring organization is derived from the user's organization or verified if provided.
   */
  static async createTender(user: UserProfile, payload: CreateTenderPayload): Promise<Tender> {
    if (!config.hasSupabaseConfigured()) {
      throw new AppError('Database unconfigured', 503, 'DATABASE_UNCONFIGURED');
    }

    const admin = getSupabaseAdminClient();

    // Verify procuring organization
    const procuringOrgId = payload.procuringOrganizationId || user.organization?.id;
    if (!procuringOrgId && user.role !== UserRole.ADMIN) {
      throw new AppError(
        'Procurement Officer must belong to a registered Procuring Organization to create tenders.',
        400,
        'ORGANIZATION_REQUIRED'
      );
    }

    // Check tender number uniqueness
    const { data: existing } = await admin
      .from('tenders')
      .select('id')
      .eq('tender_number', payload.tenderNumber)
      .maybeSingle();

    if (existing) {
      throw new AppError(
        `Tender number '${payload.tenderNumber}' is already registered.`,
        409,
        'DUPLICATE_TENDER_NUMBER'
      );
    }

    let finalDescription = payload.description || '';
    if (payload.tenderDocument) {
      finalDescription = `${finalDescription}\n<!-- metadata: ${JSON.stringify({ tenderDocument: payload.tenderDocument })} -->`.trim();
    }

    const insertData = {
      tender_number: payload.tenderNumber,
      title: payload.title,
      description: finalDescription || null,
      procuring_organization_id: procuringOrgId || null,
      created_by: user.id,
      publication_date: payload.publicationDate || null,
      submission_deadline: payload.submissionDeadline,
      opening_date: payload.openingDate || null,
      status: TenderStatus.DRAFT,
      estimated_value: payload.estimatedValue ?? null,
      currency: payload.currency || 'INR',
      minimum_company_age_years: payload.minimumCompanyAgeYears ?? null
    };

    const { data: tender, error } = await admin
      .from('tenders')
      .insert(insertData)
      .select()
      .single();

    if (error || !tender) {
      throw new AppError('Failed to create tender record in database', 500, 'DB_ERROR', error);
    }

    return this.mapTender(tender);
  }

  /**
   * List tenders with pagination, filtering, and role scoping.
   */
  static async listTenders(
    user: UserProfile,
    query: {
      page: number;
      pageSize: number;
      search?: string;
      status?: TenderStatus;
      sortBy: string;
      sortOrder: 'asc' | 'desc';
    }
  ): Promise<PaginatedResponse<TenderListItem>> {
    if (!config.hasSupabaseConfigured()) {
      return {
        items: [],
        page: query.page,
        pageSize: query.pageSize,
        total: 0,
        totalPages: 0
      };
    }

    const admin = getSupabaseAdminClient();
    const { page, pageSize, search, status, sortBy, sortOrder } = query;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let dbQuery = admin
      .from('tenders')
      .select(`
        id,
        tender_number,
        title,
        status,
        submission_deadline,
        estimated_value,
        currency,
        created_at,
        procuring_organization:organizations (
          id,
          legal_name
        ),
        tender_requirements (
          id,
          is_mandatory
        )
      `, { count: 'exact' });

    // Role-based visibility scoping:
    if (user.role === UserRole.BIDDER) {
      dbQuery = dbQuery.in('status', [
        TenderStatus.PUBLISHED,
        TenderStatus.CLOSED,
        TenderStatus.UNDER_EVALUATION,
        TenderStatus.AWARDED
      ]);
    } else if (user.role === UserRole.OFFICER) {
      if (user.organization?.id) {
        dbQuery = dbQuery.or(`status.neq.DRAFT,procuring_organization_id.eq.${user.organization.id},created_by.eq.${user.id}`);
      } else {
        dbQuery = dbQuery.or(`status.neq.DRAFT,created_by.eq.${user.id}`);
      }
    }

    if (status) {
      dbQuery = dbQuery.eq('status', status);
    }

    if (search) {
      dbQuery = dbQuery.or(`tender_number.ilike.%${search}%,title.ilike.%${search}%`);
    }

    dbQuery = dbQuery.order(sortBy, { ascending: sortOrder === 'asc' }).range(from, to);

    const { data, error, count } = await dbQuery;

    if (error) {
      throw new AppError('Failed to query tenders list', 500, 'DB_ERROR', error);
    }

    const total = count || 0;
    const items: TenderListItem[] = (data || []).map((row: any) => {
      const org = Array.isArray(row.procuring_organization) ? row.procuring_organization[0] : row.procuring_organization;
      const reqs: any[] = row.tender_requirements || [];
      const mandatoryCount = reqs.filter(r => r.is_mandatory).length;

      return {
        id: row.id,
        tenderNumber: row.tender_number,
        title: row.title,
        status: row.status as TenderStatus,
        submissionDeadline: row.submission_deadline,
        estimatedValue: row.estimated_value,
        currency: row.currency,
        procuringOrganization: org ? { id: org.id, legalName: org.legal_name } : null,
        requirementCount: reqs.length,
        mandatoryRequirementCount: mandatoryCount,
        createdAt: row.created_at
      };
    });

    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  /**
   * Get tender details with requirements.
   */
  static async getTenderById(user: UserProfile, id: string): Promise<TenderDetail> {
    if (!config.hasSupabaseConfigured()) {
      throw new AppError('Database unconfigured', 503, 'DATABASE_UNCONFIGURED');
    }

    const admin = getSupabaseAdminClient();

    const { data: tender, error } = await admin
      .from('tenders')
      .select(`
        *,
        procuring_organization:organizations (
          id,
          legal_name,
          organization_type,
          identifier
        ),
        creator:users (
          id,
          full_name,
          email
        ),
        tender_requirements (
          *
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error || !tender) {
      throw new AppError('Tender not found', 404, 'TENDER_NOT_FOUND');
    }

    // Enforce authorization for DRAFT tenders
    if (tender.status === TenderStatus.DRAFT) {
      const isCreator = tender.created_by === user.id;
      const isOrgMember = user.organization?.id && tender.procuring_organization_id === user.organization.id;
      const isAdminOrAuditor = user.role === UserRole.ADMIN || user.role === UserRole.AUDITOR;

      if (!isCreator && !isOrgMember && !isAdminOrAuditor) {
        throw new AppError('You are not authorized to access this draft tender.', 403, 'FORBIDDEN');
      }
    }

    return this.mapTenderDetail(tender);
  }

  /**
   * Update tender details while in DRAFT status.
   */
  static async updateTender(user: UserProfile, id: string, payload: UpdateTenderPayload): Promise<TenderDetail> {
    const tender = await this.getTenderById(user, id);

    if (tender.status !== TenderStatus.DRAFT) {
      throw new AppError(
        `Tender cannot be modified in '${tender.status}' status. Only DRAFT tenders can be modified.`,
        400,
        'TENDER_NOT_EDITABLE'
      );
    }

    const isCreator = tender.createdBy === user.id;
    const isOrgMember = user.organization?.id && tender.procuringOrganizationId === user.organization.id;
    const isAdmin = user.role === UserRole.ADMIN;

    if (!isCreator && !isOrgMember && !isAdmin) {
      throw new AppError('You are not authorized to modify this tender.', 403, 'FORBIDDEN');
    }

    const admin = getSupabaseAdminClient();
    const updateData: Record<string, unknown> = {};

    if (payload.title !== undefined) updateData.title = payload.title;
    if (payload.description !== undefined || payload.tenderDocument !== undefined) {
      let desc = payload.description !== undefined ? payload.description : tender.description || '';
      const docPath = payload.tenderDocument !== undefined ? payload.tenderDocument : tender.tenderDocument;
      if (docPath) {
        desc = `${desc}\n<!-- metadata: ${JSON.stringify({ tenderDocument: docPath })} -->`.trim();
      }
      updateData.description = desc || null;
    }
    if (payload.submissionDeadline !== undefined) updateData.submission_deadline = payload.submissionDeadline;
    if (payload.openingDate !== undefined) updateData.opening_date = payload.openingDate;
    if (payload.estimatedValue !== undefined) updateData.estimated_value = payload.estimatedValue;
    if (payload.currency !== undefined) updateData.currency = payload.currency;
    if (payload.minimumCompanyAgeYears !== undefined) updateData.minimum_company_age_years = payload.minimumCompanyAgeYears;

    const { error } = await admin
      .from('tenders')
      .update(updateData)
      .eq('id', id);

    if (error) {
      throw new AppError('Failed to update tender in database', 500, 'DB_ERROR', error);
    }

    return this.getTenderById(user, id);
  }

  /**
   * Add structured requirement to a tender while in DRAFT status.
   */
  static async addRequirement(
    user: UserProfile,
    tenderId: string,
    payload: CreateRequirementPayload
  ): Promise<TenderRequirement> {
    const tender = await this.getTenderById(user, tenderId);

    if (tender.status !== TenderStatus.DRAFT) {
      throw new AppError(
        'Requirements can only be added to tenders in DRAFT status.',
        400,
        'TENDER_NOT_EDITABLE'
      );
    }

    const admin = getSupabaseAdminClient();

    // Check code uniqueness within tender
    const { data: existing } = await admin
      .from('tender_requirements')
      .select('id')
      .eq('tender_id', tenderId)
      .eq('code', payload.code.toUpperCase())
      .maybeSingle();

    if (existing) {
      throw new AppError(
        `Requirement with code '${payload.code}' already exists in this tender.`,
        409,
        'DUPLICATE_REQUIREMENT_CODE'
      );
    }

    const insertData = {
      tender_id: tenderId,
      code: payload.code.toUpperCase(),
      name: payload.name,
      description: payload.description || null,
      category: payload.category,
      requirement_type: payload.requirementType,
      is_mandatory: payload.isMandatory ?? true,
      is_applicable: payload.isApplicable ?? true,
      weight: payload.weight ?? 0,
      minimum_threshold: payload.minimumThreshold ?? null,
      configuration: payload.configuration || {},
      evidence_types: payload.evidenceTypes || [],
      verification_sources: payload.verificationSources || []
    };

    const { data: req, error } = await admin
      .from('tender_requirements')
      .insert(insertData)
      .select()
      .single();

    if (error || !req) {
      throw new AppError('Failed to add requirement to tender', 500, 'DB_ERROR', error);
    }

    return this.mapRequirement(req);
  }

  /**
   * Update requirement while tender is in DRAFT status.
   */
  static async updateRequirement(
    user: UserProfile,
    tenderId: string,
    requirementId: string,
    payload: UpdateRequirementPayload
  ): Promise<TenderRequirement> {
    const tender = await this.getTenderById(user, tenderId);

    if (tender.status !== TenderStatus.DRAFT) {
      throw new AppError(
        'Requirements can only be updated on tenders in DRAFT status.',
        400,
        'TENDER_NOT_EDITABLE'
      );
    }

    const admin = getSupabaseAdminClient();
    const updateData: Record<string, unknown> = {};

    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.description !== undefined) updateData.description = payload.description;
    if (payload.category !== undefined) updateData.category = payload.category;
    if (payload.requirementType !== undefined) updateData.requirement_type = payload.requirementType;
    if (payload.isMandatory !== undefined) updateData.is_mandatory = payload.isMandatory;
    if (payload.isApplicable !== undefined) updateData.is_applicable = payload.isApplicable;
    if (payload.weight !== undefined) updateData.weight = payload.weight;
    if (payload.minimumThreshold !== undefined) updateData.minimum_threshold = payload.minimumThreshold;
    if (payload.configuration !== undefined) updateData.configuration = payload.configuration;
    if (payload.evidenceTypes !== undefined) updateData.evidence_types = payload.evidenceTypes;
    if (payload.verificationSources !== undefined) updateData.verification_sources = payload.verificationSources;

    const { data: updated, error } = await admin
      .from('tender_requirements')
      .update(updateData)
      .eq('id', requirementId)
      .eq('tender_id', tenderId)
      .select()
      .maybeSingle();

    if (error || !updated) {
      throw new AppError('Requirement not found or update failed', 404, 'REQUIREMENT_NOT_FOUND', error);
    }

    return this.mapRequirement(updated);
  }

  /**
   * Delete requirement while tender is in DRAFT status.
   */
  static async deleteRequirement(
    user: UserProfile,
    tenderId: string,
    requirementId: string
  ): Promise<void> {
    const tender = await this.getTenderById(user, tenderId);

    if (tender.status !== TenderStatus.DRAFT) {
      throw new AppError(
        'Requirements can only be deleted from tenders in DRAFT status.',
        400,
        'TENDER_NOT_EDITABLE'
      );
    }

    const admin = getSupabaseAdminClient();
    const { error, count } = await admin
      .from('tender_requirements')
      .delete({ count: 'exact' })
      .eq('id', requirementId)
      .eq('tender_id', tenderId);

    if (error || count === 0) {
      throw new AppError('Requirement not found', 404, 'REQUIREMENT_NOT_FOUND', error);
    }
  }

  /**
   * Explicit tender publishing with thorough validation.
   */
  static async publishTender(user: UserProfile, tenderId: string): Promise<TenderDetail> {
    const tender = await this.getTenderById(user, tenderId);

    if (tender.status !== TenderStatus.DRAFT) {
      throw new AppError(
        `Only DRAFT tenders can be published. Current status is '${tender.status}'.`,
        409,
        'INVALID_TENDER_TRANSITION'
      );
    }

    // 1. Validate submission deadline is in the future
    if (new Date(tender.submissionDeadline) <= new Date()) {
      throw new AppError(
        'Submission deadline must be in the future to publish tender.',
        400,
        'INVALID_SUBMISSION_DEADLINE'
      );
    }

    // 2. Validate mandatory fields
    if (!tender.tenderNumber || !tender.title) {
      throw new AppError('Tender number and title are required to publish.', 400, 'INCOMPLETE_TENDER_DATA');
    }

    // 3. Validate at least one requirement exists
    if (!tender.requirements || tender.requirements.length === 0) {
      throw new AppError(
        'Cannot publish tender without at least one compliance requirement defined.',
        400,
        'TENDER_REQUIREMENTS_REQUIRED'
      );
    }

    // 4. Validate requirements completeness
    for (const req of tender.requirements) {
      if (!req.code || !req.name) {
        throw new AppError(
          `Requirement '${req.id}' is missing a valid code or name.`,
          400,
          'INVALID_REQUIREMENT_DEFINITION'
        );
      }
    }

    const admin = getSupabaseAdminClient();
    const { error } = await admin
      .from('tenders')
      .update({
        status: TenderStatus.PUBLISHED,
        publication_date: new Date().toISOString()
      })
      .eq('id', tenderId);

    if (error) {
      throw new AppError('Failed to publish tender', 500, 'DB_ERROR', error);
    }

    return this.getTenderById(user, tenderId);
  }

  /**
   * Execute allowed lifecycle state transitions.
   */
  static async transitionLifecycle(
    user: UserProfile,
    tenderId: string,
    action: TenderLifecycleAction
  ): Promise<TenderDetail> {
    if (action === TenderLifecycleAction.PUBLISH) {
      return this.publishTender(user, tenderId);
    }

    const tender = await this.getTenderById(user, tenderId);
    let nextStatus: TenderStatus;

    switch (action) {
      case TenderLifecycleAction.CLOSE:
        if (tender.status !== TenderStatus.PUBLISHED) {
          throw new AppError(
            `Cannot CLOSE tender from status '${tender.status}'. Allowed from: PUBLISHED.`,
            409,
            'INVALID_TENDER_TRANSITION'
          );
        }
        nextStatus = TenderStatus.CLOSED;
        break;

      case TenderLifecycleAction.START_EVALUATION:
        if (tender.status !== TenderStatus.CLOSED) {
          throw new AppError(
            `Cannot START_EVALUATION from status '${tender.status}'. Allowed from: CLOSED.`,
            409,
            'INVALID_TENDER_TRANSITION'
          );
        }
        nextStatus = TenderStatus.UNDER_EVALUATION;
        break;

      case TenderLifecycleAction.AWARD:
        if (tender.status !== TenderStatus.UNDER_EVALUATION) {
          throw new AppError(
            `Cannot AWARD tender from status '${tender.status}'. Allowed from: UNDER_EVALUATION.`,
            409,
            'INVALID_TENDER_TRANSITION'
          );
        }
        nextStatus = TenderStatus.AWARDED;
        break;

      case TenderLifecycleAction.CANCEL:
        if ([TenderStatus.AWARDED, TenderStatus.CANCELLED].includes(tender.status)) {
          throw new AppError(
            `Cannot CANCEL tender already in '${tender.status}' status.`,
            409,
            'INVALID_TENDER_TRANSITION'
          );
        }
        nextStatus = TenderStatus.CANCELLED;
        break;

      default:
        throw new AppError(`Unsupported lifecycle action: ${action}`, 400, 'INVALID_ACTION');
    }

    const admin = getSupabaseAdminClient();
    const { error } = await admin
      .from('tenders')
      .update({ status: nextStatus })
      .eq('id', tenderId);

    if (error) {
      throw new AppError(`Failed to transition tender to ${nextStatus}`, 500, 'DB_ERROR', error);
    }

    return this.getTenderById(user, tenderId);
  }

  // --- Entity Mappers ---

  private static mapTender(row: any): Tender {
    let tenderDocument: string | null = null;
    let cleanDescription = row.description;
    if (row.description) {
      const match = row.description.match(/<!--\s*metadata:\s*(\{"tenderDocument":\s*"[^"]+"\})\s*-->/);
      if (match && match[1]) {
        try {
          const parsed = JSON.parse(match[1]);
          tenderDocument = parsed.tenderDocument || null;
          cleanDescription = row.description.replace(match[0], '').trim();
        } catch {
          // ignore
        }
      }
    }

    return {
      id: row.id,
      tenderNumber: row.tender_number,
      title: row.title,
      description: cleanDescription,
      tenderDocument,
      procuringOrganizationId: row.procuring_organization_id,
      createdBy: row.created_by,
      publicationDate: row.publication_date,
      submissionDeadline: row.submission_deadline,
      openingDate: row.opening_date,
      status: row.status as TenderStatus,
      estimatedValue: row.estimated_value ? Number(row.estimated_value) : null,
      currency: row.currency,
      minimumCompanyAgeYears: row.minimum_company_age_years,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private static mapRequirement(row: any): TenderRequirement {
    return {
      id: row.id,
      tenderId: row.tender_id,
      code: row.code,
      name: row.name,
      description: row.description,
      category: row.category,
      requirementType: row.requirement_type,
      isMandatory: row.is_mandatory,
      isApplicable: row.is_applicable,
      weight: Number(row.weight || 0),
      minimumThreshold: row.minimum_threshold ? Number(row.minimum_threshold) : null,
      configuration: row.configuration || {},
      evidenceTypes: row.evidence_types || [],
      verificationSources: row.verification_sources || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private static mapTenderDetail(row: any): TenderDetail {
    const org = Array.isArray(row.procuring_organization) ? row.procuring_organization[0] : row.procuring_organization;
    const creator = Array.isArray(row.creator) ? row.creator[0] : row.creator;
    const rawReqs: any[] = row.tender_requirements || [];

    return {
      ...this.mapTender(row),
      procuringOrganization: org ? {
        id: org.id,
        legalName: org.legal_name,
        organizationType: org.organization_type,
        identifier: org.identifier
      } : null,
      creator: creator ? {
        id: creator.id,
        fullName: creator.full_name,
        email: creator.email
      } : null,
      requirements: rawReqs.map(r => this.mapRequirement(r))
    };
  }
}
