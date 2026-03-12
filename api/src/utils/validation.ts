import { z } from 'zod';

export const emailSchema = z
  .string()
  .email('Invalid email address')
  .transform((val) => val.toLowerCase().trim());

export const uuidSchema = z.string().uuid('Invalid UUID');

export const paginationSchema = z.object({
  page: z.string().optional().default('1').transform(Number).pipe(z.number().int().min(1)),
  pageSize: z
    .string()
    .optional()
    .default('20')
    .transform(Number)
    .pipe(z.number().int().min(1).max(100)),
});
