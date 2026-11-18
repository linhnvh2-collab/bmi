import type { NextFunction, Request, Response } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Bộ giới hạn tần suất (rate limit) nhẹ trong bộ nhớ theo địa chỉ IP cho các route AI.
 * Giúp chống gửi quá nhiều yêu cầu trùng lặp và bảo vệ hạn mức Gemini API.
 */
export function createAiRateLimiter(options?: {
  windowMs?: number;
  maxRequests?: number;
}) {
  const windowMs = options?.windowMs ?? 60_000;
  const maxRequests = options?.maxRequests ?? 25;
  const buckets = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const forwarded = req.headers['x-forwarded-for'];
    const clientIp =
      typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : req.ip || 'unknown';

    // Periodic cleanup to avoid unbounded map growth
    if (buckets.size > 2000) {
      for (const [k, v] of buckets.entries()) {
        if (v.resetAt <= now) buckets.delete(k);
      }
    }

    const existing = buckets.get(clientIp);
    if (!existing || existing.resetAt <= now) {
      buckets.set(clientIp, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (existing.count >= maxRequests) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((existing.resetAt - now) / 1000)
      );
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        error: `Bạn đang gửi quá nhiều yêu cầu AI liên tiếp. Vui lòng đợi khoảng ${retryAfterSec} giây rồi thử lại.`,
      });
      return;
    }

    existing.count += 1;
    next();
  };
}
