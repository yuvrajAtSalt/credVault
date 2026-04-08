'use client';

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import type { VaultRole } from '@/lib/constants';

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
    projectCount?: number;
}

interface Props {
    member: Member;
    onClick?: (member: Member) => void;
}

export function MemberProfileCard({ member, onClick }: Props) {
    return (
        <div
            className="vault-card"
            onClick={() => onClick?.(member)}
            style={{
                cursor: onClick ? 'pointer' : 'default',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: 8,
                padding: '24px 16px',
                transition: 'box-shadow var(--vault-transition-fast)',
                opacity: member.isActive ? 1 : 0.5,
            }}
            onMouseEnter={(e) => onClick && (e.currentTarget.style.boxShadow = 'var(--vault-shadow-raised)')}
            onMouseLeave={(e) => onClick && (e.currentTarget.style.boxShadow = 'var(--vault-shadow-card)')}
        >
            <Avatar name={member.name} src={member.avatarUrl} size="xl" />

            <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--vault-ink)', margin: 0 }}>
                    {member.name}
                </p>
                {member.jobTitle && (
                    <p style={{ fontSize: 12, color: 'var(--vault-ink-muted)', margin: '2px 0 0' }}>
                        {member.jobTitle}
                    </p>
                )}
            </div>

            <Badge role={member.role} />

            {member.department && (
                <span style={{
                    background: 'var(--vault-surface-2)', color: 'var(--vault-ink-muted)',
                    borderRadius: 3, padding: '2px 8px', fontSize: 11,
                }}>
                    {member.department}
                </span>
            )}

            {member.reportingTo && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--vault-ink-subtle)' }}>Reports to:</span>
                    <Avatar name={member.reportingTo.name} size="sm" />
                    <span style={{ fontSize: 11, color: 'var(--vault-ink-muted)', fontWeight: 500 }}>
                        {member.reportingTo.name}
                    </span>
                </div>
            )}

            <a
                href={`mailto:${member.email}`}
                onClick={(e) => e.stopPropagation()}
                style={{ fontSize: 12, color: 'var(--vault-primary)', textDecoration: 'none' }}
            >
                {member.email}
            </a>
        </div>
    );
}
