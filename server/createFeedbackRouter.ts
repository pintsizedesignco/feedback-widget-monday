import { Router, type IRouter } from "express";
import multer from "multer";
import { FeedbackSubmissionSchema } from "./schema";
import { rateLimit } from "./rateLimit";
import { createMondayFeedbackItem, uploadFileToMondayUpdate } from "./mondayClient";

const MAX_FILE_BYTES = 4 * 1024 * 1024;

// Files arrive as real multipart parts (binary bytes), never base64 text in
// the JSON/text body — a WAF on at least one production host blocks base64
// image payloads outright (confirmed down to 68 bytes, regardless of
// "data:...;base64," wrapper format), so this is the only reliable fix.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
});

const uploadFields = upload.fields([
  { name: "screenshot", maxCount: 1 },
  { name: "attachment", maxCount: 1 },
]);

function extensionForMimeType(mimeType: string): string {
  const subtype = mimeType.split("/")[1] ?? "png";
  return subtype === "jpeg" ? "jpg" : subtype;
}

export interface CreateFeedbackRouterOptions {
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
  rateLimit?: { windowMs: number; max: number };
  /** Route path mounted under the router. Default: "/feedback". */
  path?: string;
  logger?: { error: (obj: unknown, msg?: string) => void };
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
export function createFeedbackRouter(options: CreateFeedbackRouterOptions): IRouter {
  const {
    mondayApiToken,
    mondayBoardId,
    columnMap = {},
    rateLimit: rateLimitOptions = { windowMs: 60_000, max: 5 },
    path = "/feedback",
    logger = console,
  } = options;

  const router: IRouter = Router();
  const feedbackRateLimit = rateLimit(rateLimitOptions);

  router.post(path, feedbackRateLimit, (req, res) => {
    uploadFields(req, res, (err: unknown) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
          res.status(400).json({ message: "Image exceeds the 4MB limit." });
          return;
        }
        logger.error({ err }, "Failed to process feedback upload");
        res.status(400).json({ message: "Invalid feedback submission." });
        return;
      }

      const parsed = FeedbackSubmissionSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({ message: "Invalid feedback submission." });
        return;
      }

      const { website, ...fields } = parsed.data;

      // Honeypot: real users never fill this hidden field. Silently pretend
      // success so bots don't learn they were filtered.
      if (website) {
        res.status(200).json({ success: true, mondayItemId: "" });
        return;
      }

      const files = req.files as
        | { screenshot?: Express.Multer.File[]; attachment?: Express.Multer.File[] }
        | undefined;
      const screenshotFile = files?.screenshot?.[0];
      const attachmentFile = files?.attachment?.[0];

      createMondayFeedbackItem(
        mondayApiToken,
        mondayBoardId,
        { ...fields, submittedAt: fields.submittedAt.toISOString() },
        columnMap,
      )
        .then(async ({ itemId, updateId }) => {
          res.status(200).json({ success: true, mondayItemId: itemId });

          // File attachment happens after responding: the feedback record itself
          // (item + full-details update) already succeeded, and attaching files is
          // best-effort — a failure here shouldn't turn a successful submission
          // into an error for the user.
          if (screenshotFile) {
            try {
              await uploadFileToMondayUpdate(
                mondayApiToken,
                updateId,
                screenshotFile.buffer,
                `screenshot.${extensionForMimeType(screenshotFile.mimetype)}`,
                screenshotFile.mimetype,
              );
            } catch (uploadErr) {
              logger.error({ err: uploadErr }, "Failed to attach screenshot to monday.com update");
            }
          }

          if (attachmentFile) {
            try {
              await uploadFileToMondayUpdate(
                mondayApiToken,
                updateId,
                attachmentFile.buffer,
                attachmentFile.originalname || `attachment.${extensionForMimeType(attachmentFile.mimetype)}`,
                attachmentFile.mimetype,
              );
            } catch (uploadErr) {
              logger.error({ err: uploadErr }, "Failed to attach image to monday.com update");
            }
          }
        })
        .catch((createErr) => {
          logger.error({ err: createErr }, "Failed to create monday.com feedback item");
          res.status(502).json({ message: "Failed to submit feedback. Please try again later." });
        });
    });
  });

  return router;
}
