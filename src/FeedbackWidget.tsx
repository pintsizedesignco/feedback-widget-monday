import { useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useBrandColor } from "./brandColor";
import { ensureStylesInjected } from "./styles";
import ElementPicker, { type CapturedImage } from "./ElementPicker";
import { MessageIcon, CloseIcon, CrosshairIcon, PaperclipIcon, CheckIcon } from "./icons";
import type { FeedbackWidgetProps, FeedbackSubmissionResult } from "./types";

// Strips the "data:<mime>;base64," prefix for the manually-uploaded image,
// same reasoning as ElementPicker's toRawBase64 — that literal string trips
// a common WAF/ModSecurity data-URI detection rule on some hosts.
function toRawBase64(dataUrl: string): CapturedImage {
  const commaIndex = dataUrl.indexOf(",");
  const meta = dataUrl.slice(5, dataUrl.indexOf(";"));
  return { base64: dataUrl.slice(commaIndex + 1), mimeType: meta || "application/octet-stream" };
}

const DEFAULT_CATEGORIES = ["Design", "Content", "Bug", "Other"];
const DEFAULT_STORAGE_KEY = "feedback-widget-name";
const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
const TOAST_DURATION_MS = 3000;

interface ToastState {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}

function getRememberedName(storageKey: string): string {
  try {
    return localStorage.getItem(storageKey) ?? "";
  } catch {
    return "";
  }
}

