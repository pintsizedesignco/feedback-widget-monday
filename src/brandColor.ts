import { useEffect, useState } from "react";

export const DEFAULT_BRAND_COLOR = "#4F46E5";

// Common CSS custom property names used by popular design systems
// (shadcn/ui, Tailwind-based themes, Bootstrap-style tokens, etc.), checked
// in priority order.
const CANDIDATE_VARS = [
  "--primary",
  "--color-primary",
  "--brand",
  "--brand-primary",
  "--brand-color",
  "--accent",
  "--color-accent",
  "--theme-color",
  "--theme-primary",
];

function normalizeToRgb(color: string): [number, number, number] | null {
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

function isUsableBrandColor(rgb: [number, number, number] | null, raw: string): boolean {
  if (!rgb) return false;
  if (raw === "transparent" || raw === "rgba(0, 0, 0, 0)") return false;
  const [r, g, b] = rgb;
  const isNearWhite = r > 240 && g > 240 && b > 240;
  const isNearBlack = r < 20 && g < 20 && b < 20;
  return !isNearWhite && !isNearBlack;
}

/**
 * Best-effort detection of the host page's brand color: checks common CSS
 * custom property names first, then falls back to sampling the background
 * color of the first prominent-looking button/link, then a sane default.
 * Runs client-side only (returns the default during SSR).
 */
export function detectBrandColor(): string {
  if (typeof document === "undefined") return DEFAULT_BRAND_COLOR;

  const rootStyle = getComputedStyle(document.documentElement);
  for (const varName of CANDIDATE_VARS) {
    const value = rootStyle.getPropertyValue(varName).trim();
    if (value && isUsableBrandColor(normalizeToRgb(value), value)) return value;
  }

  const candidates = document.querySelectorAll<HTMLElement>('button, a[class], [role="button"]');
  for (const el of candidates) {
    const bg = getComputedStyle(el).backgroundColor;
    if (isUsableBrandColor(normalizeToRgb(bg), bg)) return bg;
  }

  return DEFAULT_BRAND_COLOR;
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** Picks black or white text for readable contrast against the given color. */
export function getContrastColor(color: string): string {
  const rgb = normalizeToRgb(color);
  if (!rgb) return "#ffffff";
  return relativeLuminance(rgb) > 0.6 ? "#0a0a0a" : "#ffffff";
}

/**
 * Resolves the widget's brand color: uses `override` if provided, otherwise
 * auto-detects from the host page on mount. Returns the default color
 * synchronously (SSR-safe) until detection runs.
 */
export function useBrandColor(override?: string): { color: string; foreground: string } {
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
