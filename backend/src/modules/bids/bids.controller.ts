import { Request, Response, NextFunction } from 'express';
import { BidsService } from './bids.service.js';
import { createBidSchema, attachDocumentSchema, submitBidSchema, bidQuerySchema } from './bids.validation.js';
import { AppError } from '../../middlewares/errorHandler.js';

export class BidsController {
  /**
   * POST /api/v1/bids
   * Create a new draft bid application for a published tender.
   */
  static async createDraftBid(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const parseResult = createBidSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', parseResult.error.format());
      }

      const bid = await BidsService.createDraftBid(user, parseResult.data);
      res.status(201).json({
        success: true,
        message: 'Draft bid application created successfully.',
        data: bid
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/bids/my-bids
   * List bidder's submitted and draft applications.
   */
  static async getMyBids(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const parseResult = bidQuerySchema.safeParse(req.query);
      if (!parseResult.success) {
        throw new AppError('Invalid query parameters', 400, 'VALIDATION_ERROR', parseResult.error.format());
      }

      const result = await BidsService.getMyBids(user, parseResult.data);
      res.json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/bids/my-documents
   * Centralized repository of all uploaded documents for the bidder.
   */
  static async getMyDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const documents = await BidsService.getMyDocuments(user);
      res.json({
        success: true,
        data: documents
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/bids/:id
   * Get complete bid details with documents and requirement compliance map.
   */
  static async getBidById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const bid = await BidsService.getBidById(user, req.params.id);
      res.json({
        success: true,
        data: bid
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/bids/:id/documents
   * Attach document metadata to a draft bid.
   */
  static async attachDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const parseResult = attachDocumentSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', parseResult.error.format());
      }

      const doc = await BidsService.attachDocument(user, req.params.id, parseResult.data);
      res.status(201).json({
        success: true,
        message: 'Document attached successfully.',
        data: doc
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/bids/:id/documents/upload
   * Multipart upload of document file with server-side SHA-256 calculation & OCR/text extraction.
   */
  static async uploadDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const file = req.file;
      if (!file) {
        throw new AppError('No document file was uploaded.', 400, 'FILE_REQUIRED');
      }

      const tenderRequirementId = req.body.tenderRequirementId;
      if (!tenderRequirementId) {
        throw new AppError('tenderRequirementId is required.', 400, 'REQUIREMENT_ID_REQUIRED');
      }

      let metadata: Record<string, unknown> = {};
      if (req.body.metadata) {
        try {
          metadata = typeof req.body.metadata === 'string' ? JSON.parse(req.body.metadata) : req.body.metadata;
        } catch {
          // ignore
        }
      }

      const doc = await BidsService.uploadDocument(user, req.params.id, file, tenderRequirementId, metadata);
      res.status(201).json({
        success: true,
        message: 'Document uploaded and analyzed successfully.',
        data: doc
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/bids/:id/documents/:documentId/file
   * Stream physical document file for preview/inspection by officer or bidder.
   */
  static async getDocumentFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const { id, documentId } = req.params;
      const fileInfo = await BidsService.getDocumentFile(user, id, documentId);

      res.setHeader('Content-Type', fileInfo.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${fileInfo.documentName}"`);
      res.sendFile(fileInfo.absolutePath);
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/v1/bids/:id/documents/:documentId
   * Remove an attached document from a draft bid.
   */
  static async removeDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      await BidsService.removeDocument(user, req.params.id, req.params.documentId);
      res.json({
        success: true,
        message: 'Document removed successfully.'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/bids/:id/submit
   * Final submission of the bid application.
   */
  static async submitBid(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const parseResult = submitBidSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', parseResult.error.format());
      }

      const bid = await BidsService.submitBid(user, req.params.id, parseResult.data);
      res.json({
        success: true,
        message: 'Bid submitted successfully.',
        data: bid
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/bids/:id/withdraw
   * Withdraw a submitted bid before evaluation.
   */
  static async withdrawBid(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const bid = await BidsService.withdrawBid(user, req.params.id);
      res.json({
        success: true,
        message: 'Bid withdrawn successfully.',
        data: bid
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/bids/tender/:tenderId
   * Officer endpoint: List all submitted bids for a tender.
   */
  static async listBidsForTender(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const bids = await BidsService.listBidsForTender(user, req.params.tenderId);
      res.json({
        success: true,
        data: bids
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/bids/:id/review
   * Officer endpoint: Mark a submitted bid as UNDER_REVIEW.
   */
  static async transitionReviewStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const bid = await BidsService.transitionReviewStatus(user, req.params.id);
      res.json({
        success: true,
        message: 'Bid status updated to UNDER_REVIEW.',
        data: bid
      });
    } catch (err) {
      next(err);
    }
  }
}
