import { IRouter, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

interface CreateFeedbackRouterOptions {
    /** monday.com API v2 token (server-side only — never expose this to the browser). */
    mondayApiToken: string;
    /** Target board id for created items. */
    mondayBoardId: string;
    /**
     * Maps feedback fields to monday.com column IDs (find these via the board's
     * "..." menu > integrate, or the API). Fields left unmapped are simply
     * omitted from column_values — the full submission is always included in
     * the item's update regardless, so no data is lost either way.
     */
    columnMap?: Record<string, string | null>;
    /** Per-IP submission limit. Default: 5 requests per 60 seconds. */
    rateLimit?: {
        windowMs: number;
        max: number;
    };
    /** Route path mounted under the router. Default: "/feedback". */
    path?: string;
    logger?: {
        error: (obj: unknown, msg?: string) => void;
    };
}
/**
 * Creates an Express router with a single POST route that validates a
 * feedback submission, rejects honeypot-filled bot submissions silently,
 * rate-limits by IP, creates a monday.com item + update, and best-effort
 * attaches any screenshot/uploaded image as files on that update.
 *
 * Mount it under your API prefix, e.g.:
 *   app.use("/api", createFeedbackRouter({ mondayApiToken, mondayBoardId }));
 */
declare function createFeedbackRouter(options: CreateFeedbackRouterOptions): IRouter;

interface FeedbackMondayFields {
    name: string;
    message: string;
    category: string;
    pageUrl: string;
    pageTitle: string;
    userAgent: string;
    viewportWidth: number;
    viewportHeight: number;
    submittedAt: string;
}
declare class MondayApiError extends Error {
}
interface MondayFeedbackItem {
    itemId: string;
    updateId: string;
}
/**
 * Creates an item on the configured monday.com board for a feedback submission,
 * then attaches the full submission details as an update (comment) on that item
 * so nothing is lost even for columns not yet mapped in columnMap.
 */
declare function createMondayFeedbackItem(token: string, boardId: string, fields: FeedbackMondayFields, columnMap?: Record<string, string | null>): Promise<MondayFeedbackItem>;
/**
 * Attaches a file to a monday.com update via the dedicated file-upload endpoint
 * (a plain GraphQL POST can't carry binary parts). The update_id is inlined into
 * the query string rather than passed as a variable — it's a monday-generated
 * numeric id (never user input), and the file-upload endpoint's simplified
 * multipart convention (`variables[file]`) doesn't cleanly support mixing a
 * scalar variable alongside the file variable.
 */
declare function uploadFileToMondayUpdate(token: string, updateId: string, buffer: Buffer, filename: string, mimeType: string): Promise<void>;

interface RateLimitOptions {
    windowMs: number;
    max: number;
}
/**
 * Minimal in-memory sliding-window rate limiter, keyed by req.ip.
 * Single-process only (state resets on restart, not shared across instances) —
 * sufficient for a low-traffic feedback form; not a substitute for a
 * distributed limiter if this service is ever scaled horizontally.
 */
declare function rateLimit({ windowMs, max }: RateLimitOptions): (req: Request, res: Response, next: NextFunction) => void;

declare const FeedbackSubmissionSchema: z.ZodObject<{
    name: z.ZodString;
    message: z.ZodString;
    category: z.ZodString;
    website: z.ZodOptional<z.ZodString>;
    pageUrl: z.ZodString;
    pageTitle: z.ZodString;
    userAgent: z.ZodString;
    viewportWidth: z.ZodNumber;
    viewportHeight: z.ZodNumber;
    submittedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    name: string;
    message: string;
    category: string;
    pageUrl: string;
    pageTitle: string;
    userAgent: string;
    viewportWidth: number;
    viewportHeight: number;
    submittedAt: Date;
    website?: string | undefined;
}, {
    name: string;
    message: string;
    category: string;
    pageUrl: string;
    pageTitle: string;
    userAgent: string;
    viewportWidth: number;
    viewportHeight: number;
    submittedAt: Date;
    website?: string | undefined;
}>;
type FeedbackSubmissionInput = z.infer<typeof FeedbackSubmissionSchema>;

export { type CreateFeedbackRouterOptions, type FeedbackMondayFields, type FeedbackSubmissionInput, FeedbackSubmissionSchema, MondayApiError, type MondayFeedbackItem, createFeedbackRouter, createMondayFeedbackItem, rateLimit, uploadFileToMondayUpdate };
