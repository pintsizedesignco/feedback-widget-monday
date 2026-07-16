import { useEffect, useState } from "react";
import html2canvas from "html2canvas";

interface ElementPickerProps {
  active: boolean;
  onCapture: (dataUrl: string) => void;
  onCancel: () => void;
  onCapturing: (capturing: boolean) => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const CAPTURE_PADDING = 24;

// Walks up the tree for the nearest actual background color, so the padding
// added around the capture blends in rather than showing as a hard edge.
function resolveBackgroundColor(el: Element): string {
  let current: Element | null = el;
  while (current) {
    const bg = getComputedStyle(current).backgroundColor;
    if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return bg;
    current = current.parentElement;
  }
  return "#ffffff";
}

async function captureElement(el: Element): Promise<string> {
  const scale = Math.min(2, window.devicePixelRatio || 1);
  const rawCanvas = await html2canvas(el as HTMLElement, {
    backgroundColor: null,
    logging: false,
    useCORS: true,
    scale,
  });

  // html2canvas clips exactly to the element's own box (no breathing room),
  // which crops descenders/edges tight. Composite it onto a slightly larger
  // canvas filled with the surrounding background color instead.
  const padding = CAPTURE_PADDING * scale;
  const padded = document.createElement("canvas");
  padded.width = rawCanvas.width + padding * 2;
  padded.height = rawCanvas.height + padding * 2;

  const ctx = padded.getContext("2d");
  if (!ctx) return rawCanvas.toDataURL("image/jpeg", 0.72);

  ctx.fillStyle = resolveBackgroundColor(el);
  ctx.fillRect(0, 0, padded.width, padded.height);
  ctx.drawImage(rawCanvas, padding, padding);

  return compressToTarget(padded);
}

// Many hosts run a WAF (ModSecurity/Imunify360 etc.) with a default request
// body limit around ~1MB — well under the 4MB the server itself allows. Stay
// safely under that regardless of what the actual hosting environment turns
// out to be: step down JPEG quality first, then physically downscale the
// canvas if quality alone isn't enough (huge/high-DPI captures don't shrink
// much further from quality alone).
const TARGET_BASE64_BYTES = 700_000;
const QUALITY_STEPS = [0.72, 0.5, 0.35, 0.2];

function compressToTarget(canvas: HTMLCanvasElement): string {
  for (const quality of QUALITY_STEPS) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= TARGET_BASE64_BYTES) return dataUrl;
  }

  // Still too big even at the lowest quality — the pixel dimensions
  // themselves are the problem (e.g. capturing a huge section on a
  // high-DPI display). Downscale and try the quality ladder again.
  const half = document.createElement("canvas");
  half.width = Math.max(1, Math.round(canvas.width / 2));
  half.height = Math.max(1, Math.round(canvas.height / 2));
  const ctx = half.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/jpeg", QUALITY_STEPS[QUALITY_STEPS.length - 1]);
  ctx.drawImage(canvas, 0, 0, half.width, half.height);

  for (const quality of QUALITY_STEPS) {
    const dataUrl = half.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= TARGET_BASE64_BYTES) return dataUrl;
  }

  // Last resort: smallest we can reasonably produce.
  return half.toDataURL("image/jpeg", QUALITY_STEPS[QUALITY_STEPS.length - 1]);
}

/**
 * Chrome-DevTools-inspect-style element picker: while active, highlights the
 * element under the cursor with an overlay and captures it via html2canvas
 * on click. Escape cancels. Renders nothing when inactive.
 */
export default function ElementPicker({ active, onCapture, onCancel, onCapturing }: ElementPickerProps) {
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    if (!active) return;

    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = "crosshair";

    const onMouseMove = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-fw-ignore]")) {
        setRect(null);
        return;
      }
      const r = target.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    const onClick = async (e: MouseEvent) => {
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

    const onKeyDown = (e: KeyboardEvent) => {
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

  return (
    <div className="fw-overlay" data-fw-ignore>
      {rect && (
        <div
          className="fw-picker-highlight"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        />
      )}
      <div className="fw-picker-banner">Click an element to capture it — Esc to cancel</div>
    </div>
  );
}
