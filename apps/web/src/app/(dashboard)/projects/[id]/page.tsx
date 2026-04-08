'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { CredentialPanel } from '@/components/credentials';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import type { VaultRole } from '@/lib/constants';
import { ROLE_LABELS } from '@/lib/constants';

type PopulatedMember = {
    userId: { _id: string; name: string; email: string; role: VaultRole; avatarUrl?: string; jobTitle?: string };
    addedAt?: string;
};

type PopulatedProject = {
    _id: string;
    name: string;
    description?: string;
    color: string;
    tags: string[];
    status: string;
    members: PopulatedMember[];
    createdBy: { _id: string; name: string };
    createdAt: string;
};

type UserResult = { _id: string; name: string; email: string; role: VaultRole };

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'neutral'> = {
    active: 'success', planning: 'warning', archived: 'neutral',
};

export default function ProjectDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { user } = useAuth();
    const perms = usePermissions();

    const [project, setProject]         = useState<PopulatedProject | null>(null);
    const [loading, setLoading]         = useState(true);
    const [error, setError]             = useState('');
    const [showAddMember, setShowAdd]   = useState(false);
    const [memberSearch, setMemberSearch] = useState('');
    const [memberResults, setMemberResults] = useState<UserResult[]>([]);
    const [addingId, setAddingId]       = useState('');
    const [removingId, setRemovingId]   = useState('');
    const [confirmRemove, setConfirmRemove] = useState<UserResult | null>(null);

    const fetchProject = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        const { data, error: err } = await api.get<any>(`/api/v1/projects/${id}`);
        if (err) { setError(err.message); setLoading(false); return; }
        setProject((data as any)?.data ?? null);
        setLoading(false);
    }, [id]);

    useEffect(() => { fetchProject(); }, [fetchProject]);

    // Search org users for add-member modal
    useEffect(() => {
        if (!memberSearch.trim()) { setMemberResults([]); return; }
        const timer = setTimeout(async () => {
            const { data } = await api.get<any>(`/api/v1/users?search=${encodeURIComponent(memberSearch)}`);
            const all: UserResult[] = (data as any)?.data ?? [];
            const memberIds = new Set(project?.members.map((m) => m.userId._id) ?? []);
            setMemberResults(all.filter((u) => !memberIds.has(u._id)));
        }, 300);
        return () => clearTimeout(timer);
    }, [memberSearch, project]);

    const handleAddMember = async (userId: string) => {
        setAddingId(userId);
        const { error: err } = await api.post(`/api/v1/projects/${id}/members`, { userId });
        if (!err) { await fetchProject(); setShowAdd(false); setMemberSearch(''); }
        setAddingId('');
    };

    const handleRemoveMember = async () => {
        if (!confirmRemove) return;
        setRemovingId(confirmRemove._id);
        await api.delete(`/api/v1/projects/${id}/members/${confirmRemove._id}`);
        setConfirmRemove(null);
        setRemovingId('');
        await fetchProject();
    };

    if (loading) return <main className="vault-page"><p style={{ color: 'var(--vault-ink-muted)' }}>Loading project…</p></main>;
    if (error || !project) return (
        <main className="vault-page">
            <p style={{ color: 'var(--vault-danger)', marginBottom: 12 }}>{error || 'Project not found.'}</p>
            <Button variant="secondary" onClick={() => router.back()}>← Back</Button>
        </main>
    );

    const canManage = perms.canManageTeam() || String(project.createdBy?._id) === String(user?._id);

    return (
        <main className="vault-page">
            {/* Back */}
            <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vault-ink-muted)', fontSize: 13, marginBottom: 16, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                ← Projects
            </button>

            {/* Project header */}
            <div className="vault-card" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: project.color, marginTop: 4, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--vault-ink)', margin: 0 }}>{project.name}</h1>
                            <Badge variant={STATUS_VARIANT[project.status] ?? 'neutral'}>{project.status}</Badge>
                        </div>
                        {project.description && (
                            <p style={{ fontSize: 14, color: 'var(--vault-ink-muted)', margin: '0 0 10px' }}>{project.description}</p>
                        )}
                        {project.tags?.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {project.tags.map((t) => <Badge key={t} variant="neutral">{t}</Badge>)}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Members */}
            <div className="vault-card" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--vault-ink)', margin: 0 }}>
                        Members ({project.members.length})
                    </h2>
                    {canManage && (
                        <Button variant="secondary" size="sm" onClick={() => setShowAdd(true)}>+ Add member</Button>
                    )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                    {project.members.map((m) => (
                        <div key={m.userId._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--vault-surface)', borderRadius: 6 }}>
                            <Avatar name={m.userId.name} src={m.userId.avatarUrl} size="md" />
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--vault-ink)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.userId.name}</p>
                                <p style={{ fontSize: 11, color: 'var(--vault-ink-muted)', margin: 0 }}>{ROLE_LABELS[m.userId.role] ?? m.userId.role}</p>
                            </div>
                            {canManage && m.userId._id !== user?._id && (
                                <button
                                    onClick={() => setConfirmRemove(m.userId as any)}
                                    disabled={removingId === m.userId._id}
                                    style={{ background: 'none', border: 'none', color: 'var(--vault-danger)', cursor: 'pointer', fontSize: 13, flexShrink: 0 }}
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Credentials */}
            <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--vault-ink)', margin: '0 0 12px' }}>Credentials</h2>
                <CredentialPanel
                    projectId={id}
                    members={project.members as any}
                    isCreator={String(project.createdBy?._id) === String(user?._id)}
                />
            </div>

            {/* Add member modal */}
            <Modal isOpen={showAddMember} onClose={() => { setShowAdd(false); setMemberSearch(''); setMemberResults([]); }} title="Add member" width="sm">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Input
                        placeholder="Search by name or email…"
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        autoFocus
                    />
                    {memberResults.length === 0 && memberSearch && (
                        <p style={{ fontSize: 13, color: 'var(--vault-ink-muted)', textAlign: 'center', padding: '12px 0' }}>No users found.</p>
                    )}
                    {memberResults.map((u) => (
                        <div key={u._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--vault-surface)', borderRadius: 6 }}>
                            <Avatar name={u.name} size="sm" />
                            <div style={{ flex: 1 }}>
                                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--vault-ink)', margin: 0 }}>{u.name}</p>
                                <p style={{ fontSize: 11, color: 'var(--vault-ink-muted)', margin: 0 }}>{u.email}</p>
                            </div>
                            <Button size="sm" onClick={() => handleAddMember(u._id)} loading={addingId === u._id}>Add</Button>
                        </div>
                    ))}
                </div>
            </Modal>

            {/* Remove confirm */}
            <ConfirmDialog
                isOpen={!!confirmRemove}
                onClose={() => setConfirmRemove(null)}
                onConfirm={handleRemoveMember}
                title="Remove member"
                message={`Remove ${confirmRemove?.name} from this project?`}
                confirmLabel="Remove"
                loading={!!removingId}
            />
        </main>
    );
}
