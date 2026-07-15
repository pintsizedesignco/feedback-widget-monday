# feedback-widget-monday

A drop-in floating feedback widget for React apps. Users can leave feedback,
pick a category, capture a screenshot of any element on the page (Chrome
DevTools inspect-style), or attach an image — submissions are filed as items
on a monday.com board.

The widget auto-detects your site's brand color (checks common CSS custom
properties, falls back to sampling a prominent button's background color) so
it themes itself without configuration. You can also pass an explicit color.

## Install

```bash
npm install github:pintsizedesignco/feedback-widget-monday
```

## Client usage

```tsx
import { FeedbackWidget } from "feedback-widget-monday";

function App() {
  return (
    <>
      {/* ...your app... */}
      <FeedbackWidget />
    </>
  );
}
```

### Props

| Prop           | Type        | Default                                          | Description |
|----------------|-------------|---------------------------------------------------|--------------|
| `endpoint`     | `string`    | `"/api/feedback"`                                  | Where to POST submissions. |
| `brandColor`   | `string`    | auto-detected                                     | Any valid CSS color, overrides auto-detection. |
| `categories`   | `string[]`  | `["Design", "Content", "Bug", "Other"]`            | Category button options. |
| `title`        | `string`    | `"Got feedback?"`                                  | Panel heading. |
| `description`  | `string`    | `"Tell us what's working or what's not."`          | Panel subtext. |
| `storageKey`   | `string`    | `"feedback-widget-name"`                           | localStorage key used to remember the submitter's name. |
| `icon`         | `ReactNode` | a generic message-bubble icon                     | Custom trigger button icon. |

No CSS import needed — styles are injected automatically on mount, scoped
under `.fw-*` class names so they won't collide with your app's styles.

## Server usage (Express)

```ts
import express from "express";
import { createFeedbackRouter } from "feedback-widget-monday/server";

const app = express();
app.use(express.json({ limit: "12mb" })); // screenshots/attachments are base64 in the JSON body

app.use("/api", createFeedbackRouter({
  mondayApiToken: process.env.MONDAY_API_TOKEN!,
  mondayBoardId: process.env.MONDAY_BOARD_ID!,
  columnMap: {
    // Optional — map fields to monday.com column IDs (find these via the
    // board's "..." menu > Integrate, or the API). Leave a field out (or
    // null) until you know its column ID: the full submission is always
    // included in the item's update (comment) regardless, so nothing is
    // lost in the meantime.
    name: null,
    category: null,
    pageUrl: null,
    pageTitle: null,
    userAgent: null,
    viewport: null,
    submittedAt: null,
  },
}));
```

`app.set("trust proxy", 1)` if you're behind a reverse proxy / autoscale
deployment — the rate limiter keys on `req.ip`, which needs that to resolve
correctly.

### Required environment variables

- `MONDAY_API_TOKEN` — a monday.com API v2 token with write access to the target board. **Server-side only — never expose this in browser code.**
- `MONDAY_BOARD_ID` — the target board's ID.

### `createFeedbackRouter` options

| Option           | Type                                  | Default            | Description |
|------------------|----------------------------------------|---------------------|--------------|
| `mondayApiToken` | `string`                              | required            | monday.com API token. |
| `mondayBoardId`  | `string`                              | required            | Target board ID. |
| `columnMap`      | `Record<string, string \| null>`      | `{}`                 | Field → column ID mapping. |
| `rateLimit`      | `{ windowMs: number; max: number }`   | `{ windowMs: 60000, max: 5 }` | Per-IP submission limit. |
| `path`           | `string`                              | `"/feedback"`        | Route path mounted under the router. |
| `logger`         | `{ error: (obj, msg?) => void }`      | `console`            | Swap in your own logger (e.g. pino). |

## How it works

- **Element picker**: click "Capture element" to enter a Chrome-inspect-style
  mode — the panel hides, hovering highlights elements on the page, clicking
  captures it via [html2canvas](https://html2canvas.hertzen.com/) with a
  padded border (matching the surrounding background color) so text isn't
  cropped tight to its bounding box.
- **Manual upload**: attach any image up to 4MB, validated both client- and
  server-side.
- **monday.com item**: created with `[CATEGORY] message` as the item name;
  the full submission (name, category, message, page URL/title, user agent,
  viewport, timestamp) is always posted as an update (comment) on the item,
  and any screenshot/attachment is uploaded as a file on that same update.
- **Honeypot + rate limiting**: a hidden field silently drops bot submissions
  (they get a fake success response so they don't learn they were filtered);
  a per-IP sliding-window limiter caps submissions server-side.
- **Remembered name**: the submitter's name is remembered in `localStorage`
  across visits, with a "Not you? Change user" reset.

## Notes

- Screenshots/attachments are sent as base64 data URLs in the JSON body (not
  multipart) to keep the client dependency-free — make sure your server's
  JSON body limit is raised accordingly (see the Express example above).
- The client bundle has no required peer dependency beyond React —
  `@radix-ui/react-dialog` and `html2canvas` are bundled as regular
  dependencies.
