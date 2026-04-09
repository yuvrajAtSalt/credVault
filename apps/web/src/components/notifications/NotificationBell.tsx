'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { NotificationPanel } from './NotificationPanel';

export function NotificationBell() {
    const [open, setOpen]           = useState(false);
    const [unread, setUnread]       = useState(0);
    const panelRef                  = useRef<HTMLDivElement>(null);

    const fetchCount = useCallback(async () => {
        const { data } = await api.get<any>('/api/v1/notifications/unread-count');
        setUnread((data as any)?.data?.count ?? 0);
    }, []);

    // Poll every 30 s
    useEffect(() => {
        fetchCount();
        const id = setInterval(fetchCount, 30_000);
        return () => clearInterval(id);
    }, [fetchCount]);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    return (
        <div ref={panelRef} style={{ position: 'relative' }}>
            <button
                suppressHydrationWarning
                onClick={() => setOpen((v) => !v)}
                aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
                style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 18, color: 'var(--vault-ink-muted)',
                    position: 'relative', padding: '4px 6px', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                }}
            >
                <span role="img" aria-hidden="true">🔔</span>
                {unread > 0 && (
                    <span style={{
                        position: 'absolute', top: 0, right: 0,
                        minWidth: 16, height: 16, borderRadius: 8,
                        background: '#FF5630', color: '#fff',
                        fontSize: 9, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '0 3px', lineHeight: 1,
                    }}>
                        {unread > 99 ? '99+' : unread}
                    </span>
                )}
            </button>

            {open && (
                <>
                    {/* Backdrop */}
                    <div
                        style={{ position: 'fixed', inset: 0, zIndex: 29 }}
                        onClick={() => setOpen(false)}
                    />
                    {/* Panel */}
                    <div style={{
                        position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                        zIndex: 30,
                        animation: 'vaultFadeIn 120ms ease-out',
                    }}>
                        <NotificationPanel onClose={() => { setOpen(false); fetchCount(); }} />
                    </div>
                </>
            )}
        </div>
    );
}
