// src/FeedbackWidget.tsx
import { useEffect as useEffect3, useRef, useState as useState3 } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

// src/brandColor.ts
import { useEffect, useState } from "react";
var DEFAULT_BRAND_COLOR = "#4F46E5";
var CANDIDATE_VARS = [
  "--primary",
  "--color-primary",
  "--brand",
  "--brand-primary",
  "--brand-color",
  "--accent",
  "--color-accent",
  "--theme-color",
  "--theme-primary"
];
function normalizeToRgb(color) {
  if (typeof document === "undefined" || !color) return null;
  const probe = document.createElement("div");
  probe.style.color = color;
  probe.style.display = "none";
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  document.body.removeChild(probe);
  const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(computed);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}
function isUsableBrandColor(rgb, raw) {
  if (!rgb) return false;
  if (raw === "transparent" || raw === "rgba(0, 0, 0, 0)") return false;
  const [r, g, b] = rgb;
  const isNearWhite = r > 240 && g > 240 && b > 240;
  const isNearBlack = r < 20 && g < 20 && b < 20;
  return !isNearWhite && !isNearBlack;
}
function detectBrandColor() {
  if (typeof document === "undefined") return DEFAULT_BRAND_COLOR;
  const rootStyle = getComputedStyle(document.documentElement);
  for (const varName of CANDIDATE_VARS) {
    const value = rootStyle.getPropertyValue(varName).trim();
    if (value && isUsableBrandColor(normalizeToRgb(value), value)) return value;
  }
  const candidates = document.querySelectorAll('button, a[class], [role="button"]');
  for (const el of candidates) {
    const bg = getComputedStyle(el).backgroundColor;
    if (isUsableBrandColor(normalizeToRgb(bg), bg)) return bg;
  }
  return DEFAULT_BRAND_COLOR;
}
function relativeLuminance([r, g, b]) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}
function getContrastColor(color) {
  const rgb = normalizeToRgb(color);
  if (!rgb) return "#ffffff";
  return relativeLuminance(rgb) > 0.6 ? "#0a0a0a" : "#ffffff";
}
function useBrandColor(override) {
  const [color, setColor] = useState(override ?? DEFAULT_BRAND_COLOR);
  useEffect(() => {
    if (override) {
      setColor(override);
      return;
    }
    setColor(detectBrandColor());
  }, [override]);
  return { color, foreground: getContrastColor(color) };
}

