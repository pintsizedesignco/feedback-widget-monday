import { z } from "zod";

export const FeedbackSubmissionSchema = z.object({
  name: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  category: z.string().min(1).max(50),
  website: z.string().optional(), // honeypot — must stay empty
  pageUrl: z.string(),
  pageTitle: z.string(),
  userAgent: z.string(),
  viewportWidth: z.number(),
  viewportHeight: z.number(),
  submittedAt: z.coerce.date(),
  // Raw base64 + mime type, never a "data:...;base64," string — that literal
  // pattern trips a common WAF/ModSecurity data-URI detection rule on some
  // hosts (confirmed blocking requests as small as 68 bytes on one host).
  screenshotBase64: z.string().max(5_600_000).optional(),
  screenshotMimeType: z.string().max(100).optional(),
  attachmentBase64: z.string().max(5_600_000).optional(),
  attachmentMimeType: z.string().max(100).optional(),
  attachmentFilename: z.string().max(200).optional(),
});

export type FeedbackSubmissionInput = z.infer<typeof FeedbackSubmissionSchema>;
