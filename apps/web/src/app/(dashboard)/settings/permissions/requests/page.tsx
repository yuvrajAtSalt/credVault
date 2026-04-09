'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { api } from '@/lib/api';
import { PERMISSION_LABELS } from '@/lib/constants';

const fetcher = (url: string) => api.get<any>(url).then((r) => r.data);

type Status = 'pending' | 'approved' | 'rejected';

function getInitials(name: string) {
    const p = name.trim().split(' ');
    return p.length >= 2 ? `${p[0][0]}${p[p.length - 1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
}

const STATUS_STYLES: Record<Status, { bg: string; color: string }> = {
    pending:  { bg: 'rgba(255,171,0,0.12)',  color: '#B8860B' },
    approved: { bg: 'rgba(54,179,126,0.12)', color: 'var(--vault-success)' },
    rejected: { bg: 'rgba(222,53,11,0.1)',   color: 'var(--vault-danger)' },
};

export default function PermissionRequestsPage() {
    const [statusFilter, setStatus] = useState<Status | ''>('pending');
    const [reviewModal, setReviewModal] = useState<any>(null);
    const [rejectNote, setRejectNote]   = useState('');
    const [expiresAt, setExpiresAt]     = useState('');
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);

    const q = new URLSearchParams({ page: String(page), ...(statusFilter ? { status: statusFilter } : {}) }).toString();
    const { data, isLoading } = useSWR(`/api/v1/permissions/admin/requests?${q}`, fetcher);
    const requests = data?.requests ?? [];
    const total    = data?.total    ?? 0;
    const pages    = data?.pages    ?? 1;

    const refresh = () => mutate(`/api/v1/permissions/admin/requests?${q}`);

    const approve = async (req: any) => {
        setLoading(true);
        await api.post(`/api/v1/permissions/admin/requests/${req._id}/approve`, { expiresAt: expiresAt || null });
        setLoading(false); setReviewModal(null); setExpiresAt(''); refresh();
    };

    const reject = async (req: any) => {
        if (!rejectNote.trim()) return;
        setLoading(true);
        await api.post(`/api/v1/permissions/admin/requests/${req._id}/reject`, { reviewNote: rejectNote });
        setLoading(false); setReviewModal(null); setRejectNote(''); refresh();
    };

    return (
        <div className="vault-page">
            <div className="vault-page-header">
                <div>
                    <h1 className="vault-page-title">Permission Requests</h1>
                    <p className="vault-page-subtitle">Review and action employee permission requests</p>
                </div>
            </div>

            {/* Filter tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
                {(['pending', 'approved', 'rejected', ''] as const).map((s) => {
                    const label = s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1);
                    return (
                        <button key={s} onClick={() => { setStatus(s); setPage(1); }}
                            className="vault-btn vault-btn--ghost"
                            style={{
                                fontSize: 12, padding: '6px 14px',
                                background: statusFilter === s ? 'var(--vault-primary)' : 'transparent',
                                color: statusFilter === s ? '#fff' : 'var(--vault-text-secondary)',
                                borderColor: statusFilter === s ? 'var(--vault-primary)' : 'var(--vault-border)',
                            }}>
                            {label}
                        </button>
                    );
                })}
            </div>

            {/* Request list */}
            {isLoading ? <p style={{ color: 'var(--vault-text-secondary)' }}>Loading…</p> : requests.length === 0 ? (
                <div className="vault-card" style={{ padding: 40, textAlign: 'center', color: 'var(--vault-text-secondary)' }}>
                    No {statusFilter || ''} requests found.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {requests.map((req: any) => {
                        const style = STATUS_STYLES[req.status as Status];
                        const permMeta = PERMISSION_LABELS[req.permission as keyof typeof PERMISSION_LABELS];
                        return (
                            <div key={req._id} className="vault-card" style={{ padding: 16, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                                {/* Avatar */}
                                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,82,204,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: 'var(--vault-primary)', flexShrink: 0 }}>
                                    {getInitials(req.requestedBy?.name || '?')}
                                </div>
                                {/* Content */}
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                        <div>
                                            <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{req.requestedBy?.name}</p>
                                            <p style={{ margin: 0, fontSize: 11, color: 'var(--vault-text-secondary)' }}>{req.requestedBy?.email}</p>
                                        </div>
                                        <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: style.bg, color: style.color }}>
                                            {req.status}
                                        </span>
                                    </div>
                                    <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--vault-text)' }}>
                                        Requesting: <strong>{permMeta?.label ?? req.permission}</strong>
                                        {req.projectId && <span style={{ color: 'var(--vault-text-secondary)' }}> for project {req.projectId.name}</span>}
                                    </p>
                                    <p style={{ margin: 0, fontSize: 12, color: 'var(--vault-text-secondary)', fontStyle: 'italic' }}>
                                        "{req.reason}"
                                    </p>
                                    {req.reviewNote && (
                                        <p style={{ margin: '6px 0 0', fontSize: 11, color: req.status === 'rejected' ? 'var(--vault-danger)' : 'var(--vault-success)' }}>
                                            Admin note: {req.reviewNote}
                                        </p>
                                    )}
                                    <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--vault-text-secondary)' }}>
                                        {new Date(req.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                        {req.expiresAt && ` · expires ${new Date(req.expiresAt).toLocaleDateString()}`}
                                    </p>
                                </div>
                                {/* Actions */}
                                {req.status === 'pending' && (
                                    <button className="vault-btn vault-btn--primary" style={{ fontSize: 12, alignSelf: 'center' }} onClick={() => setReviewModal(req)}>
                                        Review
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Pagination */}
            {pages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                    <span style={{ fontSize: 12, color: 'var(--vault-text-secondary)' }}>{total} total requests</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button className="vault-btn vault-btn--ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={{ fontSize: 12, padding: '4px 10px' }}>← Prev</button>
                        <button className="vault-btn vault-btn--ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} style={{ fontSize: 12, padding: '4px 10px' }}>Next →</button>
                    </div>
                </div>
            )}

            {/* Review Modal */}
            {reviewModal && (
                <div className="vault-overlay" style={{ zIndex: 200 }} onClick={() => { setReviewModal(null); setRejectNote(''); setExpiresAt(''); }}>
                    <div className="vault-modal vault-modal--md" onClick={(e) => e.stopPropagation()}>
                        <div style={{ padding: '20px 24px 0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Review Request</h2>
                                <button onClick={() => setReviewModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>✕</button>
                            </div>
                        </div>
                        <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div className="vault-card" style={{ padding: 14 }}>
                                <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700 }}>{reviewModal.requestedBy?.name}</p>
                                <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--vault-text-secondary)' }}>
                                    Requesting: <strong>{PERMISSION_LABELS[reviewModal.permission as keyof typeof PERMISSION_LABELS]?.label ?? reviewModal.permission}</strong>
                                </p>
                                <p style={{ margin: 0, fontSize: 12, fontStyle: 'italic', color: 'var(--vault-text-secondary)' }}>"{reviewModal.reason}"</p>
                            </div>

                            <div>
                                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 }}>Expiry Date (optional)</label>
                                <input type="datetime-local" className="vault-input" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} style={{ fontSize: 12 }} />
                                <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--vault-text-secondary)' }}>Leave blank to grant indefinitely.</p>
                            </div>

                            <div>
                                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 }}>Rejection Note (required for reject)</label>
                                <input className="vault-input" placeholder="Reason for rejection…" value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
                            </div>

                            <div style={{ display: 'flex', gap: 10 }}>
                                <button className="vault-btn vault-btn--primary" onClick={() => approve(reviewModal)} disabled={loading} style={{ flex: 1 }}>
                                    ✓ Approve
                                </button>
                                <button className="vault-btn vault-btn--danger" onClick={() => reject(reviewModal)} disabled={loading || !rejectNote.trim()} style={{ flex: 1 }}>
                                    ✗ Reject
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
