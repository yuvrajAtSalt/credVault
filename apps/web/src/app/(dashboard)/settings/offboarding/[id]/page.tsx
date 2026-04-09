'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { API_BASE_URL } from '@/lib/constants';
import { useAuth } from '@/components/auth/auth-provider';
import { useToast } from '@/components/ui/Toast';

export default function OffboardingDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const { token } = useAuth();
    const { toast } = useToast();

    const [checklist, setChecklist] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [completing, setCompleting] = useState(false);
    const [auditLoading, setAuditLoading] = useState<string | null>(null);

    const fetchChecklist = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/offboarding/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const json = await res.json();
            if (res.ok) {
                setChecklist(json.data);
            } else {
                toast.error('Failed to load checklist.');
            }
        } finally {
            setLoading(false);
        }
    }, [id, token, toast]);

    useEffect(() => {
        fetchChecklist();
    }, [fetchChecklist]);

    const handleStepUpdate = async (stepId: string, status: 'completed' | 'skipped') => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/offboarding/${id}/steps/${stepId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ status }),
            });
            if (res.ok) {
                const json = await res.json();
                setChecklist(json.data);
                toast.success('Step updated');
            }
        } catch (e) {
            toast.error('Network error.');
        }
    };

    const handleAuditAction = async (credId: string, action: string) => {
        setAuditLoading(credId);
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/offboarding/${id}/credentials/${credId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ action }),
            });
            if (res.ok) {
                const json = await res.json();
                setChecklist(json.data);
                toast.success('Audit updated');
            }
        } finally {
            setAuditLoading(null);
        }
    };

    const handleComplete = async () => {
        setCompleting(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/offboarding/${id}/complete`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                toast.success('Offboarding workflow completed!');
                router.push('/settings/offboarding');
            } else {
                const json = await res.json();
                toast.error(json.error?.message || 'Check if all steps are done.');
            }
        } finally {
            setCompleting(false);
        }
    };

    if (loading) return <div style={{ padding: 48, textAlign: 'center' }}>Loading checklist details…</div>;
    if (!checklist) return <div style={{ padding: 48, textAlign: 'center' }}>Checklist not found.</div>;

    const completedSteps = checklist.steps.filter((s: any) => s.status !== 'pending').length;
    const totalSteps = checklist.steps.length;
    const progress = (completedSteps / totalSteps) * 100;

    return (
        <div className="vault-page">
            <div className="vault-page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--vault-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800 }}>
                        {checklist.userId.name[0]}
                    </div>
                    <div>
                        <h1 className="vault-page-title">Offboarding: {checklist.userId.name}</h1>
                        <p className="vault-page-subtitle">Last working day: {new Date(checklist.targetDate).toLocaleDateString()} · {checklist.status.toUpperCase()}</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button className="vault-btn vault-btn--secondary" onClick={() => router.push('/settings/offboarding')}>Back</button>
                    {checklist.status !== 'completed' && (
                        <button
                            className="vault-btn vault-btn--primary"
                            disabled={completedSteps < totalSteps - 1 || completing}
                            onClick={handleComplete}
                        >
                            {completing ? 'Finalising...' : 'Complete Offboarding'}
                        </button>
                    )}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 24 }}>
                {/* Steps Section */}
                <div style={{ gridColumn: 'span 7' }}>
                    <div className="vault-card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--vault-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: 15 }}>Operational Checklist</h3>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--vault-ink-muted)' }}>{completedSteps} / {totalSteps} COMPLETE</span>
                        </div>
                        <div>
                            {checklist.steps.map((step: any, idx: number) => {
                                const isDone = step.status !== 'pending';
                                return (
                                    <div 
                                        key={step.id} 
                                        style={{ 
                                            padding: '24px', 
                                            borderBottom: idx === totalSteps - 1 ? 'none' : '1px solid var(--vault-border)',
                                            background: isDone ? 'rgba(0,135,90,0.02)' : 'transparent',
                                            opacity: checklist.status === 'completed' ? 0.8 : 1
                                        }}
                                    >
                                        <div style={{ display: 'flex', gap: 16 }}>
                                            <div style={{ 
                                                width: 24, height: 24, borderRadius: '50%', 
                                                background: isDone ? '#00875A' : 'var(--vault-border)',
                                                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: 12, flexShrink: 0, marginTop: 2
                                            }}>
                                                {isDone ? '✓' : idx + 1}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div>
                                                        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: isDone ? 'var(--vault-ink-muted)' : 'var(--vault-ink)' }}>
                                                            {step.label}
                                                        </h4>
                                                        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--vault-ink-muted)', lineHeight: 1.5 }}>
                                                            {step.description}
                                                        </p>
                                                    </div>
                                                    {checklist.status !== 'completed' && !isDone && (
                                                        <button 
                                                            className="vault-btn vault-btn--secondary"
                                                            style={{ fontSize: 11, padding: '4px 10px' }}
                                                            onClick={() => handleStepUpdate(step.id, 'completed')}
                                                        >
                                                            Mark Complete
                                                        </button>
                                                    )}
                                                </div>
                                                {isDone && (
                                                    <div style={{ marginTop: 12, fontSize: 11, color: '#00875A', fontWeight: 600 }}>
                                                        Completed by {step.completedBy?.name || 'System'} on {new Date(step.completedAt).toLocaleString()}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Audit Section */}
                <div style={{ gridColumn: 'span 5' }}>
                    <div className="vault-card" style={{ padding: 0 }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--vault-border)' }}>
                            <h3 style={{ margin: 0, fontSize: 15 }}>Credential Ownership Audit</h3>
                            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--vault-ink-muted)' }}>
                                Review all secrets created by this user.
                            </p>
                        </div>
                        <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                            {checklist.credentialAudit.length === 0 ? (
                                <div style={{ padding: 48, textAlign: 'center', color: 'var(--vault-ink-muted)', fontSize: 13 }}>
                                    No credentials found for this user.
                                </div>
                            ) : (
                                checklist.credentialAudit.map((item: any, idx: number) => {
                                    const isPending = item.action === 'pending';
                                    return (
                                        <div 
                                            key={item.credentialId} 
                                            style={{ 
                                                padding: '20px 24px', 
                                                borderBottom: idx === checklist.credentialAudit.length - 1 ? 'none' : '1px solid var(--vault-border)',
                                                background: !isPending ? 'rgba(0,0,0,0.02)' : 'transparent'
                                            }}
                                        >
                                            <div style={{ marginBottom: 12 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span style={{ fontSize: 14 }}>{item.category === 'DB' ? '🗄' : '🔑'}</span>
                                                    <span style={{ fontWeight: 600, fontSize: 13 }}>{item.label}</span>
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--vault-ink-muted)', marginTop: 2 }}>{item.projectName}</div>
                                            </div>

                                            {checklist.status !== 'completed' && isPending ? (
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <button 
                                                        className="vault-btn vault-btn--secondary" 
                                                        style={{ fontSize: 10, flex: 1, padding: '4px' }}
                                                        disabled={auditLoading === item.credentialId}
                                                        onClick={() => handleAuditAction(item.credentialId, 'retain')}
                                                    >
                                                        Retain
                                                    </button>
                                                    <button 
                                                        className="vault-btn vault-btn--secondary" 
                                                        style={{ fontSize: 10, flex: 1, padding: '4px' }}
                                                        disabled={auditLoading === item.credentialId}
                                                        onClick={() => handleAuditAction(item.credentialId, 'delete')}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span style={{ 
                                                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                                                        background: item.action === 'delete' ? '#DE350B15' : '#00875A15',
                                                        color: item.action === 'delete' ? '#DE350B' : '#00875A',
                                                        textTransform: 'uppercase'
                                                    }}>
                                                        {item.action}ED
                                                    </span>
                                                    <span style={{ fontSize: 11, color: 'var(--vault-ink-muted)' }}>
                                                        by {item.actionBy?.name || 'Admin'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