// src/styles.ts
var STYLE_ID = "feedback-widget-monday-styles";
var CSS = `
.fw-trigger {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 40;
  width: 56px;
  height: 56px;
  border-radius: 9999px;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.12);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--fw-primary, #4F46E5);
  transition: border-color 0.15s ease, transform 0.15s ease;
}
.fw-trigger:hover {
  border-color: var(--fw-primary, #4F46E5);
  transform: translateY(-1px);
}
.fw-trigger svg {
  width: 26px;
  height: 26px;
}

.fw-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  pointer-events: none;
}

.fw-panel {
  position: fixed;
  bottom: 92px;
  right: 24px;
  z-index: 51;
  width: 340px;
  max-width: calc(100vw - 48px);
  max-height: calc(100vh - 128px);
  overflow-y: auto;
  background: #ffffff;
  color: #111827;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 10px;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.24);
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
.fw-panel:focus { outline: none; }
.fw-panel[data-state="open"] { animation: fw-fade-in 0.15s ease both; }
.fw-panel[data-state="closed"] { animation: fw-fade-out 0.15s ease both; }
@keyframes fw-fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fw-fade-out { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(8px); } }

.fw-close {
  position: absolute;
  top: 14px;
  right: 14px;
  color: #9ca3af;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  line-height: 0;
}
.fw-close:hover { color: #111827; }
.fw-close svg { width: 16px; height: 16px; }

.fw-title { font-size: 16px; font-weight: 600; margin: 0; }
.fw-description { font-size: 13px; color: #6b7280; margin: 4px 0 0; }

.fw-form { display: flex; flex-direction: column; gap: 16px; margin-top: 20px; }
.fw-field { display: flex; flex-direction: column; gap: 6px; }
.fw-label-row { display: flex; align-items: center; justify-content: space-between; }
.fw-label { font-size: 13px; font-weight: 500; }
.fw-link-button {
  font-size: 11px;
  color: #6b7280;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}
.fw-link-button:hover { color: var(--fw-primary, #4F46E5); }

.fw-input, .fw-textarea {
  font: inherit;
  font-size: 14px;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  background: #fff;
  color: #111827;
  width: 100%;
  box-sizing: border-box;
}
.fw-input:focus, .fw-textarea:focus {
  outline: none;
  border-color: var(--fw-primary, #4F46E5);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--fw-primary, #4F46E5) 25%, transparent);
}
.fw-textarea { resize: none; }
.fw-error { font-size: 12px; color: #dc2626; }

.fw-honeypot {
  position: absolute;
  left: -9999px;
  width: 0;
  height: 0;
  opacity: 0;
}

.fw-category-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.fw-category-btn {
  padding: 8px 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  background: #f9fafb;
  color: #6b7280;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
}
.fw-category-btn:hover { border-color: rgba(0, 0, 0, 0.3); }
.fw-category-btn[aria-pressed="true"] {
  background: var(--fw-primary, #4F46E5);
  border-color: var(--fw-primary, #4F46E5);
  color: var(--fw-primary-contrast, #fff);
}

.fw-attach-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.fw-attach-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  font-size: 11px;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  background: #f9fafb;
  color: #6b7280;
  cursor: pointer;
  max-width: 150px;
}
.fw-attach-btn:hover { border-color: rgba(0, 0, 0, 0.3); }
.fw-attach-btn:disabled { opacity: 0.6; cursor: default; }
.fw-attach-btn[data-active="true"] {
  background: color-mix(in srgb, var(--fw-primary, #4F46E5) 12%, white);
  border-color: var(--fw-primary, #4F46E5);
  color: var(--fw-primary, #4F46E5);
}
.fw-attach-btn svg { width: 14px; height: 14px; flex-shrink: 0; }
.fw-attach-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fw-attach-remove { display: inline-flex; margin-left: 2px; }
.fw-attach-remove:hover { color: #111827; }
.fw-attach-remove svg { width: 11px; height: 11px; }

.fw-submit {
  padding: 12px;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-radius: 6px;
  border: none;
  background: var(--fw-primary, #4F46E5);
  color: var(--fw-primary-contrast, #fff);
  cursor: pointer;
}
.fw-submit:hover { filter: brightness(0.94); }
.fw-submit:disabled { opacity: 0.7; cursor: default; }

.fw-picker-highlight {
  position: fixed;
  border: 2px solid var(--fw-primary, #4F46E5);
  background: color-mix(in srgb, var(--fw-primary, #4F46E5) 15%, transparent);
  pointer-events: none;
  z-index: 61;
  transition: top 0.06s ease, left 0.06s ease, width 0.06s ease, height 0.06s ease;
}
.fw-picker-banner {
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: #111827;
  color: #fff;
  font-size: 13px;
  padding: 8px 16px;
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.24);
  z-index: 61;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.fw-toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 70;
  background: #111827;
  color: #fff;
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.28);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  max-width: 300px;
}
.fw-toast[data-variant="destructive"] { background: #dc2626; }
.fw-toast-title { font-size: 13px; font-weight: 600; margin: 0; }
.fw-toast-description { font-size: 12px; opacity: 0.85; margin: 2px 0 0; }
`;
var injected = false;
function ensureStylesInjected() {
  if (injected || typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) {
    injected = true;
    return;
  }
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
  injected = true;
}

