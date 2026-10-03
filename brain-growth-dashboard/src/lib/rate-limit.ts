/**
 * In-memory per-IP rate limiter for abuse-sensitive routes (auth, resend).
 * Single-process token bucket; for multi-instance prod use a shared store
 * (Upstash Redis). Never throws — fails open if bookkeeping breaks.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetInMs: number;
}

export function rateLimit(key: string, opts?: { limit?: number; windowMs?: number }): RateLimitResult {
  try {
    const limit = opts?.limit ?? 20;
    const windowMs = opts?.windowMs ?? 60_000;
    const now = Date.now();

    // Opportunistic pruning so the map cannot grow unbounded.
    if (buckets.size > 5000) {
      for (const [k, b] of buckets) {
        if (now >= b.resetAt) buckets.delete(k);
        if (buckets.size <= 4000) break;
      }
    }

    const bucketKey = `${key}`;
    const existing = buckets.get(bucketKey);
    if (!existing || now >= existing.resetAt) {
      buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
      return { ok: true, remaining: limit - 1, resetInMs: windowMs };
    }
    if (existing.count >= limit) {
      return { ok: false, remaining: 0, resetInMs: Math.max(0, existing.resetAt - now) };
    }
    existing.count += 1;
    return { ok: true, remaining: limit - existing.count, resetInMs: Math.max(0, existing.resetAt - now) };
  } catch {
    return { ok: true, remaining: 0, resetInMs: 0 };
  }
}
