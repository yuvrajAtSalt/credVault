/**
 * Lightweight in-memory rate limiter — no external deps.
 *
 * Usage:
 *   const limiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });
 *   app.post('/login', limiter('ip'), handler);
 */

interface Window {
    count: number;
    resetAt: number;
}

const store = new Map<string, Window>();

// Clean expired entries every 5 minutes to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [key, w] of store) {
        if (w.resetAt <= now) store.delete(key);
    }
}, 5 * 60 * 1000).unref();

export interface RateLimiterOptions {
    windowMs: number;   // time window in ms
    max:      number;   // max requests per window
    keyFn?:   (req: any) => string; // custom key extractor, default: IP
}

export function createRateLimiter(opts: RateLimiterOptions) {
    const { windowMs, max, keyFn } = opts;

    return function rateLimitMiddleware(req: any, res: any, next: any) {
        const key = keyFn ? keyFn(req) : (req.ip || req.socket?.remoteAddress || 'unknown');
        const now = Date.now();

        let w = store.get(key);

        if (!w || w.resetAt <= now) {
            w = { count: 0, resetAt: now + windowMs };
            store.set(key, w);
        }

        w.count += 1;

        if (w.count > max) {
            const retryAfter = Math.ceil((w.resetAt - now) / 1000);
            res.setHeader('Retry-After', String(retryAfter));
            res.setHeader('X-RateLimit-Limit', String(max));
            res.setHeader('X-RateLimit-Remaining', '0');
            res.setHeader('X-RateLimit-Reset', String(Math.ceil(w.resetAt / 1000)));
            return res.status(429).json({
                data: null,
                error: { message: 'TOO MANY REQUESTS — please try again later', retryAfter },
            });
        }

        res.setHeader('X-RateLimit-Limit', String(max));
        res.setHeader('X-RateLimit-Remaining', String(max - w.count));
        res.setHeader('X-RateLimit-Reset', String(Math.ceil(w.resetAt / 1000)));
        next();
    };
}

// ─── Preconfigured limiters used across routes ────────────────────────────────

/** Login: 5 attempts per 15 min per IP */
export const loginRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });

/** Reveal credential: 60 reveals per hour per user */
export const revealRateLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 60,
    keyFn: (req: any) => `reveal:${req.currentUser?._id ?? req.ip}`,
});

/** Invite: 20 invites per hour per user */
export const inviteRateLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 20,
    keyFn: (req: any) => `invite:${req.currentUser?._id ?? req.ip}`,
});
