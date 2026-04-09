'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useRelativeTime } from '@/hooks/useRelativeTime';

type Notif = {
    _id: string;
    type: string;
    title: string;
    body?: string;
    url: string;
    isRead: boolean;
    createdAt: string;
    actorId?: { name: string; avatarUrl?: string } | null;
};

function typeIcon(type: string): { icon: string; bg: string } {
    if (type.startsWith('project.'))    return { icon: '📁', bg: 'rgba(0,82,204,0.12)' };
    if (type.startsWith('credential.')) return { icon: '🔑', bg: 'rgba(255,171,0,0.12)' };
    if (type.startsWith('permission'))  return { icon: '🔒', bg: 'rgba(101,84,192,0.12)' };
    if (type.startsWith('team.'))       return { icon: '👥', bg: 'rgba(0,184,217,0.12)' };
    if (type.startsWith('member.'))     return { icon: '👥', bg: 'rgba(0,184,217,0.12)' };
    return                                     { icon: '👤', bg: 'rgba(107,119,140,0.12)' };
}

function NotifRow({ notif, onDismiss, onRead }: { notif: Notif; onDismiss: (id: string) => void; onRead: (notif: Notif) => void;}) {
    const time = useRelativeTime(notif.createdAt);
    const { icon, bg } = typeIcon(notif.type);
    const [hovered, setHovered] = useState(false);

    return (
        <div
            onClick={() => onRead(notif)}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '12px 16px', cursor: 'pointer',
                background: hovered ? 'var(--vault-surface)' : 'transparent',
                borderBottom: '1px solid var(--vault-border)',
                transition: 'background 120ms', position: 'relative',
            }}
        >
            {/* Unread dot */}
            {!notif.isRead && (
                <div style={{
                    position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)',
                    width: 6, height: 6, borderRadius: '50%', background: 'var(--vault-primary)',
                }} />
            )}

            {/* Icon */}
            <div style={{
                width: 32, height: 32, borderRadius: '50%', background: bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, flexShrink: 0,
            }}>
                {icon}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                    fontSize: 13, fontWeight: notif.isRead ? 400 : 600,
                    color: 'var(--vault-ink)', margin: '0 0 2px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    {notif.title}
                </p>
                {notif.body && (
                    <p style={{ fontSize: 12, color: 'var(--vault-ink-muted)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {notif.body}
                    </p>
                )}
                <p style={{ fontSize: 11, color: 'var(--vault-ink-subtle)', margin: 0 }}>{time}</p>
            </div>

            {/* Dismiss */}
            {hovered && (
                <button
                    aria-label="Dismiss notification"
                    onClick={(e) => { e.stopPropagation(); onDismiss(notif._id); }}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--vault-ink-muted)', fontSize: 14, padding: '2px 4px',
                        borderRadius: 4, flexShrink: 0,
                    }}
                >
                    ✕
                </button>
            )}
        </div>
    );
}

export function NotificationPanel({ onClose }: { onClose: () => void }) {
    const router = useRouter();
    const [notifs, setNotifs] = useState<Notif[]>([]);
    const [loading, setLoading] = useState(true);

    const fetch = useCallback(async () => {
        const { data } = await api.get<any>('/api/v1/notifications?limit=10');
        setNotifs((data as any)?.data?.notifications ?? []);
        setLoading(false);
    }, []);

    useEffect(() => { fetch(); }, [fetch]);

    const handleMarkAll = async () => {
        await api.post('/api/v1/notifications/read', { all: true });
        setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    };

    const handleRead = async (notif: Notif) => {
        if (!notif.isRead) {
            await api.post('/api/v1/notifications/read', { ids: [notif._id] });
            setNotifs((prev) => prev.map((n) => n._id === notif._id ? { ...n, isRead: true } : n));
        }
        onClose();
        router.push(notif.url);
    };

    const handleDismiss = async (id: string) => {
        await api.delete(`/api/v1/notifications/${id}`);
        setNotifs((prev) => prev.filter((n) => n._id !== id));
    };

    return (
        <div style={{
            width: 380, maxHeight: 520, display: 'flex', flexDirection: 'column',
            background: 'var(--vault-bg)', borderRadius: 10,
            border: '1px solid var(--vault-border)',
            boxShadow: 'var(--vault-shadow-overlay)', overflow: 'hidden',
        }}>
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', borderBottom: '1px solid var(--vault-border)',
                flexShrink: 0,
            }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--vault-ink)', margin: 0 }}>Notifications</p>
                <button
                    onClick={handleMarkAll}
                    style={{ fontSize: 12, color: 'var(--vault-primary)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                    Mark all read
                </button>
            </div>

            {/* List */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
                {loading ? (
                    <p style={{ textAlign: 'center', color: 'var(--vault-ink-muted)', fontSize: 13, padding: '32px 0' }}>Loading…</p>
                ) : notifs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 24px' }}>
                        <div style={{ fontSize: 32, marginBottom: 12 }}>🔔</div>
                        <p style={{ fontSize: 13, color: 'var(--vault-ink-muted)', margin: 0 }}>All caught up — no notifications</p>
                    </div>
                ) : (
                    notifs.map((n) => (
                        <NotifRow key={n._id} notif={n} onDismiss={handleDismiss} onRead={handleRead} />
                    ))
                )}
            </div>

            {/* Footer */}
            <div style={{ borderTop: '1px solid var(--vault-border)', padding: '10px 16px', flexShrink: 0 }}>
                <button
                    onClick={() => { router.push('/notifications'); onClose(); }}
                    style={{ fontSize: 13, color: 'var(--vault-primary)', background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'center' }}
                >
                    View all notifications →
                </button>
            </div>
        </div>
    );
}
