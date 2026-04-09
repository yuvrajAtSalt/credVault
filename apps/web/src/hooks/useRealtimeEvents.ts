'use client';
import { useEffect, useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { API_BASE_URL } from '@/lib/constants';

// For toast notifications (assuming we don't have a big library, we'll dispatch custom events hook can listen to or just use a basic logging)
// We will simply revalidate standard SWR keys on events

export function useRealtimeEvents() {
    const { mutate } = useSWRConfig();

    useEffect(() => {
        let eventSource: EventSource | null = null;
        
        const token = localStorage.getItem('vault_token');
        if (!token) return;

        // Since EventSource doesn't support Authorization headers easily without a polyfill like event-source-polyfill,
        // The standard SSE way in API requires token via cookie or query string.
        // Wait, since we are doing JWT via Authorization header, normal EventSource fails. 
        // We will append token in query for this specific route.
        const connect = () => {
             eventSource = new EventSource(`${API_BASE_URL}/api/v1/realtime/events?token=${token}`);

             eventSource.onopen = () => {
                 console.log('[SSE] Connected to real-time events');
             };

             eventSource.addEventListener('new_notification', (e: any) => {
                 console.log('[SSE] new notification', e.data);
                 // Revalidate unread count and notification list
                 mutate('/api/v1/notifications');
                 mutate('/api/v1/notifications/unread-count');
                 
                 // You could trigger a toast here
                 // alert(`New Notification: ${JSON.parse(e.data).title}`); 
             });

             eventSource.addEventListener('credential_expiry_warning', (e: any) => {
                 console.log('[SSE] credential expiry warning', e.data);
                 // Revalidate project or global warning state
             });

             eventSource.onerror = (err) => {
                 console.error('[SSE] EventSource failed', err);
                 eventSource?.close();
                 // Reconnect after 5 seconds
                 setTimeout(connect, 5000);
             };
        };

        connect();

        return () => {
            if (eventSource) {
                eventSource.close();
            }
        };
    }, [mutate]);

    return null;
}
