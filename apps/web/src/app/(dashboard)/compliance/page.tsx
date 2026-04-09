'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { API_BASE_URL } from '@/lib/constants';
import { useAuth } from '@/components/auth/auth-provider';

interface ComplianceHealth {
    summary: {
        avgScore: number;
        totalOverdue: number;
        totalExpiring: number;
        totalProjects: number;
    };
    projects: Array<{
        projectId: string;
        projectName: string;
        color: string;
        score: number;
        overdueReviews: number;
        expiringItems: number;
        lastReviewDate?: string;
    }>;
}

export default function ComplianceHealthPage() {
    const { user } = useAuth();
    const [health, setHealth] = useState<ComplianceHealth | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchHealth = useCallback(async () => {
        const { data } = await api.get<any>('/api/v1/compliance/health');
        setHealth((data as any)?.data ?? null);
        setLoading(false);
    }, []);

    useEffect(() => { fetchHealth(); }, [fetchHealth]);

    const getScoreColor = (score: number) => {
        if (score >= 90) return '#00875A'; // Green
        if (score >= 70) return '#FFAB00'; // Yellow
        return '#DE350B'; // Red
    };

    if (loading) return <div className="vault-page ripple">Loading compliance health…</div>;
    if (!health) return <div className="vault-page">Failed to load compliance data.</div>;

    return (
        <main className="vault-page">
            <div className="vault-page-header">
                <div>
                    <h1 className="vault-page-title">Compliance Health</h1>
                    <p className="vault-page-subtitle">Organisation-wide security posture and project governance overview.</p>
                </div>
            </div>

            {/* Aggregated Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
                <div className="vault-card" style={{ textAlign: 'center', borderTop: `4px solid ${getScoreColor(health.summary.avgScore)}` }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--vault-ink-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Avg. Health Score</p>
                    <p style={{ fontSize: 42, fontWeight: 800, color: getScoreColor(health.summary.avgScore), margin: 0 }}>{health.summary.avgScore}<span style={{ fontSize: 18, opacity: 0.6 }}>/100</span></p>
                </div>
                <div className="vault-card" style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--vault-ink-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Overdue Reviews</p>
                    <p style={{ fontSize: 42, fontWeight: 800, color: health.summary.totalOverdue > 0 ? '#DE350B' : 'var(--vault-ink)', margin: 0 }}>{health.summary.totalOverdue}</p>
                    <p style={{ fontSize: 11, color: 'var(--vault-ink-muted)', marginTop: 4 }}>Across {health.summary.totalProjects} projects</p>
                </div>
                <div className="vault-card" style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--vault-ink-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Expiring Credentials</p>
                    <p style={{ fontSize: 42, fontWeight: 800, color: health.summary.totalExpiring > 0 ? '#FFAB00' : 'var(--vault-ink)', margin: 0 }}>{health.summary.totalExpiring}</p>
                    <p style={{ fontSize: 11, color: 'var(--vault-ink-muted)', marginTop: 4 }}>Next 30 days</p>
                </div>
            </div>

            {/* Project Table */}
            <div className="vault-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--vault-border)', background: 'var(--vault-surface)' }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Project Risk Levels</h3>
                </div>
                <table className="vault-table">
                    <thead>
                        <tr>
                            <th>Project</th>
                            <th>Health Score</th>
                            <th>Overdue Reviews</th>
                            <th>Expiring Items</th>
                            <th>Last Access Review</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {health.projects.map(p => (
                            <tr key={p.projectId}>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color }} />
                                        <span style={{ fontWeight: 600 }}>{p.projectName}</span>
                                    </div>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ flex: 1, height: 8, background: 'var(--vault-border)', borderRadius: 4, overflow: 'hidden', minWidth: 80 }}>
                                            <div style={{ width: `${p.score}%`, height: '100%', background: getScoreColor(p.score) }} />
                                        </div>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: getScoreColor(p.score) }}>{p.score}%</span>
                                    </div>
                                </td>
                                <td>
                                    <span style={{ 
                                        fontSize: 12, fontWeight: 600, 
                                        color: p.overdueReviews > 0 ? '#DE350B' : 'var(--vault-ink-muted)' 
                                    }}>
                                        {p.overdueReviews}
                                    </span>
                                </td>
                                <td>
                                    <span style={{ 
                                        fontSize: 12, fontWeight: 600, 
                                        color: p.expiringItems > 0 ? '#FFAB00' : 'var(--vault-ink-muted)' 
                                    }}>
                                        {p.expiringItems}
                                    </span>
                                </td>
                                <td style={{ fontSize: 13, color: 'var(--vault-ink-muted)' }}>
                                    {p.lastReviewDate ? new Date(p.lastReviewDate).toLocaleDateString() : 'Never'}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                    <Link href={`/projects/${p.projectId}`} className="vault-btn vault-btn--secondary" style={{ fontSize: 11, padding: '4px 10px' }}>
                                        Fix Issues
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Risk Factors & Reports */}
            <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <div className="vault-card">
                    <h4 style={{ margin: '0 0 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                        📋 Compliance Reports
                    </h4>
                    <p style={{ fontSize: 12, color: 'var(--vault-ink-muted)', marginBottom: 16 }}>
                        Generate audit-ready CSV reports for your organisation.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button 
                            className="vault-btn vault-btn--secondary" 
                            style={{ fontSize: 11 }}
                            onClick={() => {
                                const token = localStorage.getItem('vault_token');
                                window.open(`${API_BASE_URL}/api/v1/compliance/reports/export?type=access_reviews&token=${token}`, '_blank');
                            }}
                        >
                            Export Access Reviews
                        </button>
                        <button 
                            className="vault-btn vault-btn--secondary" 
                            style={{ fontSize: 11 }}
                            onClick={() => {
                                const token = localStorage.getItem('vault_token');
                                window.open(`${API_BASE_URL}/api/v1/compliance/reports/export?type=change_log&token=${token}`, '_blank');
                            }}
                        >
                            Export Change Log
                        </button>
                    </div>
                </div>
                <div className="vault-card">
                    <h4 style={{ margin: '0 0 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                        ⚖️ Dual Approval Queue
                    </h4>
                    <p style={{ fontSize: 12, color: 'var(--vault-ink-muted)', marginBottom: 16 }}>
                        Manage pending access requests for mission-critical credentials.
                    </p>
                    <Link href="/compliance/approvals" className="vault-btn vault-btn--secondary" style={{ fontSize: 11, display: 'inline-block' }}>
                        View Approval Queue
                    </Link>
                </div>
                <div className="vault-card">
                    <h4 style={{ margin: '0 0 12px', fontSize: 13 }}>Health Score Calculation</h4>
                    <ul style={{ fontSize: 12, color: 'var(--vault-ink-muted)', paddingLeft: 20, margin: 0 }}>
                        <li style={{ marginBottom: 6 }}>Starts at 100 points per project.</li>
                        <li style={{ marginBottom: 6 }}>-20 points for each <b>Overdue Access Review</b>.</li>
                        <li style={{ marginBottom: 6 }}>-5 points for each <b>Expiring Credential</b> (within 30 days).</li>
                    </ul>
                </div>
            </div>
        </main>
    );
}
