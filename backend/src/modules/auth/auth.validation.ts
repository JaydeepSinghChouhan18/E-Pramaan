import { z } from 'zod';
import { UserRole, OrganizationType } from '@e-pramaan/shared';

export const registerSchema = z.object({
  email: z.string().email('Please provide a valid official email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters long'),
  role: z.literal(UserRole.BIDDER).default(UserRole.BIDDER),
  organizationName: z.string().min(2, 'Organization name must be at least 2 characters long').optional(),
  organizationType: z.nativeEnum(OrganizationType).optional(),
  organizationIdentifier: z.string().optional()
});

export const loginSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
  password: z.string().min(1, 'Password is required')
});