export default function FeedbackWidget({
  endpoint = "/api/feedback",
  brandColor,
  categories = DEFAULT_CATEGORIES,
  title = "Got feedback?",
  description = "Tell us what's working or what's not.",
  storageKey = DEFAULT_STORAGE_KEY,
  icon,
}: FeedbackWidgetProps) {
  useEffect(() => {
    ensureStylesInjected();
  }, []);

  const { color, foreground } = useBrandColor(brandColor);

  const [open, setOpen] = useState(false);
  const [rememberedName, setRememberedName] = useState(() => getRememberedName(storageKey));
  const [name, setName] = useState(() => getRememberedName(storageKey));
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState(categories[categories.length - 1] ?? "");
  const [website, setWebsite] = useState(""); // honeypot
  const [errors, setErrors] = useState<{ name?: string; message?: string }>({});

  const [isPicking, setIsPicking] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [screenshot, setScreenshot] = useState<CapturedImage | null>(null);
  const [attachment, setAttachment] = useState<CapturedImage | null>(null);
  const [attachmentFilename, setAttachmentFilename] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = (t: ToastState) => {
    setToast(t);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  };

  useEffect(() => () => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
  }, []);

  const resetAttachments = () => {
    setScreenshot(null);
    setAttachment(null);
    setAttachmentFilename(null);
  };

  const handleChangeUser = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // no-op — remembering the name is a nice-to-have, not required.
    }
    setRememberedName("");
    setName("");
  };

  const handleStartPicking = () => {
    setOpen(false);
    setIsPicking(true);
  };

  const handleCapture = (image: CapturedImage) => {
    setScreenshot(image);
    setIsPicking(false);
    setOpen(true);
  };

  const handleCancelPicking = () => {
    setIsPicking(false);
    setOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setAttachment(toRawBase64(reader.result as string));
      setAttachmentFilename(file.name);
    };
    reader.readAsDataURL(file);
  };

  const validate = (): boolean => {
    const next: { name?: string; message?: string } = {};
    if (!name.trim()) next.name = "Name is required.";
    if (!message.trim()) next.message = "Feedback is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
          submittedAt: new Date().toISOString(),
          screenshotBase64: screenshot?.base64 ?? undefined,
          screenshotMimeType: screenshot?.mimeType ?? undefined,
          attachmentBase64: attachment?.base64 ?? undefined,
          attachmentMimeType: attachment?.mimeType ?? undefined,
          attachmentFilename: attachmentFilename ?? undefined,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      (await response.json()) as FeedbackSubmissionResult;

      showToast({ title: "Thanks for the feedback!", description: "We read every note that comes through." });
      try {
        localStorage.setItem(storageKey, name);
      } catch {
        // no-op — see above
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
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const rootStyle = { "--fw-primary": color, "--fw-primary-contrast": foreground } as React.CSSProperties;

  return (
    <div style={rootStyle}>
      <ElementPicker
        active={isPicking}
        onCapture={handleCapture}
        onCancel={handleCancelPicking}
        onCapturing={setIsCapturing}
      />

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Trigger asChild>
          <button type="button" aria-label="Give feedback" data-fw-ignore className="fw-trigger">
            {icon ?? <MessageIcon />}
          </button>
        </DialogPrimitive.Trigger>

        <DialogPrimitive.Portal>
          <DialogPrimitive.Content className="fw-panel">
            <DialogPrimitive.Close className="fw-close" aria-label="Close">
              <CloseIcon />
            </DialogPrimitive.Close>

            <DialogPrimitive.Title className="fw-title">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="fw-description">{description}</DialogPrimitive.Description>

            <form className="fw-form" onSubmit={handleSubmit}>
              {/* Honeypot: hidden from real users via CSS, left empty by them; bots that autofill it get silently dropped server-side. */}
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="fw-honeypot"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />

              <div className="fw-field">
                <div className="fw-label-row">
                  <label className="fw-label" htmlFor="fw-name">Name</label>
                  {rememberedName && (
                    <button type="button" className="fw-link-button" onClick={handleChangeUser}>
                      Not you? Change user
                    </button>
                  )}
                </div>
                <input
                  id="fw-name"
                  className="fw-input"
                  placeholder="Jane"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {errors.name && <span className="fw-error">{errors.name}</span>}
              </div>

              <div className="fw-field">
                <label className="fw-label">Category</label>
                <div className="fw-category-grid">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className="fw-category-btn"
                      aria-pressed={category === cat}
                      onClick={() => setCategory(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="fw-field">
                <label className="fw-label" htmlFor="fw-message">Feedback</label>

                <div className="fw-attach-row">
                  <button
                    type="button"
                    className="fw-attach-btn"
                    data-active={screenshot ? "true" : "false"}
                    disabled={isCapturing}
                    onClick={handleStartPicking}
                    title={screenshot ? "Screenshot captured — click to recapture" : "Capture a part of the page"}
                  >
                    {screenshot ? <CheckIcon /> : <CrosshairIcon />}
                    <span className="fw-attach-label">
                      {isCapturing ? "Capturing…" : screenshot ? "Captured" : "Capture element"}
                    </span>
                    {screenshot && (
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label="Remove screenshot"
                        className="fw-attach-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          setScreenshot(null);
                        }}
                      >
                        <CloseIcon />
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    className="fw-attach-btn"
                    data-active={attachment ? "true" : "false"}
                    onClick={() => fileInputRef.current?.click()}
                    title={attachmentFilename ? `${attachmentFilename} — click to replace` : "Attach an image (max 4MB)"}
                  >
                    {attachment ? <CheckIcon /> : <PaperclipIcon />}
                    <span className="fw-attach-label">{attachment ? (attachmentFilename ?? "Attached") : "Attach image"}</span>
                    {attachment && (
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label="Remove attachment"
                        className="fw-attach-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAttachment(null);
                          setAttachmentFilename(null);
                        }}
                      >
                        <CloseIcon />
                      </span>
                    )}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
                </div>

                <textarea
                  id="fw-message"
                  className="fw-textarea"
                  rows={4}
                  placeholder="Tell us what's working or what's not..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                {errors.message && <span className="fw-error">{errors.message}</span>}
              </div>

              <button type="submit" className="fw-submit" disabled={isSubmitting}>
                {isSubmitting ? "Sending…" : "Send feedback"}
              </button>
            </form>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {toast && (
        <div className="fw-toast" data-variant={toast.variant ?? "default"} role="status">
          <p className="fw-toast-title">{toast.title}</p>
          {toast.description && <p className="fw-toast-description">{toast.description}</p>}
        </div>
      )}
    </div>
  );
}
