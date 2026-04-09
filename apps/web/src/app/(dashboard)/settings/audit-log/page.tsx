'use client';

import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '@/lib/constants';
import { useAuth } from '@/components/auth/auth-provider';

const AUDIT_ACTIONS = [
    'login','logout','credential.create','credential.view','credential.update',
    'credential.delete','project.create','project.update','project.delete',
    'member.invite','member.update','member.deactivate','visibility.grant','visibility.revoke',
];

const ACTION_COLOR: Record<string, string> = {
    'credential.create': '#3b82f6', 'credential.view': '#3b82f6',
    'credential.update': '#3b82f6', 'credential.delete': '#3b82f6',
    'project.create': '#06b6d4', 'project.update': '#06b6d4', 'project.delete': '#06b6d4',
    'member.invite': '#f59e0b', 'member.update': '#f59e0b', 'member.deactivate': '#f59e0b',
    'login': '#94a3b8', 'logout': '#94a3b8',
    'visibility.grant': '#8b5cf6', 'visibility.revoke': '#8b5cf6',
};

function formatAge(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days  = Math.floor(hours / 24);
    if (days  > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (mins  > 0) return `${mins}m ago`;
    return 'just now';
}

function getInitials(name: string) {
    const parts = (name || '?').trim().split(' ');
    return (parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase();
}

interface AuditLog {
    _id: string;
    action: string;
    targetType?: string;
    targetId?: string;
    meta?: Record<string, unknown>;
    createdAt: string;
    actorId: { _id: string; name: string; email: string; role: string } | null;
}

export default function AuditLogPage() {
    const { token } = useAuth();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Filters
    const [action, setAction]       = useState('');
    const [targetType, setTargetType] = useState('');
    const [from, setFrom]           = useState('');
    const [to, setTo]               = useState('');

    const fetchLogs = useCallback(async (p = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(p), limit: '50' });
            if (action)     params.set('action', action);
            if (targetType) params.set('targetType', targetType);
            if (from)       params.set('from', from);
            if (to)         params.set('to', to);

            const res = await fetch(`${API_BASE_URL}/api/v1/audit-log?${params}`, {
                headers: { Authorization: `Bearer ${token}` },
                credentials: 'include',
            });
            const json = await res.json();
            if (res.ok) {
                const d = json.data?.data;
                setLogs(d?.logs ?? []);
                setTotal(d?.total ?? 0);
                setPage(d?.page ?? 1);
                setPages(d?.pages ?? 1);
            }
        } finally {
            setLoading(false);
        }
    }, [token, action, targetType, from, to]);

    useEffect(() => { fetchLogs(1); }, [fetchLogs]);

    return (
        <div className="vault-page">
            {/* Header */}
            <div className="vault-page-header">
                <div>
                    <h1 className="vault-page-title">Audit Log</h1>
                    <p className="vault-page-subtitle">
                        Complete immutable record of all actions performed in your organisation.
                        {total > 0 && <strong style={{ color: 'var(--vault-ink)' }}> {total} total events.</strong>}
                    </p>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="vault-card" style={{ padding: '16px 20px', marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--vault-ink-muted)' }}>Action</label>
                    <select
                        className="vault-input"
                        style={{ minWidth: 180, fontSize: 12 }}
                        value={action}
                        onChange={e => setAction(e.target.value)}
                    >
                        <option value="">All actions</option>
                        {AUDIT_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--vault-ink-muted)' }}>Target type</label>
                    <select
                        className="vault-input"
                        style={{ minWidth: 140, fontSize: 12 }}
                        value={targetType}
                        onChange={e => setTargetType(e.target.value)}
                    >
                        <option value="">All types</option>
                        {['Credential','Project','User'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--vault-ink-muted)' }}>From</label>
                    <input
                        type="date"
                        className="vault-input"
                        style={{ fontSize: 12 }}
                        value={from}
                        onChange={e => setFrom(e.target.value)}
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--vault-ink-muted)' }}>To</label>
                    <input
                        type="date"
                        className="vault-input"
                        style={{ fontSize: 12 }}
                        value={to}
                        onChange={e => setTo(e.target.value)}
                    />
                </div>
                <button
                    className="vault-btn"
                    style={{ fontSize: 12 }}
                    onClick={() => { setAction(''); setTargetType(''); setFrom(''); setTo(''); }}
                >
                    Clear filters
                </button>
            </div>

            {/* Table */}
            <div className="vault-card" style={{ padding: 0, overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: 48, textAlign: 'center', color: 'var(--vault-ink-muted)', fontSize: 13 }}>
                        Loading audit events…
                    </div>
                ) : logs.length === 0 ? (
                    <div style={{ padding: 64, textAlign: 'center' }}>
                        <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
                        <p style={{ fontWeight: 600, color: 'var(--vault-ink)', margin: 0 }}>No audit events</p>
                        <p style={{ fontSize: 13, color: 'var(--vault-ink-muted)', marginTop: 4 }}>
                            Events will appear here when actions are performed.
                        </p>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--vault-border)', background: 'var(--vault-surface-raised)' }}>
                                {['Time','Actor','Action','Target','Details'].map(h => (
                                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--vault-ink-muted)', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log, i) => {
                                const isExpanded = expandedId === log._id;
                                const actor = log.actorId;
                                const color = ACTION_COLOR[log.action] ?? '#94a3b8';
                                return [
                                    <tr
                                        key={log._id}
                                        onClick={() => setExpandedId(isExpanded ? null : log._id)}
                                        style={{
                                            borderBottom: '1px solid var(--vault-border)',
                                            cursor: 'pointer',
                                            background: isExpanded ? 'var(--vault-surface-raised)' : 'transparent',
                                            transition: 'background 120ms',
                                        }}
                                        onMouseEnter={e => !isExpanded && (e.currentTarget.style.background = 'var(--vault-surface-raised)')}
                                        onMouseLeave={e => !isExpanded && (e.currentTarget.style.background = 'transparent')}
                                    >
                                        <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--vault-ink-muted)', whiteSpace: 'nowrap' }}>
                                            {formatAge(log.createdAt)}
                                        </td>
                                        <td style={{ padding: '10px 16px' }}>
                                            {actor ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <div style={{
                                                        width: 26, height: 26, borderRadius: '50%',
                                                        background: 'var(--vault-primary)', opacity: 0.8,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0,
                                                    }}>
                                                        {getInitials(actor.name)}
                                                    </div>
                                                    <div>
                                                        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--vault-ink)' }}>{actor.name}</p>
                                                        <p style={{ margin: 0, fontSize: 10, color: 'var(--vault-ink-muted)' }}>{actor.role}</p>
                                                    </div>
                                                </div>
                                            ) : <span style={{ fontSize: 12, color: 'var(--vault-ink-muted)' }}>System</span>}
                                        </td>
                                        <td style={{ padding: '10px 16px' }}>
                                            <span style={{
                                                fontSize: 11, fontWeight: 600, padding: '2px 8px',
                                                borderRadius: 4, color,
                                                background: color + '18',
                                                border: `1px solid ${color}40`,
                                            }}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--vault-ink-muted)' }}>
                                            {log.targetType || '—'}
                                        </td>
                                        <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--vault-ink-muted)' }}>
                                            {log.meta?.label as string || log.meta?.email as string || '—'}
                                        </td>
                                    </tr>,
                                    isExpanded && (
                                        <tr key={`${log._id}-expand`} style={{ borderBottom: '1px solid var(--vault-border)' }}>
                                            <td colSpan={5} style={{ padding: '0 16px 16px 16px', background: 'var(--vault-surface-raised)' }}>
                                                <pre style={{
                                                    margin: 0, fontSize: 11, color: 'var(--vault-ink)',
                                                    background: 'var(--vault-surface)', borderRadius: 6,
                                                    padding: '12px 14px', overflow: 'auto',
                                                    border: '1px solid var(--vault-border)',
                                                }}>
                                                    {JSON.stringify(log.meta ?? {}, null, 2)}
                                                </pre>
                                            </td>
                                        </tr>
                                    ),
                                ];
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination */}
            {pages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 20 }}>
                    <button
                        className="vault-btn"
                        style={{ fontSize: 12 }}
                        disabled={page <= 1}
                        onClick={() => fetchLogs(page - 1)}
                    >
                        ← Prev
                    </button>
                    <span style={{ fontSize: 12, color: 'var(--vault-ink-muted)' }}>
                        Page {page} of {pages}
                    </span>
                    <button
                        className="vault-btn"
                        style={{ fontSize: 12 }}
                        disabled={page >= pages}
                        onClick={() => fetchLogs(page + 1)}
                    >
                        Next →
                    </button>
                </div>
            )}
        </div>
    );
}
