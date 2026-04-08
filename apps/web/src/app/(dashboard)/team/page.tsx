'use client';

import { useState, useEffect, useCallback } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { InviteMemberModal } from '@/components/team/InviteMemberModal';
import { EditMemberModal } from '@/components/team/EditMemberModal';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { VAULT_ROLES, ROLE_LABELS, type VaultRole } from '@/lib/constants';
import { formatDistanceToNow } from '@/lib/utils';

interface Member {
    _id: string;
    name: string;
    email: string;
    role: VaultRole;
    jobTitle?: string;
    department?: string;
    avatarUrl?: string;
    isActive: boolean;
    projectCount?: number;
    lastLoginAt?: string;
    reportingTo?: string;
}

const ROLE_FILTER_OPTIONS = [
    { value: '', label: 'All roles' },
    ...VAULT_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })),
];

export default function TeamPage() {
    const { user } = useAuth();
    const perms = usePermissions();

    const [tab, setTab]                 = useState<'all' | 'projects'>('all');
    const [members, setMembers]         = useState<Member[]>([]);
    const [loading, setLoading]         = useState(true);
    const [search, setSearch]           = useState('');
    const [roleFilter, setRoleFilter]   = useState('');
    const [showInvite, setShowInvite]   = useState(false);
    const [editTarget, setEditTarget]   = useState<Member | null>(null);
    const [projects, setProjects]       = useState<any[]>([]);
    const [expanded, setExpanded]       = useState<string | null>(null);

    const canInvite = perms.canManageTeam() || perms.isGod();
    const canEdit   = perms.isGod() || perms.canManageRoles();

    const fetchMembers = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (search)     params.set('search', search);
        if (roleFilter) params.set('role', roleFilter);
        const { data } = await api.get<any>(`/api/v1/members?${params}`);
        setMembers((data as any)?.data ?? []);
        setLoading(false);
    }, [search, roleFilter]);

    const fetchProjects = useCallback(async () => {
        const { data } = await api.get<any>('/api/v1/projects');
        setProjects((data as any)?.data ?? []);
    }, []);

    useEffect(() => { fetchMembers(); }, [fetchMembers]);
    useEffect(() => { if (tab === 'projects') fetchProjects(); }, [tab, fetchProjects]);

    const filteredMembers = members.filter((m) => {
        const q = search.toLowerCase();
        return (
            m.name.toLowerCase().includes(q) ||
            m.email.toLowerCase().includes(q) ||
            (m.department ?? '').toLowerCase().includes(q)
        );
    });

    const tabStyle = (active: boolean) => ({
        padding: '10px 18px', background: 'none', border: 'none',
        cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 400,
        color: active ? 'var(--vault-primary)' : 'var(--vault-ink-muted)',
        borderBottom: active ? '2px solid var(--vault-primary)' : '2px solid transparent',
        transition: 'all 120ms',
    });

    return (
        <main className="vault-page">
            {/* Page header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--vault-ink)', margin: 0 }}>Team</h1>
                    <p style={{ fontSize: 13, color: 'var(--vault-ink-muted)', marginTop: 4, marginBottom: 0 }}>
                        {members.length} member{members.length !== 1 ? 's' : ''} in your organisation
                    </p>
                </div>
                {canInvite && (
                    <Button variant="primary" onClick={() => setShowInvite(true)}>+ Invite member</Button>
                )}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--vault-border)', marginBottom: 20 }}>
                <button style={tabStyle(tab === 'all')} onClick={() => setTab('all')}>All members</button>
                <button style={tabStyle(tab === 'projects')} onClick={() => setTab('projects')}>By project</button>
            </div>

            {/* ── ALL MEMBERS TAB ────────────────────────────────────────────── */}
            {tab === 'all' && (
                <>
                    {/* Filters */}
                    <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 220 }}>
                            <Input
                                placeholder="Search by name, email, department…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div style={{ minWidth: 160 }}>
                            <Select
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value)}
                                options={ROLE_FILTER_OPTIONS}
                            />
                        </div>
                    </div>

                    {loading ? (
                        <p style={{ color: 'var(--vault-ink-muted)', fontSize: 13 }}>Loading members…</p>
                    ) : (
                        <div className="vault-card" style={{ padding: 0, overflow: 'hidden' }}>
                            {/* Table header */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '2fr 1fr 1fr 80px 120px 80px',
                                gap: 12, padding: '10px 16px',
                                background: 'var(--vault-surface)',
                                borderBottom: '1px solid var(--vault-border)',
                                fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                                letterSpacing: '0.06em', color: 'var(--vault-ink-muted)',
                            }}>
                                <span>Name</span>
                                <span>Role</span>
                                <span>Department</span>
                                <span>Projects</span>
                                <span>Last active</span>
                                <span></span>
                            </div>

                            {filteredMembers.length === 0 ? (
                                <p style={{ padding: '20px 16px', fontSize: 13, color: 'var(--vault-ink-subtle)', margin: 0 }}>No members found.</p>
                            ) : (
                                filteredMembers.map((m) => (
                                    <div
                                        key={m._id}
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '2fr 1fr 1fr 80px 120px 80px',
                                            gap: 12, padding: '12px 16px',
                                            borderBottom: '1px solid var(--vault-border)',
                                            alignItems: 'center',
                                            opacity: m.isActive ? 1 : 0.5,
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <Avatar name={m.name} src={m.avatarUrl} size="md" />
                                            <div>
                                                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--vault-ink)', margin: 0 }}>{m.name}</p>
                                                <p style={{ fontSize: 11, color: 'var(--vault-ink-muted)', margin: 0 }}>{m.email}</p>
                                            </div>
                                        </div>
                                        <Badge role={m.role} />
                                        <span style={{ fontSize: 13, color: 'var(--vault-ink-muted)' }}>{m.department || '—'}</span>
                                        <span style={{ fontSize: 13, color: 'var(--vault-ink-muted)', textAlign: 'center' }}>{m.projectCount ?? 0}</span>
                                        <span style={{ fontSize: 12, color: 'var(--vault-ink-subtle)' }}>
                                            {m.lastLoginAt ? formatDistanceToNow(m.lastLoginAt) : 'Never'}
                                        </span>
                                        <div>
                                            {(canEdit || m._id === user?._id) && (
                                                <button
                                                    onClick={() => setEditTarget(m)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vault-primary)', fontSize: 12, fontWeight: 600, padding: 0 }}
                                                >
                                                    Edit
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </>
            )}

            {/* ── BY PROJECT TAB ─────────────────────────────────────────────── */}
            {tab === 'projects' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {projects.length === 0 ? (
                        <p style={{ fontSize: 13, color: 'var(--vault-ink-muted)' }}>No projects found.</p>
                    ) : (
                        projects.map((project: any) => {
                            const isOpen = expanded === project._id;
                            const projectMembers = (project.members ?? []).filter(
                                (m: any) => typeof m.userId === 'object',
                            );
                            return (
                                <div key={project._id} className="vault-card" style={{ padding: 0, overflow: 'hidden' }}>
                                    {/* Accordion header */}
                                    <button
                                        onClick={() => setExpanded(isOpen ? null : project._id)}
                                        style={{
                                            width: '100%', display: 'flex', alignItems: 'center',
                                            gap: 10, padding: '14px 16px', background: 'none',
                                            border: 'none', cursor: 'pointer', textAlign: 'left',
                                        }}
                                    >
                                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: project.color || '#0052CC', flexShrink: 0 }} />
                                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--vault-ink)', flex: 1 }}>{project.name}</span>
                                        <Badge variant={project.status === 'active' ? 'success' : 'neutral'}>{project.status}</Badge>
                                        <span style={{ fontSize: 12, color: 'var(--vault-ink-muted)' }}>{projectMembers.length} members</span>
                                        <span style={{ color: 'var(--vault-ink-muted)', fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>
                                    </button>

                                    {isOpen && (
                                        <div style={{ borderTop: '1px solid var(--vault-border)', padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {projectMembers.map((m: any) => {
                                                const grant = (project.visibilityGrants ?? []).find(
                                                    (g: any) => String(g.grantedTo) === String(m.userId._id),
                                                );
                                                const hasFullAccess = grant?.scope === 'all';
                                                return (
                                                    <div key={m.userId._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--vault-surface)', borderRadius: 6 }}>
                                                        <Avatar name={m.userId.name} size="sm" />
                                                        <div style={{ flex: 1 }}>
                                                            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--vault-ink)', margin: 0 }}>{m.userId.name}</p>
                                                            <p style={{ fontSize: 11, color: 'var(--vault-ink-muted)', margin: 0 }}>{ROLE_LABELS[m.userId.role as VaultRole] ?? m.userId.role}</p>
                                                        </div>
                                                        <span title={hasFullAccess ? 'Full credential visibility' : 'Limited visibility'} style={{ fontSize: 16 }}>
                                                            {hasFullAccess ? '🔓' : '🔒'}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Modals */}
            <InviteMemberModal
                isOpen={showInvite}
                onClose={() => setShowInvite(false)}
                onCreated={fetchMembers}
                orgMembers={members}
            />
            <EditMemberModal
                isOpen={!!editTarget}
                onClose={() => setEditTarget(null)}
                onSaved={fetchMembers}
                member={editTarget}
                orgMembers={members}
            />
        </main>
    );
}
