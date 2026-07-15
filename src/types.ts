export interface FeedbackSubmission {
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
  screenshot?: string;
  attachment?: string;
  attachmentFilename?: string;
}

export interface FeedbackSubmissionResult {
  success: boolean;
  mondayItemId: string;
}

export interface FeedbackWidgetProps {
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
