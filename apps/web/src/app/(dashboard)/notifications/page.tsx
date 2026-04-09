'use client';

import { useState, useCallback, useEffect } from 'react';
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

function typeIcon(type: string): { icon: string; bg: string; color: string } {
    if (type.startsWith('project.'))    return { icon: '📁', bg: 'rgba(0,82,204,0.12)', color: 'var(--vault-primary)' };
    if (type.startsWith('credential.')) return { icon: '🔑', bg: 'rgba(255,171,0,0.12)', color: 'var(--vault-warning)' };
    if (type.startsWith('permission'))  return { icon: '🔒', bg: 'rgba(101,84,192,0.12)', color: '#6554C0' };
    if (type.startsWith('team.'))       return { icon: '👥', bg: 'rgba(0,184,217,0.12)', color: '#00B8D9' };
    if (type.startsWith('member.'))     return { icon: '👥', bg: 'rgba(0,184,217,0.12)', color: '#00B8D9' };
    return                              { icon: '👤', bg: 'rgba(107,119,140,0.12)', color: 'var(--vault-ink-muted)' };
}

function NotifRowCard({ notif, onRead, onDismiss }: { notif: Notif; onRead: (n: Notif) => void; onDismiss: (id: string) => void }) {
    const time = useRelativeTime(notif.createdAt);
    const { icon, bg, color } = typeIcon(notif.type);
    
    return (
        <div 
            onClick={() => onRead(notif)}
            className="vault-card"
            style={{ 
                padding: '16px 20px', 
                display: 'flex', alignItems: 'center', gap: 16, 
                cursor: 'pointer',
                background: notif.isRead ? 'var(--vault-bg)' : 'var(--vault-primary-light)',
                transition: 'transform 120ms, box-shadow 120ms',
                position: 'relative'
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--vault-shadow-raised)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--vault-shadow-card)'; }}
        >
            <div style={{
                width: 40, height: 40, borderRadius: '50%', background: bg, color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, flexShrink: 0,
            }}>
                {icon}
            </div>
            
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--vault-ink)', margin: '0 0 4px' }}>{notif.title}</p>
                {notif.body && <p style={{ fontSize: 13, color: 'var(--vault-ink-muted)', margin: '0 0 4px' }}>{notif.body}</p>}
                <p style={{ fontSize: 12, color: 'var(--vault-ink-subtle)', margin: 0 }}>{time}{notif.actorId ? ` • from ${notif.actorId.name}` : ''}</p>
            </div>

            <button 
                onClick={(e) => { e.stopPropagation(); onDismiss(notif._id); }}
                style={{ 
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--vault-ink-muted)', fontSize: 18, padding: 8,
                    borderRadius: 4
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--vault-surface)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                aria-label="Delete notification"
            >
                ✕
            </button>
        </div>
    );
}

export default function NotificationsPage() {
    const router = useRouter();
    const [notifs, setNotifs] = useState<Notif[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetch = useCallback(async (p: number, f: 'all' | 'unread') => {
        setLoading(true);
        const readParam = f === 'unread' ? '&read=false' : '';
        const { data } = await api.get<any>(`/api/v1/notifications?limit=20&page=${p}${readParam}`);
        const payload = data.data;
        setNotifs(payload.notifications);
        setTotalPages(payload.pages || 1);
        setLoading(false);
    }, []);

    useEffect(() => { fetch(page, filter); }, [page, filter, fetch]);

    const handleMarkAll = async () => {
        await api.post('/api/v1/notifications/read', { all: true });
        setNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
    };

    const handleRead = async (notif: Notif) => {
        if (!notif.isRead) {
            await api.post('/api/v1/notifications/read', { ids: [notif._id] });
        }
        router.push(notif.url);
    };

    const handleDismiss = async (id: string) => {
        await api.delete(`/api/v1/notifications/${id}`);
        setNotifs(prev => prev.filter(n => n._id !== id));
    };

    return (
        <main style={{ padding: '28px 32px', maxWidth: 800 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--vault-ink)', margin: 0 }}>Notifications</h1>
                    <p style={{ fontSize: 13, color: 'var(--vault-ink-muted)', marginTop: 4 }}>Updates on your projects, credentials, and access requests.</p>
                </div>
                <button 
                    onClick={handleMarkAll}
                    className="vault-btn vault-btn--secondary"
                    disabled={loading || notifs.length === 0}
                >
                    Mark all as read
                </button>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid var(--vault-border)', marginBottom: 24 }}>
                <button
                    onClick={() => { setFilter('all'); setPage(1); }}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: '0 4px 12px', fontSize: 14, fontWeight: filter === 'all' ? 600 : 500,
                        color: filter === 'all' ? 'var(--vault-primary)' : 'var(--vault-ink-muted)',
                        borderBottom: filter === 'all' ? '2px solid var(--vault-primary)' : '2px solid transparent',
                    }}
                >
                    All Notifications
                </button>
                <button
                    onClick={() => { setFilter('unread'); setPage(1); }}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: '0 4px 12px', fontSize: 14, fontWeight: filter === 'unread' ? 600 : 500,
                        color: filter === 'unread' ? 'var(--vault-primary)' : 'var(--vault-ink-muted)',
                        borderBottom: filter === 'unread' ? '2px solid var(--vault-primary)' : '2px solid transparent',
                    }}
                >
                    Unread
                </button>
            </div>

            {/* List */}
            {loading ? (
                <p style={{ color: 'var(--vault-ink-muted)', fontSize: 14 }}>Loading notifications…</p>
            ) : notifs.length === 0 ? (
                <div className="vault-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
                    <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--vault-ink)', margin: '0 0 8px' }}>You're all caught up!</h2>
                    <p style={{ fontSize: 14, color: 'var(--vault-ink-muted)', margin: 0 }}>
                        {filter === 'unread' ? 'You have no unread notifications.' : 'There are no notifications to show.'}
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {notifs.map((n) => (
                        <NotifRowCard key={n._id} notif={n} onRead={handleRead} onDismiss={handleDismiss} />
                    ))}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 32 }}>
                    <button 
                        className="vault-btn vault-btn--secondary" 
                        disabled={page === 1} 
                        onClick={() => setPage(p => p - 1)}
                    >
                        Previous
                    </button>
                    <span style={{ fontSize: 13, color: 'var(--vault-ink-muted)' }}>Page {page} of {totalPages}</span>
                    <button 
                        className="vault-btn vault-btn--secondary" 
                        disabled={page === totalPages} 
                        onClick={() => setPage(p => p + 1)}
                    >
                        Next
                    </button>
                </div>
            )}
        </main>
    );
}
