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
import { EnvManagerPanel } from '@/components/envs/EnvManagerPanel';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';
import type { VaultRole } from '@/lib/constants';
import { ROLE_LABELS } from '@/lib/constants';

type PopulatedMember = {
    userId: { _id: string; name: string; email: string; role: VaultRole; avatarUrl?: string; jobTitle?: string };
    addedAt?: string;
};

type PopulatedLink = {
    _id: string;
    title: string;
    url: string;
    addedBy: string;
    addedAt: string;
};

type PopulatedProject = {
    _id: string;
    name: string;
    description?: string;
    color: string;
    tags: string[];
    status: string;
    members: PopulatedMember[];
    links: PopulatedLink[];
    createdBy: { _id: string; name: string };
    createdAt: string;
};

type UserResult = { _id: string; name: string; email: string; role: VaultRole };

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'neutral'> = {
    active: 'success', planning: 'warning', archived: 'neutral',
};

type Tab = 'credentials' | 'environments' | 'resources' | 'members';

export default function ProjectDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { user } = useAuth();
    const perms = usePermissions();

    const [project, setProject]         = useState<PopulatedProject | null>(null);
    const [loading, setLoading]         = useState(true);
    const [error, setError]             = useState('');
    const [activeTab, setActiveTab]     = useState<Tab>('credentials');
    const [showAddMember, setShowAdd]   = useState(false);
    const [memberSearch, setMemberSearch] = useState('');
    const [memberResults, setMemberResults] = useState<UserResult[]>([]);
    const [addingId, setAddingId]       = useState('');
    const [removingId, setRemovingId]   = useState('');
    const [confirmRemove, setConfirmRemove] = useState<UserResult | null>(null);

    const [showAddLink, setShowAddLink] = useState(false);
    const [newLink, setNewLink]         = useState({ title: '', url: '' });
    const [addingLink, setAddingLink]   = useState(false);
    const [previewLink, setPreviewLink] = useState<PopulatedLink | null>(null);

    const getPreviewUrl = (url: string) => {
        if (url.includes('docs.google.com/document/d/')) {
            const id = url.split('/d/')[1]?.split('/')[0];
            return `https://docs.google.com/document/d/${id}/preview`;
        }
        if (url.includes('docs.google.com/spreadsheets/d/')) {
            const id = url.split('/d/')[1]?.split('/')[0];
            return `https://docs.google.com/spreadsheets/d/${id}/edit?rm=minimal`;
        }
        return null;
    };

    const getThumbnailUrl = (url: string) => {
        const docMatch = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
        if (docMatch) return `https://docs.google.com/document/d/${docMatch[1]}/thumbnail?sz=w400`;
        const sheetMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
        if (sheetMatch) return `https://docs.google.com/spreadsheets/d/${sheetMatch[1]}/thumbnail?sz=w400`;
        return null;
    };

    const [resourceSearch, setResourceSearch] = useState('');
    const [resourceView, setResourceView]     = useState<'grid' | 'list'>('grid');

    const fetchProject = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        const { data, error: err } = await api.get<any>(`/api/v1/projects/${id}`);
        if (err) { setError(err.message); setLoading(false); return; }
        setProject((data as any)?.data ?? null);
        setLoading(false);
    }, [id]);

    useEffect(() => { fetchProject(); }, [fetchProject]);

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

    const handleAddLink = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddingLink(true);
        const { error: err } = await api.post(`/api/v1/projects/${id}/links`, newLink);
        if (!err) {
            await fetchProject();
            setShowAddLink(false);
            setNewLink({ title: '', url: '' });
        }
        setAddingLink(false);
    };

    const handleRemoveLink = async (linkId: string) => {
        await api.delete(`/api/v1/projects/${id}/links/${linkId}`);
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

    const TABS: { key: Tab; label: string }[] = [
        { key: 'credentials', label: 'Credentials' },
        { key: 'environments', label: 'Environments' },
        { key: 'resources',    label: 'Resources' },
        { key: 'members',     label: `Members (${project.members.length})` },
    ];

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

            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--vault-border)', marginBottom: 20 }}>
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        id={`tab-${tab.key}`}
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                            padding: '8px 20px', fontSize: 13, fontWeight: 600,
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: activeTab === tab.key ? 'var(--vault-primary)' : 'var(--vault-ink-muted)',
                            borderBottom: activeTab === tab.key ? '2px solid var(--vault-primary)' : '2px solid transparent',
                            marginBottom: -2, transition: 'color 120ms',
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            {activeTab === 'credentials' && (
                <CredentialPanel
                    projectId={id}
                    members={project.members as any}
                    isCreator={String(project.createdBy?._id) === String(user?._id)}
                />
            )}

            {activeTab === 'environments' && (
                <EnvManagerPanel projectId={id} />
            )}

            {activeTab === 'resources' && (
                <div className="vault-card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                        <div>
                            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--vault-ink)', margin: 0 }}>Project Resources</h2>
                            <p style={{ fontSize: 12, color: 'var(--vault-ink-muted)', marginTop: 2 }}>Manage external documents, sheets and links.</p>
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <div style={{ display: 'flex', background: '#EBECF0', borderRadius: 6, padding: 2 }}>
                                <button 
                                    onClick={() => setResourceView('grid')}
                                    style={{ padding: '4px 8px', border: 'none', borderRadius: 4, background: resourceView === 'grid' ? '#fff' : 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, boxShadow: resourceView === 'grid' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none' }}
                                >
                                    田 Grid
                                </button>
                                <button 
                                    onClick={() => setResourceView('list')}
                                    style={{ padding: '4px 8px', border: 'none', borderRadius: 4, background: resourceView === 'list' ? '#fff' : 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, boxShadow: resourceView === 'list' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none' }}
                                >
                                    ☰ List
                                </button>
                            </div>
                            <Button variant="secondary" size="sm" onClick={() => setShowAddLink(true)}>+ Add resource</Button>
                        </div>
                    </div>

                    <div style={{ marginBottom: 20 }}>
                        <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--vault-ink-subtle)', fontSize: 14 }}>🔍</span>
                            <Input 
                                placeholder="Search resources..." 
                                value={resourceSearch}
                                onChange={e => setResourceSearch(e.target.value)}
                                style={{ paddingLeft: 34, fontSize: 13 }}
                            />
                        </div>
                    </div>

                    {project.links?.length === 0 ? (
                        <div style={{ padding: '60px 20px', textAlign: 'center', background: 'var(--vault-surface)', borderRadius: 8, border: '2px dashed var(--vault-border)' }}>
                            <div style={{ fontSize: 32, marginBottom: 12 }}>🖇️</div>
                            <p style={{ color: 'var(--vault-ink)', fontSize: 15, fontWeight: 600 }}>No resources yet</p>
                            <p style={{ color: 'var(--vault-ink-muted)', fontSize: 13, marginTop: 4 }}>Add related Google Docs, project sheets, or external documentation links.</p>
                            <Button variant="primary" size="sm" style={{ marginTop: 20 }} onClick={() => setShowAddLink(true)}>+ Add first resource</Button>
                        </div>
                    ) : (
                        <div style={{ 
                            display: resourceView === 'grid' ? 'grid' : 'flex', 
                            flexDirection: resourceView === 'grid' ? undefined : 'column',
                            gridTemplateColumns: resourceView === 'grid' ? 'repeat(auto-fill, minmax(280px, 1fr))' : undefined, 
                            gap: 16 
                        }}>
                            {(project.links || [])
                                .filter(l => l.title.toLowerCase().includes(resourceSearch.toLowerCase()) || l.url.toLowerCase().includes(resourceSearch.toLowerCase()))
                                .map(link => {
                                    const isGoogle = link.url.includes('docs.google.com');

                                    const Thumbnail = ({ url }: { url: string }) => {
                                        const [failed, setFailed] = useState(false);
                                        const thumb = getThumbnailUrl(url);
                                        if (failed || !thumb) {
                                            return <div style={{ fontSize: 48, filter: 'grayscale(0.5) opacity(0.3)' }}>{isGoogle ? '📄' : '🔗'}</div>;
                                        }
                                        return (
                                            <img 
                                                src={thumb} 
                                                alt="Preview" 
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }} 
                                                onError={() => setFailed(true)} 
                                            />
                                        );
                                    };
                                    
                                    if (resourceView === 'list') {
                                        return (
                                            <div key={link._id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: 'var(--vault-surface)', border: '1px solid var(--vault-border)', borderRadius: 8 }}>
                                                <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--vault-primary-faint)', color: 'var(--vault-primary)', borderRadius: '6px', fontSize: 16, flexShrink: 0 }}>
                                                    {isGoogle ? '📄' : '🔗'}
                                                </div>
                                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <a href={link.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14, fontWeight: 600, color: 'var(--vault-ink)', textDecoration: 'none' }}>
                                                            {link.title}
                                                        </a>
                                                        {getPreviewUrl(link.url) && (
                                                            <button 
                                                                onClick={() => setPreviewLink(link)}
                                                                style={{ background: 'var(--vault-primary-faint)', border: 'none', color: 'var(--vault-primary)', padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 800, cursor: 'pointer', letterSpacing: '0.02em' }}
                                                            >
                                                                PREVIEW
                                                            </button>
                                                        )}
                                                    </div>
                                                    <span style={{ fontSize: 11, color: 'var(--vault-ink-muted)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {link.url}
                                                    </span>
                                                </div>
                                                <button 
                                                    onClick={() => handleRemoveLink(link._id)}
                                                    style={{ background: 'none', border: 'none', color: 'var(--vault-ink-subtle)', cursor: 'pointer', fontSize: 14, padding: 6, opacity: 0.6, transition: 'opacity 0.2s' }}
                                                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                                    onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div key={link._id} className="vault-resource-card" style={{ display: 'flex', flexDirection: 'column', background: 'var(--vault-surface)', border: '1px solid var(--vault-border)', borderRadius: 10, overflow: 'hidden', transition: 'all 0.2s' }}>
                                            <div style={{ height: 140, background: '#f0f2f5', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                                <Thumbnail url={link.url} />
                                                <div className="preview-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }}>
                                                    {getPreviewUrl(link.url) && (
                                                        <Button size="sm" onClick={() => setPreviewLink(link)}>Quick Preview</Button>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ padding: '14px', borderTop: '1px solid var(--vault-border)' }}>
                                                <a href={link.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--vault-ink)', textDecoration: 'none', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {link.title}
                                                </a>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                                                    <span style={{ fontSize: 11, color: 'var(--vault-ink-muted)', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                        {isGoogle ? 'Google Drive' : 'External Link'}
                                                    </span>
                                                    <button 
                                                        onClick={() => handleRemoveLink(link._id)}
                                                        style={{ background: 'none', border: 'none', color: 'var(--vault-ink-subtle)', cursor: 'pointer', fontSize: 12 }}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'members' && (
                <div className="vault-card">
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
            )}

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

            <ConfirmDialog
                isOpen={!!confirmRemove}
                onClose={() => setConfirmRemove(null)}
                onConfirm={handleRemoveMember}
                title="Remove member"
                message={`Remove ${confirmRemove?.name} from this project?`}
                confirmLabel="Remove"
                loading={!!removingId}
            />

            <Modal isOpen={showAddLink} onClose={() => setShowAddLink(false)} title="Add resource link" width="sm">
                <form onSubmit={handleAddLink} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--vault-ink-muted)', marginBottom: 6 }}>Title</label>
                        <Input 
                            placeholder="e.g. Project Roadmap" 
                            required 
                            value={newLink.title} 
                            onChange={e => setNewLink({ ...newLink, title: e.target.value })}
                            autoFocus
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--vault-ink-muted)', marginBottom: 6 }}>URL</label>
                        <Input 
                            placeholder="https://docs.google.com/..." 
                            required 
                            type="url"
                            value={newLink.url} 
                            onChange={e => setNewLink({ ...newLink, url: e.target.value })}
                        />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                        <Button variant="secondary" onClick={() => setShowAddLink(false)}>Cancel</Button>
                        <Button type="submit" loading={addingLink}>Add Resource</Button>
                    </div>
                </form>
            </Modal>

            {/* Preview Modal */}
            <Modal 
                isOpen={!!previewLink} 
                onClose={() => setPreviewLink(null)} 
                title={previewLink?.title || 'Preview'} 
                width="lg"
            >
                {previewLink && (
                    <div style={{ width: '100%', height: '80vh', background: '#f9f9f9', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <iframe 
                            src={getPreviewUrl(previewLink.url) || ''} 
                            style={{ flex: 1, border: 'none' }}
                            title={previewLink.title}
                        />
                        <div style={{ padding: '12px', borderTop: '1px solid var(--vault-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' }}>
                            <span style={{ fontSize: 12, color: 'var(--vault-ink-muted)' }}>
                                Showing preview. You must be logged into the same Google account that has access.
                            </span>
                            <Button size="sm" onClick={() => window.open(previewLink.url, '_blank')}>Open in new tab</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </main>
    );
}
