// server/createFeedbackRouter.ts
import { Router } from "express";

// server/schema.ts
import { z } from "zod";
var FeedbackSubmissionSchema = z.object({
  name: z.string().min(1).max(200),
  message: z.string().min(1).max(5e3),
  category: z.string().min(1).max(50),
  website: z.string().optional(),
  // honeypot — must stay empty
  pageUrl: z.string(),
  pageTitle: z.string(),
  userAgent: z.string(),
  viewportWidth: z.number(),
  viewportHeight: z.number(),
  submittedAt: z.coerce.date(),
  // Raw base64 + mime type, never a "data:...;base64," string — that literal
  // pattern trips a common WAF/ModSecurity data-URI detection rule on some
  // hosts (confirmed blocking requests as small as 68 bytes on one host).
  screenshotBase64: z.string().max(56e5).optional(),
  screenshotMimeType: z.string().max(100).optional(),
  attachmentBase64: z.string().max(56e5).optional(),
  attachmentMimeType: z.string().max(100).optional(),
  attachmentFilename: z.string().max(200).optional()
});

// server/rateLimit.ts
function rateLimit({ windowMs, max }) {
  const hits = /* @__PURE__ */ new Map();
  return function rateLimitMiddleware(req, res, next) {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const windowStart = now - windowMs;
    const timestamps = (hits.get(key) ?? []).filter((t) => t > windowStart);
    if (timestamps.length >= max) {
      res.status(429).json({ message: "Too many requests. Please try again shortly." });
      return;
    }
    timestamps.push(now);
    hits.set(key, timestamps);
    next();
  };
}

// server/mondayClient.ts
var MONDAY_API_URL = "https://api.monday.com/v2";
var MondayApiError = class extends Error {
};
function truncate(text, maxLength) {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > maxLength ? `${collapsed.slice(0, maxLength - 1)}\u2026` : collapsed;
}
function buildItemName(fields) {
  return `[${fields.category.toUpperCase()}] ${truncate(fields.message, 80)}`;
}
function buildColumnValues(fields, columnMap) {
  const values = {};
  const fieldByKey = {
    name: fields.name,
    category: fields.category,
    pageUrl: fields.pageUrl,
    pageTitle: fields.pageTitle,
    userAgent: fields.userAgent,
    viewport: `${fields.viewportWidth}x${fields.viewportHeight}`,
    submittedAt: fields.submittedAt
  };
  for (const [key, columnId] of Object.entries(columnMap)) {
    if (columnId && fieldByKey[key] !== void 0) {
      values[columnId] = fieldByKey[key];
    }
  }
  return values;
}
function buildUpdateBody(fields) {
  return [
    `Name: ${fields.name}`,
    `Category: ${fields.category}`,
    `Message: ${fields.message}`,
    `Page: ${fields.pageTitle} (${fields.pageUrl})`,
    `Viewport: ${fields.viewportWidth}x${fields.viewportHeight}`,
    `User agent: ${fields.userAgent}`,
    `Submitted at: ${fields.submittedAt}`
  ].join("\n");
}
async function callMondayApi(token, query, variables) {
  const response = await fetch(MONDAY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token
    },
    body: JSON.stringify({ query, variables })
  });
  const body = await response.json();
  if (!response.ok || body.errors) {
    throw new MondayApiError(
      `monday.com API error: ${response.status} ${JSON.stringify(body.errors ?? body)}`
    );
  }
  return body.data ?? {};
}
async function createMondayFeedbackItem(token, boardId, fields, columnMap = {}) {
  const columnValues = buildColumnValues(fields, columnMap);
  const createItemQuery = `
    mutation CreateFeedbackItem($boardId: ID!, $itemName: String!, $columnValues: JSON) {
      create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues) {
        id
      }
    }
  `;
  const createItemData = await callMondayApi(token, createItemQuery, {
    boardId,
    itemName: buildItemName(fields),
    columnValues: Object.keys(columnValues).length > 0 ? JSON.stringify(columnValues) : void 0
  });
  const itemId = createItemData.create_item.id;
  const createUpdateQuery = `
    mutation CreateFeedbackUpdate($itemId: ID!, $body: String!) {
      create_update(item_id: $itemId, body: $body) {
        id
      }
    }
  `;
  const createUpdateData = await callMondayApi(token, createUpdateQuery, {
    itemId,
    body: buildUpdateBody(fields)
  });
  const updateId = createUpdateData.create_update.id;
  return { itemId, updateId };
}
async function uploadFileToMondayUpdate(token, updateId, buffer, filename, mimeType) {
  if (!/^\d+$/.test(updateId)) {
    throw new MondayApiError(`Refusing to upload file: unexpected update_id "${updateId}"`);
  }
  const form = new FormData();
  form.append(
    "query",
    `mutation ($file: File!) { add_file_to_update (update_id: ${updateId}, file: $file) { id } }`
  );
  form.append("variables[file]", new Blob([new Uint8Array(buffer)], { type: mimeType }), filename);
  const response = await fetch("https://api.monday.com/v2/file", {
    method: "POST",
    headers: { Authorization: token },
    body: form
  });
  const body = await response.json();
  if (!response.ok || body.errors) {
    throw new MondayApiError(
      `monday.com file upload error: ${response.status} ${JSON.stringify(body.errors ?? body)}`
    );
  }
}

