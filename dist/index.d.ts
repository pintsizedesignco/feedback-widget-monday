import * as react from 'react';

interface FeedbackSubmission {
    name: string;
    message: string;
    category: string;
    website?: string;
    pageUrl: string;
    pageTitle: string;
    userAgent: string;
    viewportWidth: number;
    viewportHeight: number;
    submittedAt: string;
}
interface FeedbackSubmissionResult {
    success: boolean;
    mondayItemId: string;
}
interface FeedbackWidgetProps {
    /** Where to POST submissions. Default: "/api/feedback" (same-origin, proxied/reverse-proxied in production). */
    endpoint?: string;
    /** Override auto-detected brand color (any valid CSS color). */
    brandColor?: string;
    /** Category options shown as buttons. Default: ["Design", "Content", "Bug", "Other"]. */
    categories?: string[];
    /** Panel heading. Default: "Got feedback?" */
    title?: string;
    /** Panel subtext. Default: "Tell us what's working or what's not." */
    description?: string;
    /** localStorage key used to remember the submitter's name. Default: "feedback-widget-name". */
    storageKey?: string;
    /** Custom trigger button icon. Default: a generic message-bubble icon. */
    icon?: React.ReactNode;
}

declare function FeedbackWidget({ endpoint, brandColor, categories, title, description, storageKey, icon, }: FeedbackWidgetProps): react.JSX.Element;

declare const DEFAULT_BRAND_COLOR = "#4F46E5";
/**
 * Best-effort detection of the host page's brand color: checks common CSS
 * custom property names first, then falls back to sampling the background
 * color of the first prominent-looking button/link, then a sane default.
 * Runs client-side only (returns the default during SSR).
 */
declare function detectBrandColor(): string;
/** Picks black or white text for readable contrast against the given color. */
declare function getContrastColor(color: string): string;
/**
 * Resolves the widget's brand color: uses `override` if provided, otherwise
 * auto-detects from the host page on mount. Returns the default color
 * synchronously (SSR-safe) until detection runs.
 */
declare function useBrandColor(override?: string): {
    color: string;
    foreground: string;
};

export { DEFAULT_BRAND_COLOR, type FeedbackSubmission, type FeedbackSubmissionResult, FeedbackWidget, type FeedbackWidgetProps, detectBrandColor, getContrastColor, useBrandColor };
