'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '@/lib/constants';
import { useAuth } from '@/components/auth/auth-provider';
import { useToast } from '@/components/ui/Toast';
import { usePermissions } from '@/hooks/usePermissions';

interface AccessReview {
    _id: string;
    projectId: { _id: string; name: string; color: string };
    status: 'pending' | 'in_progress' | 'completed' | 'overdue';
    dueDate: string;
    initiatedBy: { _id: string; name: string };
    membersToReview: any[];
    createdAt: string;
}

export default function AccessReviewsListPage() {
    const { token } = useAuth();
    const { toast } = useToast();
    const perms = usePermissions();
    const [reviews, setReviews] = useState<AccessReview[]>([]);
    const [loading, setLoading] = useState(true);
    const [projects, setProjects] = useState<any[]>([]);
    const [showInitiateModal, setShowInitiateModal] = useState(false);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [isInitiating, setIsInitiating] = useState(false);

    const fetchReviews = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/access-reviews`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const json = await res.json();
            if (res.ok) {
                setReviews(json.data?.reviews || []);
            }
        } finally {
            setLoading(false);
        }
    }, [token]);

    const fetchProjects = useCallback(async () => {
        const res = await fetch(`${API_BASE_URL}/api/v1/projects`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (res.ok) {
            setProjects(json.data?.projects || []);
        }
    }, [token]);

    useEffect(() => {
        fetchReviews();
        fetchProjects();
    }, [fetchReviews, fetchProjects]);

    const handleInitiate = async () => {
        if (!selectedProjectId) return;
        setIsInitiating(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/access-reviews/initiate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ projectId: selectedProjectId }),
            });
            if (res.ok) {
                toast.success('Access review initiated!');
                setShowInitiateModal(false);
                fetchReviews();
            } else {
                const json = await res.json();
                toast.error(json.error?.message || 'Failed to initiate review.');
            }
        } finally {
            setIsInitiating(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed':   return '#00875A';
            case 'overdue':     return '#DE350B';
            case 'in_progress': return '#0052CC';
            default:            return '#42526E';
        }
    };

    if (loading) return <div style={{ padding: 48, textAlign: 'center' }}>Loading reviews…</div>;

    return (
        <div style={{ padding: '24px' }}>
            <div className="vault-page-header">
                <div>
                    <h1 className="vault-page-title">Access Reviews</h1>
                    <p className="vault-page-subtitle">Monitor and manage periodic project access compliance reviews.</p>
                </div>
                {perms.isGod() && (
                    <button
                        className="vault-btn vault-btn--primary"
                        onClick={() => setShowInitiateModal(true)}
                    >
                        + Initiate Review
                    </button>
                )}
            </div>

            <div className="vault-card">
                <table className="vault-table">
                    <thead>
                        <tr>
                            <th>Project</th>
                            <th>Status</th>
                            <th>Due Date</th>
                            <th>Progress</th>
                            <th>Initiated By</th>
                            <th>Created</th>
                            <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reviews.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--vault-ink-muted)' }}>
                                    No access reviews found.
                                </td>
                            </tr>
                        ) : (
                            reviews.map(review => {
                                const reviewedCount = review.membersToReview.filter(m => m.decision !== 'pending').length;
                                const totalCount = review.membersToReview.length;
                                const progress = totalCount > 0 ? (reviewedCount / totalCount) * 100 : 0;

                                return (
                                    <tr key={review._id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: review.projectId.color }} />
                                                <span style={{ fontWeight: 500 }}>{review.projectId.name}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span style={{
                                                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                                                background: `${getStatusColor(review.status)}15`,
                                                color: getStatusColor(review.status),
                                                textTransform: 'uppercase'
                                            }}>
                                                {review.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: 13 }}>
                                            {new Date(review.dueDate).toLocaleDateString()}
                                            {review.status === 'overdue' && (
                                                <span style={{ marginLeft: 6, color: '#DE350B', fontSize: 11, fontWeight: 600 }}>OVERDUE</span>
                                            )}
                                        </td>
                                        <td>
                                            <div style={{ width: 100, height: 6, background: 'var(--vault-border)', borderRadius: 3, overflow: 'hidden' }}>
                                                <div style={{ width: `${progress}%`, height: '100%', background: 'var(--vault-primary)' }} />
                                            </div>
                                            <div style={{ fontSize: 10, color: 'var(--vault-ink-muted)', marginTop: 4 }}>
                                                {reviewedCount} / {totalCount} reviewed
                                            </div>
                                        </td>
                                        <td style={{ fontSize: 13 }}>{review.initiatedBy.name}</td>
                                        <td style={{ fontSize: 13, color: 'var(--vault-ink-muted)' }}>{new Date(review.createdAt).toLocaleDateString()}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            <Link
                                                href={`/settings/access-reviews/${review._id}`}
                                                className="vault-btn vault-btn--secondary"
                                                style={{ fontSize: 12, padding: '4px 12px' }}
                                            >
                                                {review.status === 'completed' ? 'View Details' : 'Review Now'}
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Initiate Modal */}
            {showInitiateModal && (
                <div className="vault-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="vault-card" style={{ width: 440, padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
                        <h3 style={{ margin: '0 0 8px' }}>Initiate Access Review</h3>
                        <p style={{ fontSize: 13, color: 'var(--vault-ink-muted)', marginBottom: 24 }}>
                            Manually start a reviews cycle for a specific project. This will snapshot current memberships.
                        </p>

                        <div style={{ marginBottom: 24 }}>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Select Project</label>
                            <select
                                className="vault-input"
                                value={selectedProjectId}
                                onChange={e => setSelectedProjectId(e.target.value)}
                            >
                                <option value="">Choose a project...</option>
                                {projects.filter(p => p.status === 'active').map(p => (
                                    <option key={p._id} value={p._id}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                            <button className="vault-btn vault-btn--secondary" onClick={() => setShowInitiateModal(false)}>Cancel</button>
                            <button
                                className="vault-btn vault-btn--primary"
                                disabled={!selectedProjectId || isInitiating}
                                onClick={handleInitiate}
                            >
                                {isInitiating ? 'Initiating...' : 'Start Review'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
