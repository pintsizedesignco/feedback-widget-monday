// server/createFeedbackRouter.ts
import { Router } from "express";
import multer from "multer";

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
  // Multipart text fields always arrive as strings, unlike JSON bodies.
  viewportWidth: z.coerce.number(),
  viewportHeight: z.coerce.number(),
  submittedAt: z.coerce.date()
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
var MAX_FILE_BYTES = 4 * 1024 * 1024;
var upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES }
});
var uploadFields = upload.fields([
  { name: "screenshot", maxCount: 1 },
  { name: "attachment", maxCount: 1 }
]);
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
    uploadFields(req, res, (err) => {
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
      if (website) {
        res.status(200).json({ success: true, mondayItemId: "" });
        return;
      }
      const files = req.files;
      const screenshotFile = files?.screenshot?.[0];
      const attachmentFile = files?.attachment?.[0];
      createMondayFeedbackItem(
        mondayApiToken,
        mondayBoardId,
        { ...fields, submittedAt: fields.submittedAt.toISOString() },
        columnMap
      ).then(async ({ itemId, updateId }) => {
        res.status(200).json({ success: true, mondayItemId: itemId });
        if (screenshotFile) {
          try {
            await uploadFileToMondayUpdate(
              mondayApiToken,
              updateId,
              screenshotFile.buffer,
              `screenshot.${extensionForMimeType(screenshotFile.mimetype)}`,
              screenshotFile.mimetype
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
              attachmentFile.mimetype
            );
          } catch (uploadErr) {
            logger.error({ err: uploadErr }, "Failed to attach image to monday.com update");
          }
        }
      }).catch((createErr) => {
        logger.error({ err: createErr }, "Failed to create monday.com feedback item");
        res.status(502).json({ message: "Failed to submit feedback. Please try again later." });
      });
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