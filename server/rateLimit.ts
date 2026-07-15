import type { NextFunction, Request, Response } from "express";

interface RateLimitOptions {
  windowMs: number;
  max: number;
}

/**
 * Minimal in-memory sliding-window rate limiter, keyed by req.ip.
 * Single-process only (state resets on restart, not shared across instances) —
 * sufficient for a low-traffic feedback form; not a substitute for a
 * distributed limiter if this service is ever scaled horizontally.
 */
export function rateLimit({ windowMs, max }: RateLimitOptions) {
  const hits = new Map<string, number[]>();

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const windowStart = now - windowMs;

    const timestamps = (hits.get(key) ?? []).filter((t) => t > windowStart);

    if (timestamps.length >= max) {
      res.status(429).json({ message: "Too many requests. Please try again shortly." });
      return;
    }

    timestamps.push(now);
    hits.set(key, timestamps);
    next();
  };
}
