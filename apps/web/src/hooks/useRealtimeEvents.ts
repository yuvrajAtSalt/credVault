'use client';
import { useEffect, useRef } from 'react';
import { useSWRConfig } from 'swr';
import { useAuth } from '@/components/auth/auth-provider';

// SSE connects to a same-origin Next.js Route Handler (/api/v1/realtime/events/route.ts)
// which streams from Express server-side. This avoids CORS + Next.js rewrite buffering.

const INITIAL_RETRY_MS = 3_000;
const MAX_RETRY_MS     = 30_000;

export function useRealtimeEvents() {
    const { mutate }   = useSWRConfig();
    const { token }    = useAuth();
    const retryDelay   = useRef(INITIAL_RETRY_MS);
    const timerRef     = useRef<NodeJS.Timeout | null>(null);
    const sourceRef    = useRef<EventSource | null>(null);

    useEffect(() => {
        if (!token) return;

        let cancelled = false;

        const close = () => {
            if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
            sourceRef.current?.close();
            sourceRef.current = null;
        };

        const connect = () => {
            if (cancelled) return;
            close();

            const es = new EventSource(`/api/v1/realtime/events?token=${token}`);
            sourceRef.current = es;

            es.onopen = () => {
                retryDelay.current = INITIAL_RETRY_MS; // reset on success
                console.log('[SSE] Connected ✓');
            };

            es.addEventListener('new_notification', (e: any) => {
                mutate('/api/v1/notifications');
                mutate('/api/v1/notifications/unread-count');
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('vault:new_notification', { detail: e.data }));
                }
                console.log('[SSE] New notification', e.data);
            });

            es.addEventListener('credential_expiry_warning', (e: any) => {
                console.log('[SSE] Credential expiry warning', e.data);
            });

            es.onerror = () => {
                es.close();
                if (cancelled) return;

                // Exponential back-off — don't flood the console during API startup
                const delay = retryDelay.current;
                retryDelay.current = Math.min(delay * 2, MAX_RETRY_MS);
                console.warn(`[SSE] Connection lost — retrying in ${delay / 1000}s`);
                timerRef.current = setTimeout(connect, delay);
            };
        };

        // Small initial delay so the API has a moment to start in dev
        timerRef.current = setTimeout(connect, 1000);

        return () => {
            cancelled = true;
            close();
        };
    }, [mutate, token]);

    return null;
}
