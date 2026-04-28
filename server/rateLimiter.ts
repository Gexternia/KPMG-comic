import type { IncomingMessage } from "node:http";

interface RateLimitState {
  resetAtMs: number;
  count: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSec: number;
  resetAtMs: number;
}

const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 5);
const store = new Map<string, RateLimitState>();

function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return req.socket.remoteAddress || "unknown";
}

function cleanupStore(now: number): void {
  for (const [key, state] of store.entries()) {
    if (state.resetAtMs <= now) {
      store.delete(key);
    }
  }
}

export function getRateLimitConfig(): { windowMs: number; maxRequests: number } {
  return {
    windowMs: RATE_LIMIT_WINDOW_MS,
    maxRequests: RATE_LIMIT_MAX_REQUESTS,
  };
}

export function checkRateLimit(req: IncomingMessage, routeKey: string): RateLimitResult {
  const now = Date.now();
  cleanupStore(now);

  const ip = getClientIp(req);
  const key = `${ip}:${routeKey}`;
  const current = store.get(key);

  if (!current || current.resetAtMs <= now) {
    const resetAtMs = now + RATE_LIMIT_WINDOW_MS;
    store.set(key, { count: 1, resetAtMs });
    return {
      allowed: true,
      limit: RATE_LIMIT_MAX_REQUESTS,
      remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - 1),
      retryAfterSec: Math.ceil((resetAtMs - now) / 1000),
      resetAtMs,
    };
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      limit: RATE_LIMIT_MAX_REQUESTS,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAtMs - now) / 1000)),
      resetAtMs: current.resetAtMs,
    };
  }

  current.count += 1;
  store.set(key, current);
  return {
    allowed: true,
    limit: RATE_LIMIT_MAX_REQUESTS,
    remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - current.count),
    retryAfterSec: Math.max(1, Math.ceil((current.resetAtMs - now) / 1000)),
    resetAtMs: current.resetAtMs,
  };
}
