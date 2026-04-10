import { NextRequest } from 'next/server';

// Must run on Node.js runtime — edge runtime does not support duplex streaming
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * SSE streaming proxy.
 *
 * Why does this exist?
 *  1. Next.js `rewrites()` buffer the full response body before forwarding it,
 *     which breaks long-lived SSE streams.
 *  2. Connecting the browser directly to the Express API server (port 5050)
 *     is cross-origin, and Helmet's `Cross-Origin-Resource-Policy: same-origin`
 *     header blocks it from being read by the browser.
 *
 * This route handler fetches the SSE stream from Express server-side (no CORS
 * constraints), then pipes it back to the browser on the same origin.
 */
export async function GET(req: NextRequest) {
    const token = req.nextUrl.searchParams.get('token');

    if (!token) {
        return new Response('Unauthorized', { status: 401 });
    }

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050';
    const upstreamUrl = `${API_URL}/api/v1/realtime/events?token=${encodeURIComponent(token)}`;

    let upstreamRes: Response;
    try {
        upstreamRes = await fetch(upstreamUrl, {
            headers: {
                Accept: 'text/event-stream',
                'Cache-Control': 'no-cache',
            },
            // @ts-ignore — duplex is required for streaming fetch in Node 18+
            duplex: 'half',
        });
    } catch (err) {
        console.error('[SSE proxy] Could not reach API server:', err);
        return new Response('Service Unavailable', { status: 503 });
    }

    if (!upstreamRes.ok || !upstreamRes.body) {
        const text = await upstreamRes.text().catch(() => '');
        return new Response(text || 'Upstream error', { status: upstreamRes.status });
    }

    return new Response(upstreamRes.body, {
        status: 200,
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
}
