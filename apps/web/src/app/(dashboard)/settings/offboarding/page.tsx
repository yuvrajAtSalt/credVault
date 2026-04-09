'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '@/lib/constants';
import { useAuth } from '@/components/auth/auth-provider';
import { useToast } from '@/components/ui/Toast';

interface OffboardingChecklist {
    _id: string;
    userId: { _id: string; name: string; email: string; avatarUrl?: string };
    initiatedBy: { _id: string; name: string };
    targetDate: string;
    status: 'in_progress' | 'completed';
    steps: any[];
    createdAt: string;
}

export default function OffboardingListPage() {
    const { token } = useAuth();
    const { toast } = useToast();
    const [checklists, setChecklists] = useState<OffboardingChecklist[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchChecklists = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/offboarding`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const json = await res.json();
            if (res.ok) {
                setChecklists(json.data || []);
            }
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchChecklists();
    }, [fetchChecklists]);

    if (loading) return <div style={{ padding: 48, textAlign: 'center' }}>Loading checklists…</div>;

    return (
        <div className="vault-page">
            <div className="vault-page-header">
                <div>
                    <h1 className="vault-page-title">Employee Offboarding</h1>
                    <p className="vault-page-subtitle">Manage structured offboarding workflows for departing employees.</p>
                </div>
            </div>

            <div className="vault-card">
                <table className="vault-table">
                    <thead>
                        <tr>
                            <th>Employee</th>
                            <th>Status</th>
                            <th>Target Date</th>
                            <th>Progress</th>
                            <th>Initiated By</th>
                            <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {checklists.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--vault-ink-muted)' }}>
                                    No offboarding workflows found.
                                </td>
                            </tr>
                        ) : (
                            checklists.map(checklist => {
                                const completedSteps = checklist.steps.filter(s => s.status !== 'pending').length;
                                const totalSteps = checklist.steps.length;
                                const progress = (completedSteps / totalSteps) * 100;

                                return (
                                    <tr key={checklist._id}>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <div style={{ 
                                                    width: 32, height: 32, borderRadius: '50%', 
                                                    background: 'var(--vault-surface-raised)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: 12, fontWeight: 700, color: 'var(--vault-primary)'
                                                }}>
                                                    {checklist.userId.name[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600 }}>{checklist.userId.name}</div>
                                                    <div style={{ fontSize: 11, color: 'var(--vault-ink-muted)' }}>{checklist.userId.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span style={{
                                                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                                                background: checklist.status === 'completed' ? '#00875A15' : '#0052CC15',
                                                color: checklist.status === 'completed' ? '#00875A' : '#0052CC',
                                                textTransform: 'uppercase'
                                            }}>
                                                {checklist.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: 13 }}>
                                            {new Date(checklist.targetDate).toLocaleDateString()}
                                        </td>
                                        <td>
                                            <div style={{ width: 100, height: 6, background: 'var(--vault-border)', borderRadius: 3, overflow: 'hidden' }}>
                                                <div style={{ width: `${progress}%`, height: '100%', background: checklist.status === 'completed' ? '#00875A' : 'var(--vault-primary)' }} />
                                            </div>
                                            <div style={{ fontSize: 10, color: 'var(--vault-ink-muted)', marginTop: 4 }}>
                                                {completedSteps} / {totalSteps} steps
                                            </div>
                                        </td>
                                        <td style={{ fontSize: 13 }}>{checklist.initiatedBy.name}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            <Link
                                                href={`/settings/offboarding/${checklist._id}`}
                                                className="vault-btn vault-btn--secondary"
                                                style={{ fontSize: 12, padding: '4px 12px' }}
                                            >
                                                {checklist.status === 'completed' ? 'View Record' : 'Continue'}
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
