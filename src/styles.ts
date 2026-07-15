const STYLE_ID = "feedback-widget-monday-styles";

const CSS = `
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

let injected = false;

/** Injects the widget's scoped stylesheet once, regardless of how many widget instances mount. */
export function ensureStylesInjected(): void {
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
