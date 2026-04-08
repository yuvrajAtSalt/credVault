'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/auth-provider';
import { usePermissions } from '@/hooks/usePermissions';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { ROLE_LABELS, type VaultRole } from '@/lib/constants';

type PopulatedProject = any; // full type in types/index.ts

export default function DashboardPage() {
    const { user } = useAuth();
    const perms = usePermissions();

    const [projects, setProjects] = useState<PopulatedProject[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(true);

    const fetchProjects = useCallback(async () => {
        const { data } = await api.get<any>('/api/v1/projects');
        setProjects((data as any)?.data ?? []);
        setLoadingProjects(false);
    }, []);

    useEffect(() => { fetchProjects(); }, [fetchProjects]);

    const roleLabel = user?.role ? ROLE_LABELS[user.role as VaultRole] ?? user.role : '';
    const isSysadmin = user?.role === 'SYSADMIN';

    const stats = [
        { label: 'Total Projects',     value: loadingProjects ? '…' : String(projects.length),            color: 'var(--vault-primary)' },
        { label: 'Team Members',       value: '—',       color: 'var(--vault-warning)' },
        { label: 'Credentials Stored', value: '—',       color: 'var(--vault-success)' },
        { label: 'Your Role',          value: roleLabel,  color: 'var(--vault-ink)' },
    ];

    const recentProjects = projects.slice(0, 6);

    return (
        <main className="vault-page">
            {/* God mode banner */}
            {isSysadmin && (
                <div style={{
                    background: '#EAE6FF', color: '#403294',
                    border: '1px solid #C0B6F2', borderRadius: 6,
                    padding: '10px 16px', fontSize: 13, fontWeight: 600,
                    marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8,
                }}>
                    ⚡ God mode active — you have full system access.
                </div>
            )}

            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--vault-ink)', margin: 0 }}>Dashboard</h1>
                    {user?.role && <Badge role={user.role as VaultRole} />}
                </div>
                <p style={{ fontSize: 14, color: 'var(--vault-ink-muted)', margin: 0 }}>
                    Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''} — your secure credentials hub.
                </p>
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
                {stats.map((s) => (
                    <div key={s.label} className="vault-card">
                        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--vault-ink-muted)', marginBottom: 6 }}>
                            {s.label}
                        </p>
                        <p style={{ fontSize: s.label === 'Your Role' ? 18 : 28, fontWeight: 700, color: s.color, margin: 0, wordBreak: 'break-word' }}>
                            {s.value}
                        </p>
                    </div>
                ))}
            </div>

            {/* Recent projects */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--vault-ink)', margin: 0 }}>Recent projects</h2>
                <Link href="/projects" style={{ fontSize: 13, color: 'var(--vault-primary)', textDecoration: 'none', fontWeight: 500 }}>
                    View all →
                </Link>
            </div>

            {loadingProjects && (
                <p style={{ fontSize: 14, color: 'var(--vault-ink-muted)' }}>Loading projects…</p>
            )}

            {!loadingProjects && recentProjects.length === 0 && (
                <div className="vault-card" style={{ textAlign: 'center', padding: '32px 24px' }}>
                    <p style={{ fontSize: 14, color: 'var(--vault-ink-muted)', margin: 0 }}>
                        No projects yet. <Link href="/projects" style={{ color: 'var(--vault-primary)' }}>Create one →</Link>
                    </p>
                </div>
            )}

            {!loadingProjects && recentProjects.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
                    {recentProjects.map((p) => (
                        <ProjectCard key={p._id} project={p} />
                    ))}
                </div>
            )}

            {/* Permissions matrix */}
            <div className="vault-card" style={{ marginTop: 24 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--vault-ink)', marginBottom: 10 }}>Your permissions</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {[
                        { label: 'See all projects',    ok: perms.canSeeAllProjects() },
                        { label: 'Create project',      ok: perms.canCreateProject() },
                        { label: 'Add credential',      ok: perms.canAddCredential() },
                        { label: 'Manage team',         ok: perms.canManageTeam() },
                        { label: 'Manage roles',        ok: perms.canManageRoles() },
                        { label: 'Grant visibility',    ok: perms.canGrantVisibility() },
                        { label: 'See all credentials', ok: perms.canSeeAllCredentials() },
                        { label: 'God mode',            ok: perms.isGod() },
                    ].map(({ label, ok }) => (
                        <span key={label} className={`vault-badge ${ok ? 'vault-badge--green' : 'vault-badge--grey'}`}>
                            {ok ? '✓' : '✗'} {label}
                        </span>
                    ))}
                </div>
            </div>
        </main>
    );
}
