import { Router, type IRouter } from "express";
import { FeedbackSubmissionSchema } from "./schema";
import { rateLimit } from "./rateLimit";
import { createMondayFeedbackItem, uploadFileToMondayUpdate } from "./mondayClient";

const MAX_DECODED_BYTES = 4 * 1024 * 1024;
const DATA_URL_PATTERN = /^data:([^;]+);base64,(.+)$/s;

interface DecodedImage {
  mimeType: string;
  buffer: Buffer;
}

function decodeDataUrl(dataUrl: string): DecodedImage | null {
  const match = DATA_URL_PATTERN.exec(dataUrl);
  if (!match) return null;

  const [, mimeType, base64] = match;
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length > MAX_DECODED_BYTES) return null;

  return { mimeType, buffer };
}

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
    const parsed = FeedbackSubmissionSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ message: "Invalid feedback submission." });
      return;
    }

    const { website, screenshot, attachment, attachmentFilename, ...fields } = parsed.data;

    // Honeypot: real users never fill this hidden field. Silently pretend
    // success so bots don't learn they were filtered.
    if (website) {
      res.status(200).json({ success: true, mondayItemId: "" });
      return;
    }

    const decodedScreenshot = screenshot ? decodeDataUrl(screenshot) : null;
    if (screenshot && !decodedScreenshot) {
      res.status(400).json({ message: "Screenshot is invalid or exceeds the 4MB limit." });
      return;
    }

    const decodedAttachment = attachment ? decodeDataUrl(attachment) : null;
    if (attachment && !decodedAttachment) {
      res.status(400).json({ message: "Attachment is invalid or exceeds the 4MB limit." });
      return;
    }

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
        if (decodedScreenshot) {
          try {
            await uploadFileToMondayUpdate(
              mondayApiToken,
              updateId,
              decodedScreenshot.buffer,
              `screenshot.${extensionForMimeType(decodedScreenshot.mimeType)}`,
              decodedScreenshot.mimeType,
            );
          } catch (err) {
            logger.error({ err }, "Failed to attach screenshot to monday.com update");
          }
        }

        if (decodedAttachment) {
          try {
            await uploadFileToMondayUpdate(
              mondayApiToken,
              updateId,
              decodedAttachment.buffer,
              attachmentFilename || `attachment.${extensionForMimeType(decodedAttachment.mimeType)}`,
              decodedAttachment.mimeType,
            );
          } catch (err) {
            logger.error({ err }, "Failed to attach image to monday.com update");
          }
        }
      })
      .catch((err) => {
        logger.error({ err }, "Failed to create monday.com feedback item");
        res.status(502).json({ message: "Failed to submit feedback. Please try again later." });
      });
  });

  return router;
}
