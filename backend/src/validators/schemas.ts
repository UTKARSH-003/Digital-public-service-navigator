import { z } from 'zod';

const stateCode = z
  .string()
  .regex(/^[A-Z]{2}$/, 'Use a 2-letter uppercase state code');

const httpsUrl = z
  .string()
  .url()
  .max(2000)
  .refine((u) => u.toLowerCase().startsWith('https://'), 'Only https:// URLs are allowed');

export const listServicesQuery = z.object({
  q: z.string().trim().max(200).optional(),
  category: z.string().regex(/^[a-z0-9-]+$/).optional(),
  state: stateCode.optional(),
  level: z.enum(['central', 'state']).optional(),
  sort: z.enum(['relevance', 'name', 'recent', 'verified']).default('relevance'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});
export type ListServicesQuery = z.infer<typeof listServicesQuery>;

export const answersSchema = z
  .object({
    state_code: stateCode,
    age: z.number().int().min(0).max(120),
    occupation: z.enum([
      'student',
      'employed',
      'unemployed',
      'farmer',
      'entrepreneur',
      'homemaker',
      'retired',
      'other',
    ]),
    annual_income: z.number().min(0).max(1_000_000_000),
    education_level: z.string().max(50),
    gender: z.string().max(30),
    category: z.string().max(50),
    disability: z.boolean(),
    residency: z.string().max(50),
  })
  .partial()
  .strict();

export const evaluateBody = z.object({
  service_id: z.string().uuid(),
  answers: answersSchema,
  save: z.boolean().optional(),
});

export const assistantBody = z.object({
  message: z.string().trim().min(2).max(500),
  language: z.enum(['en', 'hi']).default('en'),
  state: stateCode.optional(),
});

export const feedbackBody = z.object({
  service_id: z.string().uuid().optional(),
  report_type: z.enum(['inaccurate_info', 'broken_link', 'outdated', 'suggestion', 'other']),
  message: z.string().trim().min(5).max(2000),
});

export const saveServiceBody = z.object({ service_id: z.string().uuid() });

export const createChecklistBody = z.object({
  service_id: z.string().uuid(),
  custom_items: z.array(z.string().trim().min(1).max(300)).max(20).optional(),
});

export const patchChecklistBody = z
  .object({
    is_done: z.boolean().optional(),
    label: z.string().trim().min(1).max(300).optional(),
    application_reference: z
      .string()
      .trim()
      .max(64)
      .regex(/^[A-Za-z0-9\-/_. ]*$/, 'Reference may only contain letters, digits and - / _ .')
      .nullable()
      .optional(),
  })
  .refine((o) => Object.keys(o).length > 0, 'Nothing to update');

export const preferencesBody = z.object({
  profiling_consent: z.boolean(),
  state_code: stateCode.nullable().optional(),
  age_group: z.enum(['under_18', '18_25', '26_40', '41_59', '60_plus']).nullable().optional(),
  occupation: z
    .enum(['student', 'employed', 'unemployed', 'farmer', 'entrepreneur', 'homemaker', 'retired', 'other'])
    .nullable()
    .optional(),
  interests: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
});

const rulePayload = z.object({
  field: z.enum([
    'state_code',
    'age',
    'occupation',
    'annual_income',
    'education_level',
    'gender',
    'category',
    'disability',
    'residency',
  ]),
  operator: z.enum(['eq', 'neq', 'in', 'not_in', 'gte', 'lte', 'between']),
  value: z.unknown(),
  mandatory: z.boolean().default(true),
  question_text: z.string().min(3).max(300),
  explanation: z.string().max(500).nullable().optional(),
  description: z.string().min(3).max(300),
  sort_order: z.number().int().default(0),
});

export const serviceWriteBody = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/).min(3).max(120),
  name: z.string().trim().min(3).max(200),
  short_description: z.string().trim().min(10).max(600),
  category_id: z.number().int().positive(),
  government_level: z.enum(['central', 'state']),
  state_code: stateCode.nullable().optional(),
  target_beneficiaries: z.array(z.string().max(60)).max(20).default([]),
  fees_text: z.string().max(500).nullable().optional(),
  fees_verified: z.boolean().default(false),
  important_dates_text: z.string().max(500).nullable().optional(),
  dates_verified: z.boolean().default(false),
  application_url: httpsUrl.nullable().optional(),
  tags: z.array(z.string().max(40)).max(30).default([]),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  rules: z.array(rulePayload).max(30).optional(),
  documents: z
    .array(
      z.object({
        name: z.string().min(2).max(200),
        notes: z.string().max(500).nullable().optional(),
        is_mandatory: z.boolean().default(true),
      }),
    )
    .max(40)
    .optional(),
  steps: z
    .array(z.object({ title: z.string().min(2).max(200), details: z.string().max(1000).nullable().optional() }))
    .max(40)
    .optional(),
  sources: z
    .array(z.object({ title: z.string().min(2).max(200), url: httpsUrl, is_primary: z.boolean().default(false) }))
    .max(10)
    .optional(),
});
export type ServiceWrite = z.infer<typeof serviceWriteBody>;

export const servicePatchBody = serviceWriteBody
  .partial()
  .refine((o) => Object.keys(o).length > 0, 'Nothing to update');

export const verifyBody = z.object({
  to_status: z.enum(['verified', 'awaiting_verification', 'outdated', 'link_broken', 'demonstration']),
  notes: z.string().max(1000).optional(),
  next_review_days: z.number().int().min(1).max(730).optional(),
});

export const feedbackPatchBody = z.object({
  status: z.enum(['open', 'reviewing', 'resolved', 'dismissed']),
});

export const roleChangeBody = z.object({
  role: z.enum(['user', 'super_admin', 'content_admin', 'reviewer']),
});

export const uuidParam = z.object({ id: z.string().uuid() });
