'use client';

import { useEffect } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { ROLE_LABELS, type VaultRole } from '@/lib/constants';

interface Member {
    _id: string;
    name: string;
    email: string;
    role: VaultRole;
    jobTitle?: string;
    department?: string;
    avatarUrl?: string;
    reportingTo?: { _id: string; name: string; role: VaultRole } | null;
    isActive: boolean;
    projects?: { _id: string; name: string; color: string }[];
}

interface Props {
    member: Member | null;
    onClose: () => void;
    onEdit?: () => void;
    canEdit: boolean;
}

export function MemberProfileSlideOver({ member, onClose, onEdit, canEdit }: Props) {
    // Close on Escape
    useEffect(() => {
        if (!member) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [member, onClose]);

    if (!member) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed', inset: 0,
                    background: 'rgba(9,30,66,0.35)',
                    zIndex: 150,
                    animation: 'vaultFadeIn 150ms ease',
                }}
            />

            {/* Panel */}
            <div
                style={{
                    position: 'fixed', top: 0, right: 0, bottom: 0,
                    width: 380, background: 'var(--vault-bg)',
                    boxShadow: '-4px 0 24px rgba(9,30,66,0.15)',
                    zIndex: 160,
                    display: 'flex', flexDirection: 'column',
                    animation: 'slideInRight 200ms ease',
                    overflowY: 'auto',
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--vault-border)' }}>
                    <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--vault-ink)', margin: 0 }}>Member profile</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--vault-ink-muted)', lineHeight: 1 }}>×</button>
                </div>

                {/* Body */}
                <div style={{ padding: '24px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Profile header */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
                        <Avatar name={member.name} src={member.avatarUrl} size="xl" />
                        <div>
                            <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--vault-ink)', margin: 0 }}>{member.name}</p>
                            {member.jobTitle && <p style={{ fontSize: 13, color: 'var(--vault-ink-muted)', marginTop: 2, marginBottom: 0 }}>{member.jobTitle}</p>}
                        </div>
                        <Badge role={member.role} />
                        {!member.isActive && <Badge variant="danger">Inactive</Badge>}
                    </div>

                    {/* Details */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {member.department && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                <span style={{ color: 'var(--vault-ink-muted)' }}>Department</span>
                                <span style={{ fontWeight: 500 }}>{member.department}</span>
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                            <span style={{ color: 'var(--vault-ink-muted)' }}>Email</span>
                            <a href={`mailto:${member.email}`} style={{ color: 'var(--vault-primary)' }}>{member.email}</a>
                        </div>
                    </div>

                    {/* Reporting chain */}
                    {member.reportingTo && (
                        <div>
                            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--vault-ink-subtle)', marginBottom: 8 }}>Reports to</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--vault-surface)', borderRadius: 6 }}>
                                <Avatar name={member.reportingTo.name} size="sm" />
                                <div>
                                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--vault-ink)', margin: 0 }}>{member.reportingTo.name}</p>
                                    <p style={{ fontSize: 11, color: 'var(--vault-ink-muted)', margin: 0 }}>{ROLE_LABELS[member.reportingTo.role]}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Projects */}
                    {member.projects && member.projects.length > 0 && (
                        <div>
                            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--vault-ink-subtle)', marginBottom: 8 }}>
                                Projects ({member.projects.length})
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {member.projects.map((p: any) => (
                                    <Link key={p._id} href={`/projects/${p._id}`} style={{ textDecoration: 'none' }}>
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: 8,
                                            padding: '8px 10px', background: 'var(--vault-surface)',
                                            borderRadius: 6, borderLeft: `3px solid ${p.color || '#0052CC'}`,
                                        }}>
                                            <span style={{ fontSize: 13, color: 'var(--vault-ink)', fontWeight: 500 }}>{p.name}</span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {canEdit && (
                    <div style={{ padding: '12px 20px', borderTop: '1px solid var(--vault-border)' }}>
                        <Button variant="secondary" onClick={onEdit} style={{ width: '100%' }}>Edit member</Button>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to   { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </>
    );
}
