import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  Bid,
  BidDetail,
  BidListItem,
  BidDocument,
  BidStatus,
  CreateBidPayload,
  AttachDocumentPayload,
  SubmitBidPayload,
  PaginatedResponse,
  UserProfile,
  UserRole,
  VerificationStatus,
  TenderStatus,
  RequirementCategory
} from '@e-pramaan/shared';
import { getSupabaseAdminClient } from '../../config/supabase.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { config } from '../../config/env.js';
import { DocumentIntelligenceService } from '../compliance/documentIntelligence.js';
import { BidQuery } from './bids.validation.js';

export class BidsService {
  /**
   * Create a new draft bid application for a published tender.
   * Enforces:
   * 1. User belongs to a bidder organization
   * 2. Tender exists and is PUBLISHED
   * 3. Tender submission deadline is in the future
   * 4. Organization does not already have an active bid for this tender
   */
  static async createDraftBid(user: UserProfile, payload: CreateBidPayload): Promise<BidDetail> {
    if (!config.hasSupabaseConfigured()) {
      throw new AppError('Database unconfigured', 503, 'DATABASE_UNCONFIGURED');
    }

    const orgId = user.organization?.id;
    if (!orgId) {
      throw new AppError('Bidder must belong to a registered organization to apply for tenders.', 400, 'ORGANIZATION_REQUIRED');
    }

    const admin = getSupabaseAdminClient();

    // 1. Fetch tender details
    const { data: tender, error: tenderErr } = await admin
      .from('tenders')
      .select('id, tender_number, status, submission_deadline, title')
      .eq('id', payload.tenderId)
      .maybeSingle();

    if (tenderErr || !tender) {
      throw new AppError('Tender not found.', 404, 'TENDER_NOT_FOUND');
    }

    if (tender.status !== TenderStatus.PUBLISHED) {
      throw new AppError(
        `Cannot apply for tender in status '${tender.status}'. Only PUBLISHED tenders accept applications.`,
        400,
        'TENDER_NOT_OPEN'
      );
    }

    if (new Date(tender.submission_deadline) <= new Date()) {
      throw new AppError(
        'Submission deadline for this tender has passed.',
        400,
        'DEADLINE_EXPIRED'
      );
    }

    // 2. Check for existing active bid for this organization
    const { data: existingBid } = await admin
      .from('bids')
      .select('id, bid_number, status')
      .eq('tender_id', payload.tenderId)
      .eq('bidder_organization_id', orgId)
      .neq('status', BidStatus.WITHDRAWN)
      .maybeSingle();

    if (existingBid) {
      throw new AppError(
        `Your organization already has an active application (${existingBid.bid_number}) in status '${existingBid.status}'.`,
        409,
        'DUPLICATE_BID'
      );
    }

    // 3. Generate unique bid number: BID-YYYY-XXXXXX
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    const bidNumber = `BID-${new Date().getFullYear()}-${randomHex}`;

    const insertData = {
      tender_id: payload.tenderId,
      bidder_organization_id: orgId,
      submitted_by_user_id: user.id,
      bid_number: bidNumber,
      status: BidStatus.DRAFT,
      submission_notes: payload.submissionNotes || null
    };

    const { data: createdBid, error: insertErr } = await admin
      .from('bids')
      .insert(insertData)
      .select()
      .single();

    if (insertErr || !createdBid) {
      throw new AppError('Failed to create draft bid application.', 500, 'DB_ERROR', insertErr);
    }

    return this.getBidById(user, createdBid.id);
  }