// src/ElementPicker.tsx
import { useEffect as useEffect2, useState as useState2 } from "react";
import html2canvas from "html2canvas";
import { jsx, jsxs } from "react/jsx-runtime";
var CAPTURE_PADDING = 24;
function resolveBackgroundColor(el) {
  let current = el;
  while (current) {
    const bg = getComputedStyle(current).backgroundColor;
    if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return bg;
    current = current.parentElement;
  }
  return "#ffffff";
}
async function captureElement(el) {
  const scale = Math.min(2, window.devicePixelRatio || 1);
  const rawCanvas = await html2canvas(el, {
    backgroundColor: null,
    logging: false,
    useCORS: true,
    scale
  });
  const padding = CAPTURE_PADDING * scale;
  const padded = document.createElement("canvas");
  padded.width = rawCanvas.width + padding * 2;
  padded.height = rawCanvas.height + padding * 2;
  const ctx = padded.getContext("2d");
  if (!ctx) return rawCanvas.toDataURL("image/jpeg", 0.72);
  ctx.fillStyle = resolveBackgroundColor(el);
  ctx.fillRect(0, 0, padded.width, padded.height);
  ctx.drawImage(rawCanvas, padding, padding);
  let dataUrl = padded.toDataURL("image/jpeg", 0.72);
  if (dataUrl.length > 4e6) {
    dataUrl = padded.toDataURL("image/jpeg", 0.45);
  }
  return dataUrl;
}
function ElementPicker({ active, onCapture, onCancel, onCapturing }) {
  const [rect, setRect] = useState2(null);
  useEffect2(() => {
    if (!active) return;
    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = "crosshair";
    const onMouseMove = (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-fw-ignore]")) {
        setRect(null);
        return;
      }
      const r = target.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    const onClick = async (e) => {
      const target = e.target;
      if (!(target instanceof Element) || target.closest("[data-fw-ignore]")) return;
      e.preventDefault();
      e.stopPropagation();
      onCapturing(true);
      try {
        const dataUrl = await captureElement(target);
        onCapture(dataUrl);
      } finally {
        onCapturing(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.body.style.cursor = previousCursor;
      document.removeEventListener("mousemove", onMouseMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDown, true);
      setRect(null);
    };
  }, [active, onCapture, onCancel, onCapturing]);
  if (!active) return null;
  return /* @__PURE__ */ jsxs("div", { className: "fw-overlay", "data-fw-ignore": true, children: [
    rect && /* @__PURE__ */ jsx(
      "div",
      {
        className: "fw-picker-highlight",
        style: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
      }
    ),
    /* @__PURE__ */ jsx("div", { className: "fw-picker-banner", children: "Click an element to capture it \u2014 Esc to cancel" })
  ] });
}

// src/icons.tsx
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
function MessageIcon(props) {
  return /* @__PURE__ */ jsx2("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", ...props, children: /* @__PURE__ */ jsx2("path", { d: "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" }) });
}
function CloseIcon(props) {
  return /* @__PURE__ */ jsxs2("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", ...props, children: [
    /* @__PURE__ */ jsx2("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
    /* @__PURE__ */ jsx2("line", { x1: "6", y1: "6", x2: "18", y2: "18" })
  ] });
}
function CrosshairIcon(props) {
  return /* @__PURE__ */ jsxs2("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", ...props, children: [
    /* @__PURE__ */ jsx2("circle", { cx: "12", cy: "12", r: "10" }),
    /* @__PURE__ */ jsx2("line", { x1: "22", y1: "12", x2: "18", y2: "12" }),
    /* @__PURE__ */ jsx2("line", { x1: "6", y1: "12", x2: "2", y2: "12" }),
    /* @__PURE__ */ jsx2("line", { x1: "12", y1: "6", x2: "12", y2: "2" }),
    /* @__PURE__ */ jsx2("line", { x1: "12", y1: "22", x2: "12", y2: "18" })
  ] });
}
function PaperclipIcon(props) {
  return /* @__PURE__ */ jsx2("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", ...props, children: /* @__PURE__ */ jsx2("path", { d: "M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" }) });
}
function CheckIcon(props) {
  return /* @__PURE__ */ jsx2("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", ...props, children: /* @__PURE__ */ jsx2("polyline", { points: "20 6 9 17 4 12" }) });
}

