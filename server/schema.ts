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
  screenshot: z.string().max(5_600_000).optional(),
  attachment: z.string().max(5_600_000).optional(),
  attachmentFilename: z.string().max(200).optional(),
});

export type FeedbackSubmissionInput = z.infer<typeof FeedbackSubmissionSchema>;
