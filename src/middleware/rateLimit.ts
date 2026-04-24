import type { RequestHandler } from 'express';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  const buckets = new Map<string, Bucket>();
  const windowMs = options.windowMs;
  const maxRequests = options.maxRequests;

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }, Math.min(windowMs, 60_000));
  cleanup.unref();

  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${options.keyPrefix}:${ip}`;
    const current = buckets.get(key);

    const bucket = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : current;

    bucket.count += 1;
    buckets.set(key, bucket);

    const remaining = Math.max(maxRequests - bucket.count, 0);
    const retryAfterSeconds = Math.max(Math.ceil((bucket.resetAt - now) / 1000), 1);

    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > maxRequests) {
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json({ error: 'Too many requests' });
      return;
    }

    next();
  };
}
