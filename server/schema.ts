import { z } from "zod";

// Files (screenshot/attachment) travel as multipart parts handled by multer,
// never as base64 text in this body — a WAF on at least one production host
// blocks base64 image payloads outright regardless of wrapper format, so the
// only reliable fix is real binary multipart upload instead of JSON/text.
export const FeedbackSubmissionSchema = z.object({
  name: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  category: z.string().min(1).max(50),
  website: z.string().optional(), // honeypot — must stay empty
  pageUrl: z.string(),
  pageTitle: z.string(),
  userAgent: z.string(),
  // Multipart text fields always arrive as strings, unlike JSON bodies.
  viewportWidth: z.coerce.number(),
  viewportHeight: z.coerce.number(),
  submittedAt: z.coerce.date(),
});

export type FeedbackSubmissionInput = z.infer<typeof FeedbackSubmissionSchema>;
