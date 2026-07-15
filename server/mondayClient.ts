const MONDAY_API_URL = "https://api.monday.com/v2";

export interface FeedbackMondayFields {
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

export class MondayApiError extends Error {}

function truncate(text: string, maxLength: number): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > maxLength ? `${collapsed.slice(0, maxLength - 1)}…` : collapsed;
}

function buildItemName(fields: FeedbackMondayFields): string {
  return `[${fields.category.toUpperCase()}] ${truncate(fields.message, 80)}`;
}

function buildColumnValues(
  fields: FeedbackMondayFields,
  columnMap: Record<string, string | null>,
): Record<string, string> {
  const values: Record<string, string> = {};
  const fieldByKey: Record<string, string> = {
    name: fields.name,
    category: fields.category,
    pageUrl: fields.pageUrl,
    pageTitle: fields.pageTitle,
    userAgent: fields.userAgent,
    viewport: `${fields.viewportWidth}x${fields.viewportHeight}`,
    submittedAt: fields.submittedAt,
  };

  for (const [key, columnId] of Object.entries(columnMap)) {
    if (columnId && fieldByKey[key] !== undefined) {
      values[columnId] = fieldByKey[key];
    }
  }

  return values;
}

function buildUpdateBody(fields: FeedbackMondayFields): string {
  return [
    `Name: ${fields.name}`,
    `Category: ${fields.category}`,
    `Message: ${fields.message}`,
    `Page: ${fields.pageTitle} (${fields.pageUrl})`,
    `Viewport: ${fields.viewportWidth}x${fields.viewportHeight}`,
    `User agent: ${fields.userAgent}`,
    `Submitted at: ${fields.submittedAt}`,
  ].join("\n");
}

interface MondayApiResponse {
  data?: Record<string, any>;
  errors?: unknown;
}

async function callMondayApi(
  token: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<Record<string, any>> {
  const response = await fetch(MONDAY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({ query, variables }),
  });

  const body = (await response.json()) as MondayApiResponse;

  if (!response.ok || body.errors) {
    throw new MondayApiError(
      `monday.com API error: ${response.status} ${JSON.stringify(body.errors ?? body)}`,
    );
  }

  return body.data ?? {};
}

export interface MondayFeedbackItem {
  itemId: string;
  updateId: string;
}

/**
 * Creates an item on the configured monday.com board for a feedback submission,
 * then attaches the full submission details as an update (comment) on that item
 * so nothing is lost even for columns not yet mapped in columnMap.
 */
export async function createMondayFeedbackItem(
  token: string,
  boardId: string,
  fields: FeedbackMondayFields,
  columnMap: Record<string, string | null> = {},
): Promise<MondayFeedbackItem> {
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
    columnValues: Object.keys(columnValues).length > 0 ? JSON.stringify(columnValues) : undefined,
  });

  const itemId: string = createItemData.create_item.id;

  const createUpdateQuery = `
    mutation CreateFeedbackUpdate($itemId: ID!, $body: String!) {
      create_update(item_id: $itemId, body: $body) {
        id
      }
    }
  `;

  const createUpdateData = await callMondayApi(token, createUpdateQuery, {
    itemId,
    body: buildUpdateBody(fields),
  });

  const updateId: string = createUpdateData.create_update.id;

  return { itemId, updateId };
}

/**
 * Attaches a file to a monday.com update via the dedicated file-upload endpoint
 * (a plain GraphQL POST can't carry binary parts). The update_id is inlined into
 * the query string rather than passed as a variable — it's a monday-generated
 * numeric id (never user input), and the file-upload endpoint's simplified
 * multipart convention (`variables[file]`) doesn't cleanly support mixing a
 * scalar variable alongside the file variable.
 */
export async function uploadFileToMondayUpdate(
  token: string,
  updateId: string,
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<void> {
  if (!/^\d+$/.test(updateId)) {
    throw new MondayApiError(`Refusing to upload file: unexpected update_id "${updateId}"`);
  }

  const form = new FormData();
  form.append(
    "query",
    `mutation ($file: File!) { add_file_to_update (update_id: ${updateId}, file: $file) { id } }`,
  );
  form.append("variables[file]", new Blob([new Uint8Array(buffer)], { type: mimeType }), filename);

  const response = await fetch("https://api.monday.com/v2/file", {
    method: "POST",
    headers: { Authorization: token },
    body: form,
  });

  const body = (await response.json()) as MondayApiResponse;

  if (!response.ok || body.errors) {
    throw new MondayApiError(
      `monday.com file upload error: ${response.status} ${JSON.stringify(body.errors ?? body)}`,
    );
  }
}
