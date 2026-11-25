/**
 * Bounded sliding-window rate limiter for authentication & reset endpoints.
 * Keeps state per Node/Edge instance with automatic eviction of stale keys.
 */
interface BucketEntry {
  timestamps: number[];
}

const buckets = new Map<string, BucketEntry>();
const MAX_BUCKETS = 5000;

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const cutoff = now - windowMs;

  if (buckets.size > MAX_BUCKETS) {
    for (const [k, entry] of buckets.entries()) {
      const fresh = entry.timestamps.filter((t) => t > cutoff);
      if (fresh.length === 0) {
        buckets.delete(k);
      } else {
        entry.timestamps = fresh;
      }
    }
  }

  const existing = buckets.get(key);
  const recent = existing ? existing.timestamps.filter((t) => t > cutoff) : [];

  if (recent.length >= maxRequests) {
    const oldest = recent[0] ?? now;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    buckets.set(key, { timestamps: recent });
    return { allowed: false, retryAfterSeconds };
  }

  recent.push(now);
  buckets.set(key, { timestamps: recent });
  return { allowed: true, retryAfterSeconds: 0 };
}

export function resetRateLimitBuckets() {
  buckets.clear();
}
