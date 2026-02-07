type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitState = {
  resetAt: number;
  count: number;
};

function getStore(): Map<string, RateLimitState> {
  const g = globalThis as unknown as {
    __vioRateLimit?: Map<string, RateLimitState>;
  };

  if (!g.__vioRateLimit) g.__vioRateLimit = new Map();

  return g.__vioRateLimit;
}

function getClientIp(request: Request): string {
  const h = request.headers;
  const forwardedFor = h.get("x-forwarded-for");

  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";
  const realIp = h.get("x-real-ip");

  if (realIp) return realIp;

  return "unknown";
}

export function rateLimit(
  request: Request,
  opts: RateLimitOptions,
): Response | null {
  const ip = getClientIp(request);
  const url = new URL(request.url);
  const key = `${opts.key}:${request.method}:${url.pathname}:${ip}`;

  const now = Date.now();
  const store = getStore();
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    store.set(key, { resetAt: now + opts.windowMs, count: 1 });

    return null;
  }

  existing.count += 1;
  store.set(key, existing);

  if (existing.count > opts.limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.resetAt - now) / 1000),
    );

    return new Response(JSON.stringify({ error: "Too Many Requests" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSeconds),
      },
    });
  }

  return null;
}
