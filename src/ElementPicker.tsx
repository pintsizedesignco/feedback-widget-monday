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

  // Compress, falling back to lower quality if the result is still large
  // (defense in depth — server also enforces the ~4MB cap).
  let dataUrl = padded.toDataURL("image/jpeg", 0.72);
  if (dataUrl.length > 4_000_000) {
    dataUrl = padded.toDataURL("image/jpeg", 0.45);
  }
  return dataUrl;
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
