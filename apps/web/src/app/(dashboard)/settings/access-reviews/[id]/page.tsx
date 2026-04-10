'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { API_BASE_URL } from '@/lib/constants';
import { useAuth } from '@/components/auth/auth-provider';
import { useToast } from '@/components/ui/Toast';

export default function AccessReviewDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const { token } = useAuth();
    const { toast } = useToast();

    const [review, setReview] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [completing, setCompleting] = useState(false);

    const fetchReview = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/access-reviews/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const json = await res.json();
            if (res.ok) {
                setReview(json.data);
            } else {
                toast.error('Failed to load review details.');
            }
        } finally {
            setLoading(false);
        }
    }, [id, token, toast]);

    useEffect(() => {
        fetchReview();
    }, [fetchReview]);

    const handleDecision = async (userId: string, decision: 'approved' | 'removed') => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/access-reviews/${id}/members/${userId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ decision }),
            });
            if (res.ok) {
                const json = await res.json();
                setReview(json.data);
                toast.success(decision === 'approved' ? 'Access approved' : 'Access revoked');
            } else {
                toast.error('Failed to save decision.');
            }
        } catch (e) {
            toast.error('Network error.');
        }
    };

    const handleComplete = async () => {
        setCompleting(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/access-reviews/${id}/complete`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                toast.success('Access review completed successfully!');
                router.push('/settings/access-reviews');
            } else {
                const json = await res.json();
                toast.error(json.error?.message || 'Failed to complete review.');
            }
        } finally {
            setCompleting(false);
        }
    };

    if (loading) return <div style={{ padding: 48, textAlign: 'center' }}>Loading review details…</div>;
    if (!review) return <div style={{ padding: 48, textAlign: 'center' }}>Review not found.</div>;

    const reviewedCount = review.membersToReview.filter((m: any) => m.decision !== 'pending').length;
    const totalCount = review.membersToReview.length;
    const progress = totalCount > 0 ? (reviewedCount / totalCount) * 100 : 0;
    const isOverdue = review.status === 'overdue';

    return (
        <div className="vault-page">
            <div className="vault-page-header">
                <div>
                    <h1 className="vault-page-title">
                        Review Access: {review.projectId.name}
                    </h1>
                    <p className="vault-page-subtitle">
                        Due: {new Date(review.dueDate).toLocaleDateString()} · {totalCount} members to review
                        {isOverdue && <span style={{ color: '#DE350B', fontWeight: 700, marginLeft: 8 }}>OVERDUE</span>}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button className="vault-btn vault-btn--secondary" onClick={() => router.push('/settings/access-reviews')}>Back</button>
                    {review.status !== 'completed' && (
                        <button
                            className="vault-btn vault-btn--primary"
                            disabled={reviewedCount < totalCount || completing}
                            onClick={handleComplete}
                        >
                            {completing ? 'Completing...' : 'Complete Review'}
                        </button>
                    )}
                </div>
            </div>

            <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
                    <span>Progress: {reviewedCount} of {totalCount} reviewed</span>
                    <span>{Math.round(progress)}%</span>
                </div>
                <div style={{ height: 12, background: 'var(--vault-border)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${progress}%`, height: '100%', background: 'var(--vault-primary)', transition: 'width 0.4s ease' }} />
                </div>
            </div>

            <div className="vault-card">
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {review.membersToReview.map((m: any, idx: number) => {
                        const isDecisionPending = m.decision === 'pending';
                        const isApproved = m.decision === 'approved';
                        const isRemoved = m.decision === 'removed';

                        return (
                            <div
                                key={m.userId._id || m.userId}
                                style={{
                                    padding: '20px 24px',
                                    borderBottom: idx === totalCount - 1 ? 'none' : '1px solid var(--vault-border)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    background: isRemoved ? 'rgba(222, 53, 11, 0.03)' : 'transparent'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <div style={{
                                        width: 40, height: 40, borderRadius: '50%',
                                        background: 'var(--vault-surface-raised)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontWeight: 700, color: 'var(--vault-ink-muted)', fontSize: 14,
                                        border: '1px solid var(--vault-border)'
                                    }}>
                                        {m.userId.name?.[0]?.toUpperCase() || '?'}
                                    </div>
                                    <div>
                                        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{m.userId.name}</h4>
                                        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--vault-ink-muted)' }}>
                                            {m.role} · Added {new Date(m.addedAt).toLocaleDateString()} · Visibility: <span style={{ textTransform: 'capitalize' }}>{m.visibilityScope}</span>
                                        </p>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {review.status !== 'completed' ? (
                                        <>
                                            <button
                                                className={`vault-btn ${isApproved ? 'vault-btn--primary' : 'vault-btn--secondary'}`}
                                                style={{ fontSize: 12, padding: '6px 16px', opacity: isRemoved ? 0.5 : 1 }}
                                                onClick={() => handleDecision(m.userId._id, 'approved')}
                                            >
                                                {isApproved ? 'Approved ✓' : 'Approve Access'}
                                            </button>
                                            <button
                                                className={`vault-btn ${isRemoved ? 'vault-btn--danger' : 'vault-btn--secondary'}`}
                                                style={{
                                                    fontSize: 12, padding: '6px 16px',
                                                    ...(isRemoved ? { background: '#DE350B', color: '#fff', borderColor: '#DE350B' } : {})
                                                }}
                                                onClick={() => handleDecision(m.userId._id, 'removed')}
                                            >
                                                {isRemoved ? 'Revoked ✕' : 'Revoke Access'}
                                            </button>
                                        </>
                                    ) : (
                                        <div style={{
                                            fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 4,
                                            background: isApproved ? '#00875A15' : '#DE350B15',
                                            color: isApproved ? '#00875A' : '#DE350B',
                                            textTransform: 'uppercase'
                                        }}>
                                            {m.decision}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {review.status === 'completed' && (
                <div style={{ marginTop: 24, padding: 20, borderRadius: 8, background: '#E3FCEF', border: '1px solid #4C9AFF', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 20 }}>✅</span>
                    <div>
                        <h4 style={{ margin: 0, color: '#006644' }}>Review Completed</h4>
                        <p style={{ margin: '2px 0 0', fontSize: 13, color: '#006644' }}>
                            This cycle was finalized on {new Date(review.completedAt).toLocaleString()} by {review.initiatedBy.name}.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