// server/createFeedbackRouter.ts
var MAX_DECODED_BYTES = 4 * 1024 * 1024;
function decodeImage(base64, mimeType) {
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length > MAX_DECODED_BYTES) return null;
  return { mimeType: mimeType || "application/octet-stream", buffer };
}
function extensionForMimeType(mimeType) {
  const subtype = mimeType.split("/")[1] ?? "png";
  return subtype === "jpeg" ? "jpg" : subtype;
}
function createFeedbackRouter(options) {
  const {
    mondayApiToken,
    mondayBoardId,
    columnMap = {},
    rateLimit: rateLimitOptions = { windowMs: 6e4, max: 5 },
    path = "/feedback",
    logger = console
  } = options;
  const router = Router();
  const feedbackRateLimit = rateLimit(rateLimitOptions);
  router.post(path, feedbackRateLimit, (req, res) => {
    const parsed = FeedbackSubmissionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid feedback submission." });
      return;
    }
    const {
      website,
      screenshotBase64,
      screenshotMimeType,
      attachmentBase64,
      attachmentMimeType,
      attachmentFilename,
      ...fields
    } = parsed.data;
    if (website) {
      res.status(200).json({ success: true, mondayItemId: "" });
      return;
    }
    const decodedScreenshot = screenshotBase64 ? decodeImage(screenshotBase64, screenshotMimeType) : null;
    if (screenshotBase64 && !decodedScreenshot) {
      res.status(400).json({ message: "Screenshot is invalid or exceeds the 4MB limit." });
      return;
    }
    const decodedAttachment = attachmentBase64 ? decodeImage(attachmentBase64, attachmentMimeType) : null;
    if (attachmentBase64 && !decodedAttachment) {
      res.status(400).json({ message: "Attachment is invalid or exceeds the 4MB limit." });
      return;
    }
    createMondayFeedbackItem(
      mondayApiToken,
      mondayBoardId,
      { ...fields, submittedAt: fields.submittedAt.toISOString() },
      columnMap
    ).then(async ({ itemId, updateId }) => {
      res.status(200).json({ success: true, mondayItemId: itemId });
      if (decodedScreenshot) {
        try {
          await uploadFileToMondayUpdate(
            mondayApiToken,
            updateId,
            decodedScreenshot.buffer,
            `screenshot.${extensionForMimeType(decodedScreenshot.mimeType)}`,
            decodedScreenshot.mimeType
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
            decodedAttachment.mimeType
          );
        } catch (err) {
          logger.error({ err }, "Failed to attach image to monday.com update");
        }
      }
    }).catch((err) => {
      logger.error({ err }, "Failed to create monday.com feedback item");
      res.status(502).json({ message: "Failed to submit feedback. Please try again later." });
    });
  });
  return router;
}
export {
  FeedbackSubmissionSchema,
  MondayApiError,
  createFeedbackRouter,
  createMondayFeedbackItem,
  rateLimit,
  uploadFileToMondayUpdate
};
//# sourceMappingURL=index.js.map