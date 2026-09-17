import { z } from 'zod';
import { BidStatus } from '@e-pramaan/shared';

export const createBidSchema = z.object({
  tenderId: z.string().uuid({ message: 'Valid tender UUID is required.' }),
  submissionNotes: z.string().max(2000).optional()
});

export const attachDocumentSchema = z.object({
  tenderRequirementId: z.string().uuid({ message: 'Valid tender requirement UUID is required.' }),
  documentName: z.string().min(2).max(255),
  fileSize: z.number().int().positive({ message: 'File size must be positive.' }),
  mimeType: z.string().min(3).max(100),
  storagePath: z.string().optional(),
  sha256Hash: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

export const submitBidSchema = z.object({
  confirmation: z.boolean().refine(val => val === true, {
    message: 'You must confirm the submission declaration.'
  }),
  submissionNotes: z.string().max(2000).optional()
});

export const bidQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  status: z.nativeEnum(BidStatus).optional(),
  sortBy: z.enum(['created_at', 'submitted_at', 'bid_number', 'status']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});