  /**
   * Get list of bid applications for the bidder's organization.
   */
  static async getMyBids(
    user: UserProfile,
    query: BidQuery
  ): Promise<PaginatedResponse<BidListItem>> {
    if (!config.hasSupabaseConfigured()) {
      return { items: [], page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 };
    }

    const orgId = user.organization?.id;
    if (!orgId) {
      return { items: [], page: query.page, pageSize: query.pageSize, total: 0, totalPages: 0 };
    }

    const admin = getSupabaseAdminClient();
    const { page, pageSize, search, status, sortBy, sortOrder } = query;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let dbQuery = admin
      .from('bids')
      .select(`
        id,
        bid_number,
        tender_id,
        status,
        submitted_at,
        created_at,
        tender:tenders (
          id,
          tender_number,
          title,
          submission_deadline,
          tender_requirements (
            id,
            is_mandatory
          )
        ),
        bidder_organization:organizations (
          id,
          legal_name
        ),
        bid_documents (
          id,
          tender_requirement_id
        )
      `, { count: 'exact' })
      .eq('bidder_organization_id', orgId);

    if (status) {
      dbQuery = dbQuery.eq('status', status);
    }

    if (search) {
      dbQuery = dbQuery.or(`bid_number.ilike.%${search}%`);
    }

    dbQuery = dbQuery.order(sortBy, { ascending: sortOrder === 'asc' }).range(from, to);

    const { data, error, count } = await dbQuery;
    if (error) {
      throw new AppError('Failed to list applications', 500, 'DB_ERROR', error);
    }

    const total = count || 0;
    const items: BidListItem[] = (data || []).map((row: any) => {
      const tender = Array.isArray(row.tender) ? row.tender[0] : row.tender;
      const org = Array.isArray(row.bidder_organization) ? row.bidder_organization[0] : row.bidder_organization;
      const reqs = (tender?.tender_requirements || []) as Array<{ id: string; is_mandatory: boolean }>;
      const docs = (row.bid_documents || []) as Array<{ id: string; tender_requirement_id: string }>;

      const mandatoryReqs = reqs.filter(r => r.is_mandatory);
      const coveredReqIds = new Set(docs.map(d => d.tender_requirement_id));
      const satisfiedMandatory = mandatoryReqs.filter(r => coveredReqIds.has(r.id)).length;

      return {
        id: row.id,
        bidNumber: row.bid_number,
        tenderId: row.tender_id,
        tenderNumber: tender?.tender_number || 'N/A',
        tenderTitle: tender?.title || 'Untitled Tender',
        bidderOrganizationId: org?.id || orgId,
        bidderOrganizationName: org?.legal_name || 'My Organization',
        status: row.status as BidStatus,
        submissionDeadline: tender?.submission_deadline || '',
        submittedAt: row.submitted_at,
        documentCount: docs.length,
        mandatoryRequirementCount: mandatoryReqs.length,
        mandatorySatisfiedCount: satisfiedMandatory,
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
   * Get all uploaded documents for the bidder across bids.
   */
  static async getMyDocuments(user: UserProfile): Promise<BidDocument[]> {
    if (!config.hasSupabaseConfigured()) return [];

    const orgId = user.organization?.id;
    if (!orgId) return [];

    const admin = getSupabaseAdminClient();

    const { data, error } = await admin
      .from('bid_documents')
      .select(`
        *,
        bid:bids!inner (
          id,
          bid_number,
          bidder_organization_id
        ),
        tender_requirement:tender_requirements (
          id,
          code,
          name,
          category,
          is_mandatory
        )
      `)
      .eq('bid.bidder_organization_id', orgId)
      .order('uploaded_at', { ascending: false });

    if (error) {
      throw new AppError('Failed to fetch documents', 500, 'DB_ERROR', error);
    }

    return (data || []).map((row: any) => this.mapBidDocument(row));
  }

  /**
   * Get complete bid details with tender info, organization profile, requirements map, and documents.
   */
  static async getBidById(user: UserProfile, bidId: string): Promise<BidDetail> {
    if (!config.hasSupabaseConfigured()) {
      throw new AppError('Database unconfigured', 503, 'DATABASE_UNCONFIGURED');
    }

    const admin = getSupabaseAdminClient();

    const { data: bid, error } = await admin
      .from('bids')
      .select(`
        *,
        bidder_organization:organizations (
          id,
          legal_name,
          organization_type,
          identifier,
          is_verified
        ),
        submitted_by:users (
          id,
          full_name,
          email
        ),
        tender:tenders (
          *,
          procuring_organization:organizations (
            id,
            legal_name,
            organization_type,
            identifier
          ),
          tender_requirements (*)
        ),
        bid_documents (
          *,
          tender_requirement:tender_requirements (
            id,
            code,
            name,
            category,
            is_mandatory
          )
        )
      `)
      .eq('id', bidId)
      .maybeSingle();

    if (error || !bid) {
      throw new AppError('Bid application not found.', 404, 'BID_NOT_FOUND');
    }

    // Access authorization:
    // 1. Bidder can only view bids belonging to their organization
    // 2. Officer can only view bids for tenders belonging to their procuring org (or created by them)
    // 3. Admin / Auditor can view all bids
    const isBidderOwner = user.organization?.id && bid.bidder_organization_id === user.organization.id;
    const isProcuringOfficer = user.role === UserRole.OFFICER && (
      (user.organization?.id && bid.tender?.procuring_organization_id === user.organization.id) ||
      bid.tender?.created_by === user.id
    );
    const isAdminOrAuditor = user.role === UserRole.ADMIN || user.role === UserRole.AUDITOR;

    if (!isBidderOwner && !isProcuringOfficer && !isAdminOrAuditor) {
      throw new AppError('You are not authorized to view this bid application.', 403, 'FORBIDDEN');
    }

    return this.mapBidDetail(bid, user);
  }

  /**
   * Attach a document to a draft bid linked to a specific tender requirement.
   */
  static async attachDocument(
    user: UserProfile,
    bidId: string,
    payload: AttachDocumentPayload
  ): Promise<BidDocument> {
    const admin = getSupabaseAdminClient();

    // 1. Fetch bid and verify draft status and ownership
    const { data: bid, error: bidErr } = await admin
      .from('bids')
      .select('id, tender_id, bidder_organization_id, status')
      .eq('id', bidId)
      .maybeSingle();

    if (bidErr || !bid) {
      throw new AppError('Bid not found.', 404, 'BID_NOT_FOUND');
    }

    if (bid.status !== BidStatus.DRAFT) {
      throw new AppError('Documents can only be attached to bids in DRAFT status.', 400, 'BID_NOT_EDITABLE');
    }

    if (user.organization?.id !== bid.bidder_organization_id && user.role !== UserRole.ADMIN) {
      throw new AppError('You do not have permission to attach documents to this bid.', 403, 'FORBIDDEN');
    }

    // 2. Verify requirement exists on the tender
    const { data: req, error: reqErr } = await admin
      .from('tender_requirements')
      .select('id, code, name, category, is_mandatory')
      .eq('id', payload.tenderRequirementId)
      .eq('tender_id', bid.tender_id)
      .maybeSingle();

    if (reqErr || !req) {
      throw new AppError('Requirement does not belong to this tender.', 400, 'INVALID_REQUIREMENT');
    }

    // Storage path: bids/{bid_id}/{requirement_id}_{random}_{filename}
    const safeDocName = payload.documentName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = payload.storagePath || `bids/${bidId}/${req.id}_${Date.now()}_${safeDocName}`;

    const insertData = {
      bid_id: bidId,
      tender_requirement_id: payload.tenderRequirementId,
      document_name: payload.documentName,
      storage_path: storagePath,
      file_size: payload.fileSize,
      mime_type: payload.mimeType,
      sha256_hash: payload.sha256Hash || null,
      verification_status: VerificationStatus.PENDING_VERIFICATION,
      metadata: payload.metadata || {},
      uploaded_by: user.id
    };

    const { data: doc, error: docErr } = await admin
      .from('bid_documents')
      .insert(insertData)
      .select(`
        *,
        tender_requirement:tender_requirements (
          id,
          code,
          name,
          category,
          is_mandatory
        )
      `)
      .single();

    if (docErr || !doc) {
      throw new AppError('Failed to record attached document.', 500, 'DB_ERROR', docErr);
    }

    return this.mapBidDocument(doc);
  }

  /**
   * Upload real document file (PDF / Image / etc.), compute genuine SHA-256, run Document Intelligence extraction,
   * save file to local repository storage, and record in bid_documents.
   */
  static async uploadDocument(
    user: UserProfile,
    bidId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    tenderRequirementId: string,
    metadata?: Record<string, unknown>
  ): Promise<BidDocument> {
    const admin = getSupabaseAdminClient();

    // 1. Fetch bid and verify draft status and ownership
    const { data: bid, error: bidErr } = await admin
      .from('bids')
      .select('id, tender_id, bidder_organization_id, status')
      .eq('id', bidId)
      .maybeSingle();

    if (bidErr || !bid) {
      throw new AppError('Bid not found.', 404, 'BID_NOT_FOUND');
    }

    if (bid.status !== BidStatus.DRAFT) {
      throw new AppError('Documents can only be uploaded to bids in DRAFT status.', 400, 'BID_NOT_EDITABLE');
    }

    if (user.organization?.id !== bid.bidder_organization_id && user.role !== UserRole.ADMIN) {
      throw new AppError('You do not have permission to upload documents to this bid.', 403, 'FORBIDDEN');
    }

    // 2. Verify requirement exists on the tender
    const { data: req, error: reqErr } = await admin
      .from('tender_requirements')
      .select('id, code, name, category, is_mandatory')
      .eq('id', tenderRequirementId)
      .eq('tender_id', bid.tender_id)
      .maybeSingle();

    if (reqErr || !req) {
      throw new AppError('Requirement does not belong to this tender.', 400, 'INVALID_REQUIREMENT');
    }

    // 3. Compute real SHA-256 hash from file bytes
    const sha256Hash = DocumentIntelligenceService.computeSha256(file.buffer);

    // 4. Save file to disk & Supabase Storage
    const safeDocName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${bidId}_${req.id}_${Date.now()}_${safeDocName}`;
    const uploadDir = path.resolve(process.cwd(), 'uploads', 'documents');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const fullFilePath = path.join(uploadDir, filename);
    fs.writeFileSync(fullFilePath, file.buffer);
    const storagePath = `uploads/documents/${filename}`;

    // Upload to Supabase Storage bucket if configured
    if (config.hasSupabaseConfigured()) {
      try {
        await admin.storage
          .from('bid_documents')
          .upload(storagePath, file.buffer, {
            contentType: file.mimetype,
            upsert: true
          });
      } catch (storageErr) {
        console.warn('[uploadDocument] Supabase Storage upload note:', storageErr);
      }
    }

    // Determine version (check existing versions for this requirement on bid)
    const { count } = await admin
      .from('bid_documents')
      .select('*', { count: 'exact', head: true })
      .eq('bid_id', bidId)
      .eq('tender_requirement_id', tenderRequirementId);
    const docVersion = (count || 0) + 1;

    // 5. Run Document Intelligence extraction
    const extraction = await DocumentIntelligenceService.processDocumentBuffer(
      file.buffer,
      file.mimetype,
      file.originalname,
      `DOC-${Date.now()}`
    );

    const mergedMetadata: Record<string, unknown> = {
      ...(metadata || {}),
      ...extraction.fields,
      version: docVersion,
      extractionProvider: extraction.provider,
      rawSnippet: extraction.rawSnippet,
      originalName: file.originalname
    };

    const insertData = {
      bid_id: bidId,
      tender_requirement_id: tenderRequirementId,
      document_name: file.originalname,
      storage_path: storagePath,
      file_size: file.size,
      mime_type: file.mimetype,
      sha256_hash: sha256Hash,
      verification_status: extraction.status,
      metadata: mergedMetadata,
      uploaded_by: user.id
    };

    const { data: doc, error: docErr } = await admin
      .from('bid_documents')
      .insert(insertData)
      .select(`
        *,
        tender_requirement:tender_requirements (
          id,
          code,
          name,
          category,
          is_mandatory
        )
      `)
      .single();

    if (docErr || !doc) {
      throw new AppError('Failed to record uploaded document.', 500, 'DB_ERROR', docErr);
    }

    // Also persist into extracted_evidence if fields were found
    if (Object.keys(extraction.fields).length > 0) {
      try {
        await admin.from('extracted_evidence').insert({
          bid_document_id: doc.id,
          bid_id: bidId,
          provider: extraction.provider,
          status: extraction.status,
          fields: extraction.fields,
          raw_snippet: extraction.rawSnippet
        });
      } catch (evErr) {
        console.warn('Extracted evidence recording note:', evErr);
      }
    }

    return this.mapBidDocument(doc);
  }

  /**
   * Retrieve physical file information for document viewing/download.
   */
  static async getDocumentFile(
    user: UserProfile,
    bidId: string,
    documentId: string
  ): Promise<{ absolutePath: string; documentName: string; mimeType: string; sha256Hash?: string; isIntegrityVerified?: boolean }> {
    const admin = getSupabaseAdminClient();

    const { data: doc, error: docErr } = await admin
      .from('bid_documents')
      .select(`
        id,
        document_name,
        storage_path,
        mime_type,
        sha256_hash,
        bid:bids (
          id,
          bidder_organization_id,
          tender:tenders (
            procuring_organization_id,
            created_by
          )
        )
      `)
      .eq('id', documentId)
      .eq('bid_id', bidId)
      .maybeSingle();

    if (docErr || !doc) {
      throw new AppError('Document not found.', 404, 'DOCUMENT_NOT_FOUND');
    }

    const bid = Array.isArray(doc.bid) ? doc.bid[0] : doc.bid;
    const tender = Array.isArray(bid?.tender) ? bid?.tender[0] : bid?.tender;

    const isBidderOwner = user.organization?.id && bid?.bidder_organization_id === user.organization.id;
    const isProcuringOfficer = user.role === UserRole.OFFICER && (
      (user.organization?.id && tender?.procuring_organization_id === user.organization.id) ||
      tender?.created_by === user.id
    );
    const isAdminOrAuditor = user.role === UserRole.ADMIN || user.role === UserRole.AUDITOR;

    if (!isBidderOwner && !isProcuringOfficer && !isAdminOrAuditor) {
      throw new AppError('You are not authorized to access this document.', 403, 'FORBIDDEN');
    }

    const resolvedPath = path.isAbsolute(doc.storage_path)
      ? doc.storage_path
      : path.resolve(process.cwd(), doc.storage_path);

    if (!fs.existsSync(resolvedPath)) {
      if (config.hasSupabaseConfigured()) {
        try {
          const { data: fileBlob, error: storageErr } = await admin.storage
            .from('bid_documents')
            .download(doc.storage_path);
          if (!storageErr && fileBlob) {
            const arrayBuffer = await fileBlob.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const dir = path.dirname(resolvedPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(resolvedPath, buffer);
          }
        } catch (downloadErr) {
          console.warn('[getDocumentFile] Supabase Storage download notice:', downloadErr);
        }
      }
    }

    if (!fs.existsSync(resolvedPath)) {
      throw new AppError('Physical document file not found on storage.', 404, 'FILE_NOT_FOUND');
    }

    const fileBytes = fs.readFileSync(resolvedPath);
    const computedHash = DocumentIntelligenceService.computeSha256(fileBytes);
    const isIntegrityVerified = doc.sha256_hash ? doc.sha256_hash === computedHash : true;

    return {
      absolutePath: resolvedPath,
      documentName: doc.document_name,
      mimeType: doc.mime_type,
      sha256Hash: doc.sha256_hash || computedHash,
      isIntegrityVerified
    };
  }

  /**
   * Get secure view information and signed URL for a bid document.
   */
  static async getDocumentViewUrl(user: UserProfile, bidId: string, documentId: string) {
    const admin = getSupabaseAdminClient();
    const { data: doc, error } = await admin
      .from('bid_documents')
      .select('id, document_name, storage_path, mime_type, file_size, sha256_hash, verification_status, metadata, bid:bids(id, bidder_organization_id, tender:tenders(procuring_organization_id, created_by))')
      .eq('id', documentId)
      .eq('bid_id', bidId)
      .maybeSingle();

    if (error || !doc) {
      throw new AppError('Document not found.', 404, 'DOCUMENT_NOT_FOUND');
    }

    const bid = Array.isArray(doc.bid) ? doc.bid[0] : doc.bid;
    const tender = Array.isArray(bid?.tender) ? bid?.tender[0] : bid?.tender;
    const isBidderOwner = user.organization?.id && bid?.bidder_organization_id === user.organization.id;
    const isProcuringOfficer = user.role === UserRole.OFFICER && (
      (user.organization?.id && tender?.procuring_organization_id === user.organization.id) ||
      tender?.created_by === user.id
    );
    const isAdminOrAuditor = user.role === UserRole.ADMIN || user.role === UserRole.AUDITOR;

    if (!isBidderOwner && !isProcuringOfficer && !isAdminOrAuditor) {
      throw new AppError('You are not authorized to access this document.', 403, 'FORBIDDEN');
    }

    let signedUrl = `/api/v1/bids/${bidId}/documents/${documentId}/file`;
    if (config.hasSupabaseConfigured()) {
      try {
        const { data: signedData } = await admin.storage
          .from('bid_documents')
          .createSignedUrl(doc.storage_path, 3600);
        if (signedData?.signedUrl) {
          signedUrl = signedData.signedUrl;
        }
      } catch {
        // stream fallback
      }
    }

    return {
      url: signedUrl,
      documentName: doc.document_name,
      mimeType: doc.mime_type,
      size: doc.file_size,
      sha256Hash: doc.sha256_hash,
      verificationStatus: doc.verification_status,
      metadata: doc.metadata
    };
  }

  /**
   * Remove an attached document from a draft bid.
   */
  static async removeDocument(user: UserProfile, bidId: string, documentId: string): Promise<void> {
    const admin = getSupabaseAdminClient();

    const { data: doc, error: docErr } = await admin
      .from('bid_documents')
      .select('id, bid_id, bid:bids (status, bidder_organization_id)')
      .eq('id', documentId)
      .eq('bid_id', bidId)
      .maybeSingle();

    if (docErr || !doc) {
      throw new AppError('Document not found.', 404, 'DOCUMENT_NOT_FOUND');
    }

    const bid = Array.isArray(doc.bid) ? doc.bid[0] : doc.bid;
    if (bid?.status !== BidStatus.DRAFT) {
      throw new AppError('Cannot delete documents from a submitted bid.', 400, 'BID_NOT_EDITABLE');
    }

    if (user.organization?.id !== bid?.bidder_organization_id && user.role !== UserRole.ADMIN) {
      throw new AppError('You are not authorized to delete this document.', 403, 'FORBIDDEN');
    }

    const { error: delErr } = await admin
      .from('bid_documents')
      .delete()
      .eq('id', documentId);

    if (delErr) {
      throw new AppError('Failed to remove document record.', 500, 'DB_ERROR', delErr);
    }
  }

  /**
   * Final bid submission.
   * Enforces:
   * 1. Bid is in DRAFT
   * 2. Tender is still within deadline
   * 3. All mandatory requirements have at least one attached document
   * 4. Declaration confirmed
   */
  static async submitBid(
    user: UserProfile,
    bidId: string,
    payload: SubmitBidPayload
  ): Promise<BidDetail> {
    const bidDetail = await this.getBidById(user, bidId);

    if (bidDetail.status !== BidStatus.DRAFT) {
      throw new AppError(`Only DRAFT bids can be submitted. Current status is '${bidDetail.status}'.`, 400, 'BID_ALREADY_SUBMITTED');
    }

    if (!payload.confirmation) {
      throw new AppError('You must explicitly confirm compliance declaration before submitting.', 400, 'CONFIRMATION_REQUIRED');
    }

    // Check tender deadline
    if (bidDetail.tender && new Date(bidDetail.tender.submissionDeadline) <= new Date()) {
      throw new AppError('Cannot submit bid: Tender submission deadline has passed.', 400, 'DEADLINE_EXPIRED');
    }

    // Verify all mandatory requirements have uploaded documents
    if (bidDetail.missingMandatoryRequirements.length > 0) {
      throw new AppError(
        `Cannot submit bid: Missing mandatory requirement documents: ${bidDetail.missingMandatoryRequirements.join(', ')}`,
        400,
        'MISSING_MANDATORY_DOCUMENTS'
      );
    }

    const admin = getSupabaseAdminClient();
    const updateData: Record<string, unknown> = {
      status: BidStatus.SUBMITTED,
      submitted_at: new Date().toISOString()
    };

    let finalNotes = payload.submissionNotes || '';
    if (payload.bidAmount !== undefined && payload.bidAmount !== null) {
      updateData.bid_amount = payload.bidAmount;
      const formattedAmount = `[Bid Amount: INR ${Number(payload.bidAmount).toLocaleString('en-IN')}]`;
      finalNotes = finalNotes ? `${formattedAmount}\n${finalNotes}` : formattedAmount;
    }

    if (finalNotes) {
      updateData.submission_notes = finalNotes;
    }

    const { error: updateErr } = await admin
      .from('bids')
      .update(updateData)
      .eq('id', bidId);

    if (updateErr) {
      throw new AppError('Failed to submit bid.', 500, 'DB_ERROR', updateErr);
    }

    return this.getBidById(user, bidId);
  }

  /**
   * Withdraw a submitted bid before deadline.
   */
  static async withdrawBid(user: UserProfile, bidId: string): Promise<BidDetail> {
    const bidDetail = await this.getBidById(user, bidId);

    if (bidDetail.status !== BidStatus.SUBMITTED) {
      throw new AppError('Only SUBMITTED bids can be withdrawn.', 400, 'INVALID_BID_STATUS');
    }

    if (user.organization?.id !== bidDetail.bidderOrganizationId && user.role !== UserRole.ADMIN) {
      throw new AppError('You do not have permission to withdraw this bid.', 403, 'FORBIDDEN');
    }

    const admin = getSupabaseAdminClient();
    const { error: updateErr } = await admin
      .from('bids')
      .update({ status: BidStatus.WITHDRAWN })
      .eq('id', bidId);

    if (updateErr) {
      throw new AppError('Failed to withdraw bid.', 500, 'DB_ERROR', updateErr);
    }

    return this.getBidById(user, bidId);
  }

  /**
   * Officer endpoint: List all submitted bids for a specific tender.
   */
  static async listBidsForTender(user: UserProfile, tenderId: string): Promise<BidListItem[]> {
    if (!config.hasSupabaseConfigured()) return [];

    const admin = getSupabaseAdminClient();

    // Verify tender existence and officer authority
    const { data: tender, error: tenderErr } = await admin
      .from('tenders')
      .select('id, tender_number, title, procuring_organization_id, created_by, submission_deadline, tender_requirements(id, is_mandatory)')
      .eq('id', tenderId)
      .maybeSingle();

    if (tenderErr || !tender) {
      throw new AppError('Tender not found.', 404, 'TENDER_NOT_FOUND');
    }

    const isAuthorized = user.role === UserRole.ADMIN ||
      tender.created_by === user.id ||
      (user.organization?.id && tender.procuring_organization_id === user.organization.id);

    if (!isAuthorized) {
      throw new AppError('You are not authorized to review bids for this tender.', 403, 'FORBIDDEN');
    }

    const { data: bids, error: bidsErr } = await admin
      .from('bids')
      .select(`
        id,
        bid_number,
        tender_id,
        status,
        submission_notes,
        submitted_at,
        created_at,
        bidder_organization:organizations (
          id,
          legal_name
        ),
        bid_documents (
          id,
          tender_requirement_id
        )
      `)
      .eq('tender_id', tenderId)
      .neq('status', BidStatus.DRAFT) // Officers only review non-draft applications
      .order('submitted_at', { ascending: true });

    if (bidsErr) {
      throw new AppError('Failed to retrieve bids for tender.', 500, 'DB_ERROR', bidsErr);
    }

    const reqs = (tender.tender_requirements || []) as Array<{ id: string; is_mandatory: boolean }>;
    const mandatoryReqs = reqs.filter(r => r.is_mandatory);

    return (bids || []).map((b: any) => {
      const org = Array.isArray(b.bidder_organization) ? b.bidder_organization[0] : b.bidder_organization;
      const docs = (b.bid_documents || []) as Array<{ id: string; tender_requirement_id: string }>;
      const coveredReqIds = new Set(docs.map(d => d.tender_requirement_id));
      const satisfiedMandatory = mandatoryReqs.filter(r => coveredReqIds.has(r.id)).length;

      let bidAmount: number | null = null;
      if (b.bid_amount !== undefined && b.bid_amount !== null) {
        bidAmount = Number(b.bid_amount);
      } else if (b.submission_notes) {
        const match = b.submission_notes.match(/\[Bid Amount:\s*(?:INR\s*)?([0-9,.]+)/i);
        if (match && match[1]) {
          bidAmount = parseFloat(match[1].replace(/,/g, ''));
        }
      }

      return {
        id: b.id,
        bidNumber: b.bid_number,
        tenderId: b.tender_id,
        tenderNumber: tender.tender_number,
        tenderTitle: tender.title,
        bidderOrganizationId: org?.id || '',
        bidderOrganizationName: org?.legal_name || 'Anonymous Bidder',
        status: b.status as BidStatus,
        bidAmount,
        submissionDeadline: tender.submission_deadline,
        submittedAt: b.submitted_at,
        documentCount: docs.length,
        mandatoryRequirementCount: mandatoryReqs.length,
        mandatorySatisfiedCount: satisfiedMandatory,
        createdAt: b.created_at
      };
    });
  }

  /**
   * Officer endpoint: Transition bid status to UNDER_REVIEW.
   */
  static async transitionReviewStatus(user: UserProfile, bidId: string): Promise<BidDetail> {
    const bid = await this.getBidById(user, bidId);

    if (bid.status !== BidStatus.SUBMITTED) {
      throw new AppError(
        `Cannot mark bid under review from status '${bid.status}'. Must be SUBMITTED.`,
        400,
        'INVALID_STATUS'
      );
    }

    const admin = getSupabaseAdminClient();
    const { error } = await admin
      .from('bids')
      .update({ status: BidStatus.UNDER_REVIEW })
      .eq('id', bidId);

    if (error) {
      throw new AppError('Failed to update bid review status.', 500, 'DB_ERROR', error);
    }

    return this.getBidById(user, bidId);
  }

  // --- Entity Mappers ---

  private static mapBidDocument(row: any): BidDocument {
    const req = Array.isArray(row.tender_requirement) ? row.tender_requirement[0] : row.tender_requirement;
    return {
      id: row.id,
      bidId: row.bid_id,
      tenderRequirementId: row.tender_requirement_id,
      documentName: row.document_name,
      storagePath: row.storage_path,
      fileSize: Number(row.file_size || 0),
      mimeType: row.mime_type,
      sha256Hash: row.sha256_hash,
      verificationStatus: row.verification_status as VerificationStatus,
      metadata: row.metadata || {},
      uploadedAt: row.uploaded_at,
      uploadedBy: row.uploaded_by,
      requirementCode: req?.code,
      requirementName: req?.name,
      category: req?.category as RequirementCategory,
      isMandatory: req?.is_mandatory,
      version: Number((row.metadata as any)?.version || row.version || 1)
    };
  }

  private static mapBidDetail(row: any, currentUser: UserProfile): BidDetail {
    const tender = Array.isArray(row.tender) ? row.tender[0] : row.tender;
    const org = Array.isArray(row.bidder_organization) ? row.bidder_organization[0] : row.bidder_organization;
    const user = Array.isArray(row.submitted_by) ? row.submitted_by[0] : row.submitted_by;
    const rawDocs = row.bid_documents || [];
    const documents: BidDocument[] = rawDocs.map((d: any) => this.mapBidDocument(d));

    // Construct requirements map
    const tenderReqs = (tender?.tender_requirements || []) as any[];
    const missingMandatory: string[] = [];

    const requirementsMap = tenderReqs.map(req => {
      const matchingDocs = documents.filter(d => d.tenderRequirementId === req.id);
      const isSatisfied = matchingDocs.length > 0;
      if (req.is_mandatory && !isSatisfied) {
        missingMandatory.push(req.name || req.code);
      }

      return {
        requirement: {
          id: req.id,
          tenderId: req.tender_id,
          code: req.code,
          name: req.name,
          description: req.description,
          category: req.category,
          requirementType: req.requirement_type,
          isMandatory: req.is_mandatory,
          isApplicable: req.is_applicable,
          weight: Number(req.weight || 0),
          minimumThreshold: req.minimum_threshold,
          configuration: req.configuration || {},
          evidenceTypes: req.evidence_types || [],
          verificationSources: req.verification_sources || [],
          createdAt: req.created_at,
          updatedAt: req.updated_at
        },
        documents: matchingDocs,
        isSatisfied
      };
    });

    const isOwner = currentUser.organization?.id === row.bidder_organization_id;
    const isDraft = row.status === BidStatus.DRAFT;
    const deadlinePassed = tender ? new Date(tender.submission_deadline) <= new Date() : false;

    let bidAmount: number | null = null;
    if (row.bid_amount !== undefined && row.bid_amount !== null) {
      bidAmount = Number(row.bid_amount);
    } else if (row.submission_notes) {
      const match = row.submission_notes.match(/\[Bid Amount:\s*(?:INR\s*)?([0-9,.]+)/i);
      if (match && match[1]) {
        bidAmount = parseFloat(match[1].replace(/,/g, ''));
      }
    }

    return {
      id: row.id,
      tenderId: row.tender_id,
      bidderOrganizationId: row.bidder_organization_id,
      submittedByUserId: row.submitted_by_user_id,
      bidNumber: row.bid_number,
      status: row.status as BidStatus,
      bidAmount,
      submissionNotes: row.submission_notes,
      submittedAt: row.submitted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      tender: tender ? {
        id: tender.id,
        tenderNumber: tender.tender_number,
        title: tender.title,
        description: tender.description,
        procuringOrganizationId: tender.procuring_organization_id,
        createdBy: tender.created_by,
        publicationDate: tender.publication_date,
        submissionDeadline: tender.submission_deadline,
        openingDate: tender.opening_date,
        status: tender.status,
        estimatedValue: tender.estimated_value ? Number(tender.estimated_value) : null,
        currency: tender.currency,
        minimumCompanyAgeYears: tender.minimum_company_age_years,
        createdAt: tender.created_at,
        updatedAt: tender.updated_at,
        requirements: tenderReqs
      } : null,
      bidderOrganization: org ? {
        id: org.id,
        legalName: org.legal_name,
        organizationType: org.organization_type,
        identifier: org.identifier,
        isVerified: org.is_verified
      } : null,
      submittedBy: user ? {
        id: user.id,
        fullName: user.full_name,
        email: user.email
      } : null,
      documents,
      requirementsMap,
      canEdit: isOwner && isDraft && !deadlinePassed,
      canSubmit: isOwner && isDraft && !deadlinePassed && missingMandatory.length === 0,
      missingMandatoryRequirements: missingMandatory
    };
  }
}
