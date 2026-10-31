interface RateLimitRecord {
  timestamps: number[];
}

// In-memory sliding window map: IP -> array of request timestamps
// Note: Best-effort on serverless platforms as in-memory state is local to warm instances.
const ipLimits = new Map<string, RateLimitRecord>();

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS = 5; // 5 analyses per 10 minutes

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
}

/**
 * Checks in-memory sliding window rate limit for a client IP.
 */
export function checkRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  const record = ipLimits.get(ip) || { timestamps: [] };

  // Remove timestamps outside the sliding window
  const validTimestamps = record.timestamps.filter((ts) => now - ts < WINDOW_MS);

  if (validTimestamps.length >= MAX_REQUESTS) {
    const oldestTimestamp = validTimestamps[0];
    const retryAfterMs = WINDOW_MS - (now - oldestTimestamp);
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));

    ipLimits.set(ip, { timestamps: validTimestamps });

    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  // Record current request
  validTimestamps.push(now);
  ipLimits.set(ip, { timestamps: validTimestamps });

  return {
    allowed: true,
    remaining: MAX_REQUESTS - validTimestamps.length,
  };
}
