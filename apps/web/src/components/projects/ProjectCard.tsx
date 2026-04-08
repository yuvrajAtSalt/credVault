'use client';

import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import type { Project } from '@/types';

interface ProjectCardProps {
    project: Project & {
        credentialCount?: number;
        members: Array<{ userId: { _id: string; name: string; avatarUrl?: string } | string }>;
    };
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'neutral' | 'info'> = {
    active:   'success',
    planning: 'warning',
    archived: 'neutral',
};

export function ProjectCard({ project }: ProjectCardProps) {
    const populatedMembers = (project.members || [])
        .map((m) => (typeof m.userId === 'object' && m.userId !== null ? m.userId as { _id: string; name: string; avatarUrl?: string } : null))
        .filter((m): m is { _id: string; name: string; avatarUrl?: string } => m !== null);

    const displayedMembers = populatedMembers.slice(0, 4);
    const extra = populatedMembers.length - 4;

    return (
        <Link
            href={`/projects/${project._id}`}
            style={{ textDecoration: 'none' }}
        >
            <div
                className="vault-card"
                style={{
                    borderLeft: `4px solid ${project.color || '#0052CC'}`,
                    padding: '16px 18px',
                    cursor: 'pointer',
                    transition: 'box-shadow var(--vault-transition-fast)',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = 'var(--vault-shadow-raised)')}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'var(--vault-shadow-card)')}
            >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--vault-ink)', margin: 0, lineHeight: 1.3 }}>
                        {project.name}
                    </h3>
                    <Badge variant={STATUS_VARIANT[project.status] ?? 'neutral'}>
                        {project.status}
                    </Badge>
                </div>

                {/* Description */}
                {project.description && (
                    <p style={{
                        fontSize: 13, color: 'var(--vault-ink-muted)', margin: 0,
                        display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        lineHeight: 1.5,
                    }}>
                        {project.description}
                    </p>
                )}

                {/* Tags */}
                {project.tags?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {project.tags.map((tag) => (
                            <Badge key={tag} variant="neutral">{tag}</Badge>
                        ))}
                    </div>
                )}

                {/* Members + credential count */}
                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {displayedMembers.map((m) => (
                        <Avatar key={m._id} name={m.name} src={m.avatarUrl} size="sm" />
                    ))}
                    {extra > 0 && (
                        <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--vault-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'var(--vault-ink-muted)' }}>
                            +{extra}
                        </span>
                    )}
                    {populatedMembers.length === 0 && (
                        <span style={{ fontSize: 12, color: 'var(--vault-ink-subtle)' }}>No members yet</span>
                    )}

                    {/* Credential count */}
                    {project.credentialCount !== undefined && (
                        <span
                            title={`${project.credentialCount} credential${project.credentialCount !== 1 ? 's' : ''}`}
                            style={{
                                marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 3,
                                fontSize: 11, fontWeight: 600,
                                color: project.credentialCount > 0 ? 'var(--vault-primary)' : 'var(--vault-ink-subtle)',
                            }}
                        >
                            🔑 {project.credentialCount}
                        </span>
                    )}
                </div>
            </div>
        </Link>
    );
}