// src/FeedbackWidget.tsx
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
var DEFAULT_CATEGORIES = ["Design", "Content", "Bug", "Other"];
var DEFAULT_STORAGE_KEY = "feedback-widget-name";
var MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
var TOAST_DURATION_MS = 3e3;
function getRememberedName(storageKey) {
  try {
    return localStorage.getItem(storageKey) ?? "";
  } catch {
    return "";
  }
}
function FeedbackWidget({
  endpoint = "/api/feedback",
  brandColor,
  categories = DEFAULT_CATEGORIES,
  title = "Got feedback?",
  description = "Tell us what's working or what's not.",
  storageKey = DEFAULT_STORAGE_KEY,
  icon
}) {
  useEffect3(() => {
    ensureStylesInjected();
  }, []);
  const { color, foreground } = useBrandColor(brandColor);
  const [open, setOpen] = useState3(false);
  const [rememberedName, setRememberedName] = useState3(() => getRememberedName(storageKey));
  const [name, setName] = useState3(() => getRememberedName(storageKey));
  const [message, setMessage] = useState3("");
  const [category, setCategory] = useState3(categories[categories.length - 1] ?? "");
  const [website, setWebsite] = useState3("");
  const [errors, setErrors] = useState3({});
  const [isPicking, setIsPicking] = useState3(false);
  const [isCapturing, setIsCapturing] = useState3(false);
  const [screenshotDataUrl, setScreenshotDataUrl] = useState3(null);
  const [attachmentDataUrl, setAttachmentDataUrl] = useState3(null);
  const [attachmentFilename, setAttachmentFilename] = useState3(null);
  const fileInputRef = useRef(null);
  const [isSubmitting, setIsSubmitting] = useState3(false);
  const [toast, setToast] = useState3(null);
  const toastTimeoutRef = useRef(void 0);
  const showToast = (t) => {
    setToast(t);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  };
  useEffect3(() => () => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
  }, []);
  const resetAttachments = () => {
    setScreenshotDataUrl(null);
    setAttachmentDataUrl(null);
    setAttachmentFilename(null);
  };
  const handleChangeUser = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
    }
    setRememberedName("");
    setName("");
  };
  const handleStartPicking = () => {
    setOpen(false);
    setIsPicking(true);
  };
  const handleCapture = (dataUrl) => {
    setScreenshotDataUrl(dataUrl);
    setIsPicking(false);
    setOpen(true);
  };
  const handleCancelPicking = () => {
    setIsPicking(false);
    setOpen(true);
  };
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast({ title: "Unsupported file", description: "Please choose an image file.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      showToast({ title: "Image too large", description: "Please choose an image under 4MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachmentDataUrl(reader.result);
      setAttachmentFilename(file.name);
    };
    reader.readAsDataURL(file);
  };
  const validate = () => {
    const next = {};
    if (!name.trim()) next.name = "Name is required.";
    if (!message.trim()) next.message = "Feedback is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          message,
          category,
          website,
          pageUrl: window.location.href,
          pageTitle: document.title,
          userAgent: navigator.userAgent,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          submittedAt: (/* @__PURE__ */ new Date()).toISOString(),
          screenshot: screenshotDataUrl ?? void 0,
          attachment: attachmentDataUrl ?? void 0,
          attachmentFilename: attachmentFilename ?? void 0
        })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await response.json();
      showToast({ title: "Thanks for the feedback!", description: "We read every note that comes through." });
      try {
        localStorage.setItem(storageKey, name);
      } catch {
      }
      setRememberedName(name);
      setMessage("");
      setWebsite("");
      resetAttachments();
      setOpen(false);
    } catch {
      showToast({
        title: "Couldn't send feedback",
        description: "Please try again in a moment.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  const rootStyle = { "--fw-primary": color, "--fw-primary-contrast": foreground };
  return /* @__PURE__ */ jsxs3("div", { style: rootStyle, children: [
    /* @__PURE__ */ jsx3(
      ElementPicker,
      {
        active: isPicking,
        onCapture: handleCapture,
        onCancel: handleCancelPicking,
        onCapturing: setIsCapturing
      }
    ),
    /* @__PURE__ */ jsxs3(DialogPrimitive.Root, { open, onOpenChange: setOpen, children: [
      /* @__PURE__ */ jsx3(DialogPrimitive.Trigger, { asChild: true, children: /* @__PURE__ */ jsx3("button", { type: "button", "aria-label": "Give feedback", "data-fw-ignore": true, className: "fw-trigger", children: icon ?? /* @__PURE__ */ jsx3(MessageIcon, {}) }) }),
      /* @__PURE__ */ jsx3(DialogPrimitive.Portal, { children: /* @__PURE__ */ jsxs3(DialogPrimitive.Content, { className: "fw-panel", children: [
        /* @__PURE__ */ jsx3(DialogPrimitive.Close, { className: "fw-close", "aria-label": "Close", children: /* @__PURE__ */ jsx3(CloseIcon, {}) }),
        /* @__PURE__ */ jsx3(DialogPrimitive.Title, { className: "fw-title", children: title }),
        /* @__PURE__ */ jsx3(DialogPrimitive.Description, { className: "fw-description", children: description }),
        /* @__PURE__ */ jsxs3("form", { className: "fw-form", onSubmit: handleSubmit, children: [
          /* @__PURE__ */ jsx3(
            "input",
            {
              type: "text",
              tabIndex: -1,
              autoComplete: "off",
              "aria-hidden": "true",
              className: "fw-honeypot",
              value: website,
              onChange: (e) => setWebsite(e.target.value)
            }
          ),
          /* @__PURE__ */ jsxs3("div", { className: "fw-field", children: [
            /* @__PURE__ */ jsxs3("div", { className: "fw-label-row", children: [
              /* @__PURE__ */ jsx3("label", { className: "fw-label", htmlFor: "fw-name", children: "Name" }),
              rememberedName && /* @__PURE__ */ jsx3("button", { type: "button", className: "fw-link-button", onClick: handleChangeUser, children: "Not you? Change user" })
            ] }),
            /* @__PURE__ */ jsx3(
              "input",
              {
                id: "fw-name",
                className: "fw-input",
                placeholder: "Jane",
                value: name,
                onChange: (e) => setName(e.target.value)
              }
            ),
            errors.name && /* @__PURE__ */ jsx3("span", { className: "fw-error", children: errors.name })
          ] }),
          /* @__PURE__ */ jsxs3("div", { className: "fw-field", children: [
            /* @__PURE__ */ jsx3("label", { className: "fw-label", children: "Category" }),
            /* @__PURE__ */ jsx3("div", { className: "fw-category-grid", children: categories.map((cat) => /* @__PURE__ */ jsx3(
              "button",
              {
                type: "button",
                className: "fw-category-btn",
                "aria-pressed": category === cat,
                onClick: () => setCategory(cat),
                children: cat
              },
              cat
            )) })
          ] }),
          /* @__PURE__ */ jsxs3("div", { className: "fw-field", children: [
            /* @__PURE__ */ jsx3("label", { className: "fw-label", htmlFor: "fw-message", children: "Feedback" }),
            /* @__PURE__ */ jsxs3("div", { className: "fw-attach-row", children: [
              /* @__PURE__ */ jsxs3(
                "button",
                {
                  type: "button",
                  className: "fw-attach-btn",
                  "data-active": screenshotDataUrl ? "true" : "false",
                  disabled: isCapturing,
                  onClick: handleStartPicking,
                  title: screenshotDataUrl ? "Screenshot captured \u2014 click to recapture" : "Capture a part of the page",
                  children: [
                    screenshotDataUrl ? /* @__PURE__ */ jsx3(CheckIcon, {}) : /* @__PURE__ */ jsx3(CrosshairIcon, {}),
                    /* @__PURE__ */ jsx3("span", { className: "fw-attach-label", children: isCapturing ? "Capturing\u2026" : screenshotDataUrl ? "Captured" : "Capture element" }),
                    screenshotDataUrl && /* @__PURE__ */ jsx3(
                      "span",
                      {
                        role: "button",
                        tabIndex: 0,
                        "aria-label": "Remove screenshot",
                        className: "fw-attach-remove",
                        onClick: (e) => {
                          e.stopPropagation();
                          setScreenshotDataUrl(null);
                        },
                        children: /* @__PURE__ */ jsx3(CloseIcon, {})
                      }
                    )
                  ]
                }
              ),
              /* @__PURE__ */ jsxs3(
                "button",
                {
                  type: "button",
                  className: "fw-attach-btn",
                  "data-active": attachmentDataUrl ? "true" : "false",
                  onClick: () => fileInputRef.current?.click(),
                  title: attachmentFilename ? `${attachmentFilename} \u2014 click to replace` : "Attach an image (max 4MB)",
                  children: [
                    attachmentDataUrl ? /* @__PURE__ */ jsx3(CheckIcon, {}) : /* @__PURE__ */ jsx3(PaperclipIcon, {}),
                    /* @__PURE__ */ jsx3("span", { className: "fw-attach-label", children: attachmentDataUrl ? attachmentFilename ?? "Attached" : "Attach image" }),
                    attachmentDataUrl && /* @__PURE__ */ jsx3(
                      "span",
                      {
                        role: "button",
                        tabIndex: 0,
                        "aria-label": "Remove attachment",
                        className: "fw-attach-remove",
                        onClick: (e) => {
                          e.stopPropagation();
                          setAttachmentDataUrl(null);
                          setAttachmentFilename(null);
                        },
                        children: /* @__PURE__ */ jsx3(CloseIcon, {})
                      }
                    )
                  ]
                }
              ),
              /* @__PURE__ */ jsx3("input", { ref: fileInputRef, type: "file", accept: "image/*", style: { display: "none" }, onChange: handleFileChange })
            ] }),
            /* @__PURE__ */ jsx3(
              "textarea",
              {
                id: "fw-message",
                className: "fw-textarea",
                rows: 4,
                placeholder: "Tell us what's working or what's not...",
                value: message,
                onChange: (e) => setMessage(e.target.value)
              }
            ),
            errors.message && /* @__PURE__ */ jsx3("span", { className: "fw-error", children: errors.message })
          ] }),
          /* @__PURE__ */ jsx3("button", { type: "submit", className: "fw-submit", disabled: isSubmitting, children: isSubmitting ? "Sending\u2026" : "Send feedback" })
        ] })
      ] }) })
    ] }),
    toast && /* @__PURE__ */ jsxs3("div", { className: "fw-toast", "data-variant": toast.variant ?? "default", role: "status", children: [
      /* @__PURE__ */ jsx3("p", { className: "fw-toast-title", children: toast.title }),
      toast.description && /* @__PURE__ */ jsx3("p", { className: "fw-toast-description", children: toast.description })
    ] })
  ] });
}
export {
  DEFAULT_BRAND_COLOR,
  FeedbackWidget,
  detectBrandColor,
  getContrastColor,
  useBrandColor
};
//# sourceMappingURL=index.js.map