'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { MemberProfileCard } from '@/components/directory/MemberProfileCard';
import { MemberProfileSlideOver } from '@/components/directory/MemberProfileSlideOver';
import { OrgTreeRenderer } from '@/components/directory/OrgTreeRenderer';
import { EditMemberModal } from '@/components/team/EditMemberModal';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import { VAULT_ROLES, ROLE_LABELS, type VaultRole } from '@/lib/constants';

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
    projects?: any[];
}

const ROLE_OPTIONS = [
    { value: '', label: 'All roles' },
    ...VAULT_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })),
];

export default function DirectoryPage() {
    const { user } = useAuth();
    const perms = usePermissions();

    const [view, setView]             = useState<'grid' | 'chart'>('grid');
    const [members, setMembers]       = useState<Member[]>([]);
    const [orgTree, setOrgTree]       = useState<any>({ roots: [], unassigned: [] });
    const [teams, setTeams]           = useState<any[]>([]);
    const [loading, setLoading]       = useState(true);
    const [search, setSearch]         = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [teamFilter, setTeamFilter] = useState('');
    const [selected, setSelected]     = useState<Member | null>(null);
    const [editTarget, setEditTarget] = useState<Member | null>(null);

    // Bulk actions Phase 10
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [bulkSaving, setBulkSaving] = useState(false);

    const canEdit = perms.isGod() || perms.canManageRoles();

    const fetchMembers = useCallback(async () => {
        setLoading(true);
        const { data } = await api.get<any>('/api/v1/members');
        setMembers((data as any)?.data ?? []);
        setLoading(false);
    }, []);

    const fetchOrgChart = useCallback(async () => {
        const { data } = await api.get<any>('/api/v1/org/chart');
        setOrgTree((data as any)?.data ?? { roots: [], unassigned: [] });
    }, []);

    const fetchTeams = useCallback(async () => {
        const { data } = await api.get<any>('/api/v1/org/teams');
        setTeams(data?.data ?? []);
    }, []);

    useEffect(() => { fetchMembers(); fetchTeams(); }, [fetchMembers, fetchTeams]);
    useEffect(() => { if (view === 'chart') fetchOrgChart(); }, [view, fetchOrgChart]);

    const handleSelectMember = async (node: any) => {
        // Fetch full member with projects
        const { data } = await api.get<any>(`/api/v1/members/${node._id}`);
        const full = (data as any)?.data;
        setSelected(full ?? node);
    };

    const filtered = members.filter((m) => {
        const q = search.toLowerCase();
        const matchSearch = !q || m.name.toLowerCase().includes(q) ||
            m.email.toLowerCase().includes(q) ||
            (m.jobTitle ?? '').toLowerCase().includes(q) ||
            (m.department ?? '').toLowerCase().includes(q);
        const matchRole = !roleFilter || m.role === roleFilter;
        // In grid view we assume member has teamId populated as an object, or we compare by .teamId itself vs teamFilter which is team's name
        const matchTeam = !teamFilter || (m as any).team?.name === teamFilter || (m as any).teamId?.name === teamFilter;
        return matchSearch && matchRole && matchTeam;
    });

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleBulkDeactivate = async () => {
        if (!confirm(`Deactivate ${selectedIds.length} users?`)) return;
        setBulkSaving(true);
        // We assume /api/v1/admin/users/bulk as we don't have the exact API yet
        await Promise.all(selectedIds.map(id => api.patch(`/api/v1/admin/users/${id}`, { isActive: false })));
        setBulkSaving(false);
        setSelectedIds([]);
        fetchMembers();
    };

    return (
        <main className="vault-page">
            {/* Page header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--vault-ink)', margin: 0 }}>Directory</h1>
                    <p style={{ fontSize: 13, color: 'var(--vault-ink-muted)', marginTop: 4, marginBottom: 0 }}>
                        Organisation-wide employee directory
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                        variant={view === 'grid' ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => setView('grid')}
                    >
                        ▦ Grid
                    </Button>
                    <Button
                        variant={view === 'chart' ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => setView('chart')}
                    >
                        ⊱ Org chart
                    </Button>
                </div>
            </div>

            {/* Filters (grid only) */}
            {view === 'grid' && (
                <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 220 }}>
                        <Input
                            placeholder="Search by name, title, department…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div style={{ minWidth: 160 }}>
                        <Select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            options={ROLE_OPTIONS}
                        />
                    </div>
                    <div style={{ minWidth: 160 }}>
                        <Select
                            value={teamFilter}
                            onChange={(e) => setTeamFilter(e.target.value)}
                            options={[
                                { value: '', label: 'All teams' },
                                ...teams.map(t => ({ value: t.name, label: t.name })),
                            ]}
                        />
                    </div>
                </div>
            )}

            {view === 'chart' && (
                <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                    <div style={{ minWidth: 200 }}>
                        <Select
                            value={teamFilter}
                            onChange={(e) => setTeamFilter(e.target.value)}
                            options={[
                                { value: '', label: 'Filter by team…' },
                                ...teams.map(t => ({ value: t.name, label: t.name })),
                            ]}
                        />
                    </div>
                </div>
            )}

            {loading ? (
                <p style={{ color: 'var(--vault-ink-muted)', fontSize: 13 }}>Loading directory…</p>
            ) : view === 'grid' ? (
                // Grid view
                <>
                    {filtered.length === 0 ? (
                        <p style={{ color: 'var(--vault-ink-subtle)', fontSize: 13 }}>No members found.</p>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                            gap: 16,
                        }}>
                            {filtered.map((m) => (
                                <MemberProfileCard
                                    key={m._id}
                                    member={m}
                                    onClick={handleSelectMember}
                                    selectable={canEdit}
                                    selected={selectedIds.includes(m._id)}
                                    onToggleSelect={toggleSelect}
                                />
                            ))}
                        </div>
                    )}
                </>
            ) : (
                // Org chart view
                <div style={{ overflowX: 'auto', paddingBottom: 32 }}>
                    <OrgTreeRenderer
                        roots={orgTree.roots}
                        unassigned={orgTree.unassigned}
                        onSelect={handleSelectMember}
                        highlightTeam={teamFilter}
                        editable={false}
                    />
                </div>
            )}

            {/* Slide-over profile panel */}
            <MemberProfileSlideOver
                member={selected}
                onClose={() => setSelected(null)}
                canEdit={canEdit || selected?._id === user?._id}
                onEdit={() => { setEditTarget(selected); setSelected(null); }}
            />

            {/* Edit modal */}
            <EditMemberModal
                isOpen={!!editTarget}
                onClose={() => setEditTarget(null)}
                onSaved={() => { fetchMembers(); if (view === 'chart') fetchOrgChart(); }}
                member={editTarget}
                orgMembers={members}
            />

            {/* Bulk action floating bar */}
            {selectedIds.length > 0 && (
                <div style={{
                    position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
                    background: 'var(--vault-surface)', border: '1px solid var(--vault-border)',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.12)', borderRadius: 8, padding: '12px 20px',
                    display: 'flex', alignItems: 'center', gap: 16, zIndex: 100,
                }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{selectedIds.length} selected</span>
                    <div style={{ width: 1, height: 24, background: 'var(--vault-border)' }} />
                    <Button variant="secondary" size="sm" onClick={() => setSelectedIds([])}>Clear</Button>
                    <Button variant="primary" size="sm" loading={bulkSaving} style={{ background: 'var(--vault-danger)', borderColor: 'var(--vault-danger)', color: '#fff' }} onClick={handleBulkDeactivate}>
                        Deactivate
                    </Button>
                </div>
            )}
        </main>
    );
}
