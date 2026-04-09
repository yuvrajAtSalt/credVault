'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import { useToast } from '@/components/ui/Toast';

interface ApprovalRequest {
    _id: string;
    projectId: { name: string };
    credentialId: { label: string; category: string };
    requesterId: { name: string; email: string };
    reason: string;
    status: 'pending' | 'approved' | 'rejected' | 'expired';
    createdAt: string;
    expiresAt: string;
}

export default function ApprovalsQueuePage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [requests, setRequests] = useState<ApprovalRequest[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchRequests = useCallback(async () => {
        const { data } = await api.get<any>('/api/v1/compliance/approvals');
        setRequests((data as any)?.data ?? []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchRequests(); }, [fetchRequests]);

    const handleDecision = async (id: string, status: 'approved' | 'rejected') => {
        const { error } = await api.patch(`/api/v1/compliance/approvals/${id}`, { status });
        if (!error) {
            toast.success(`Request ${status}`);
            fetchRequests();
        } else {
            toast.error(error.message);
        }
    };

    if (loading) return <div className="vault-page">Loading approval queue…</div>;

    const pending = requests.filter(r => r.status === 'pending');
    const history = requests.filter(r => r.status !== 'pending');

    return (
        <main className="vault-page">
            <div className="vault-page-header">
                <div>
                    <h1 className="vault-page-title">Approval Queue</h1>
                    <p className="vault-page-subtitle">Review and authorize sensitive access requests (Two-Person Rule).</p>
                </div>
            </div>

            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Pending Requests</h3>
            <div className="vault-card" style={{ padding: 0, marginBottom: 32 }}>
                <table className="vault-table">
                    <thead>
                        <tr>
                            <th>Requester</th>
                            <th>Target Credential</th>
                            <th>Reason</th>
                            <th>Expires</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pending.length === 0 ? (
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--vault-ink-muted)' }}>No pending requests.</td></tr>
                        ) : (
                            pending.map(r => (
                                <tr key={r._id}>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{r.requesterId.name}</div>
                                        <div style={{ fontSize: 11, color: 'var(--vault-ink-muted)' }}>{r.requesterId.email}</div>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: 13 }}>{r.credentialId?.label}</div>
                                        <div style={{ fontSize: 11, color: 'var(--vault-ink-muted)' }}>{r.projectId.name} • {r.credentialId?.category}</div>
                                    </td>
                                    <td style={{ fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.reason}</td>
                                    <td style={{ fontSize: 12 }}>{new Date(r.expiresAt).toLocaleString()}</td>
                                    <td style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                            <button onClick={() => handleDecision(r._id, 'rejected')} className="vault-btn vault-btn--secondary" style={{ fontSize: 11, color: '#DE350B' }}>Reject</button>
                                            <button onClick={() => handleDecision(r._id, 'approved')} className="vault-btn vault-btn--primary" style={{ fontSize: 11 }}>Approve</button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>History</h3>
            <div className="vault-card" style={{ padding: 0 }}>
                <table className="vault-table">
                    <thead>
                        <tr>
                            <th>Requester</th>
                            <th>Target</th>
                            <th>Status</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.map(r => (
                            <tr key={r._id}>
                                <td>{r.requesterId.name}</td>
                                <td style={{ fontSize: 12 }}>{r.credentialId?.label}</td>
                                <td>
                                    <span style={{ 
                                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, 
                                        background: r.status === 'approved' ? '#E3FCEF' : '#FFEBE6',
                                        color: r.status === 'approved' ? '#006644' : '#BF2600'
                                    }}>
                                        {r.status.toUpperCase()}
                                    </span>
                                </td>
                                <td style={{ fontSize: 12, color: 'var(--vault-ink-muted)' }}>{new Date(r.createdAt).toLocaleDateString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </main>
    );
}
