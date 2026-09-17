import { z } from 'zod';
import { RequirementCategory, RequirementType, TenderStatus, TenderLifecycleAction } from '@e-pramaan/shared';

export const createTenderSchema = z.object({
  tenderNumber: z
    .string()
    .min(3, 'Tender number must be at least 3 characters')
    .max(100, 'Tender number must not exceed 100 characters')
    .regex(/^[A-Za-z0-9-_/]+$/, 'Tender number contains invalid characters'),
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters')
    .max(300, 'Title must not exceed 300 characters'),
  description: z.string().optional(),
  procuringOrganizationId: z.string().uuid('Invalid procuring organization ID').optional(),
  publicationDate: z.string().datetime({ offset: true }).optional(),
  submissionDeadline: z.string().datetime({ offset: true }),
  openingDate: z.string().datetime({ offset: true }).optional(),
  estimatedValue: z.number().positive('Estimated value must be positive').optional(),
  currency: z.string().length(3, 'Currency code must be 3 characters').default('INR'),
  minimumCompanyAgeYears: z.number().int().min(0, 'Company age must be 0 or greater').optional()
}).refine(data => {
  const deadline = new Date(data.submissionDeadline);
  return deadline > new Date();
}, {
  message: 'Submission deadline must be in the future',
  path: ['submissionDeadline']
}).refine(data => {
  if (data.openingDate) {
    return new Date(data.openingDate) >= new Date(data.submissionDeadline);
  }
  return true;
}, {
  message: 'Opening date must be after or equal to submission deadline',
  path: ['openingDate']
});

export const updateTenderSchema = z.object({
  title: z.string().min(5).max(300).optional(),
  description: z.string().optional(),
  submissionDeadline: z.string().datetime({ offset: true }).optional(),
  openingDate: z.string().datetime({ offset: true }).optional(),
  estimatedValue: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  minimumCompanyAgeYears: z.number().int().min(0).optional()
}).refine(data => {
  if (data.submissionDeadline) {
    return new Date(data.submissionDeadline) > new Date();
  }
  return true;
}, {
  message: 'Submission deadline must be in the future',
  path: ['submissionDeadline']
});

export const createRequirementSchema = z.object({
  code: z
    .string()
    .min(2, 'Requirement code must be at least 2 characters')
    .max(50, 'Code must not exceed 50 characters')
    .regex(/^[A-Za-z0-9_-]+$/, 'Code can only contain letters, numbers, underscores, and hyphens'),
  name: z.string().min(3, 'Requirement name must be at least 3 characters').max(200),
  description: z.string().optional(),
  category: z.nativeEnum(RequirementCategory, {
    errorMap: () => ({ message: 'Invalid requirement category' })
  }),
  requirementType: z.nativeEnum(RequirementType, {
    errorMap: () => ({ message: 'Invalid requirement type' })
  }),
  isMandatory: z.boolean().default(true),
  isApplicable: z.boolean().default(true),
  weight: z.number().min(0).max(100).default(0),
  minimumThreshold: z.number().optional(),
  configuration: z.record(z.unknown()).default({}),
  evidenceTypes: z.array(z.string()).default([]),
  verificationSources: z.array(z.string()).default([])
});

export const updateRequirementSchema = z.object({
  name: z.string().min(3).max(200).optional(),
  description: z.string().optional(),
  category: z.nativeEnum(RequirementCategory).optional(),
  requirementType: z.nativeEnum(RequirementType).optional(),
  isMandatory: z.boolean().optional(),
  isApplicable: z.boolean().optional(),
  weight: z.number().min(0).max(100).optional(),
  minimumThreshold: z.number().optional(),
  configuration: z.record(z.unknown()).optional(),
  evidenceTypes: z.array(z.string()).optional(),
  verificationSources: z.array(z.string()).optional()
});

export const listTendersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  status: z.nativeEnum(TenderStatus).optional(),
  sortBy: z.enum(['created_at', 'submission_deadline', 'estimated_value', 'title']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

export const lifecycleActionSchema = z.object({
  action: z.nativeEnum(TenderLifecycleAction, {
    errorMap: () => ({ message: 'Invalid lifecycle action' })
  })
});
