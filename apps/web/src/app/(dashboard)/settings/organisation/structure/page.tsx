'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { OrgTreeRenderer } from '@/components/directory/OrgTreeRenderer';
import { MemberEditorSlideOver } from '@/components/directory/MemberEditorSlideOver';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/components/auth/auth-provider';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';

interface Team { _id: string; name: string; slug: string; color: string; description?: string; leadId?: any; parentTeamId?: any; memberCount?: number; }
interface OrgMember { _id: string; name: string; role: string; jobTitle?: string; department?: string; avatarUrl?: string; isOrgRoot?: boolean; reportingTo?: any; teamId?: any; }

export default function OrgStructurePage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const [teams, setTeams]               = useState<Team[]>([]);
    const [allMembers, setAllMembers]     = useState<OrgMember[]>([]);
    const [roots, setRoots]               = useState<any[]>([]);
    const [unassigned, setUnassigned]     = useState<any[]>([]);
    const [loading, setLoading]           = useState(true);
    const [selectedMember, setSelected]   = useState<OrgMember | null>(null);
    const [highlightTeam, setHighlight]   = useState('');
    const [showAddTeam, setShowAddTeam]   = useState(false);
    const [editTeam, setEditTeam]         = useState<Team | null>(null);
    const [confirmDeleteTeam, setDeleteTeam] = useState<Team | null>(null);
    const [teamForm, setTeamForm]         = useState({ name: '', description: '', color: '#0052CC', icon: '', leadId: '' });
    const [savingTeam, setSavingTeam]     = useState(false);
    const [search, setSearch]             = useState('');

    // Guard: sysadmin only
    useEffect(() => {
        if (user && user.role !== 'SYSADMIN') router.replace('/dashboard');
    }, [user, router]);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        const [teamRes, chartRes, memberRes] = await Promise.all([
            api.get<any>('/api/v1/org/teams'),
            api.get<any>('/api/v1/org/chart'),
            api.get<any>('/api/v1/members'),
        ]);
        setTeams(teamRes.data?.data ?? []);
        setRoots(chartRes.data?.data?.roots ?? []);
        setUnassigned(chartRes.data?.data?.unassigned ?? []);
        setAllMembers(memberRes.data?.data ?? []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const handleReportingChange = async (userId: string, newManagerId: string) => {
        const { error } = await api.patch(`/api/v1/org/members/${userId}/reporting`, { reportingTo: newManagerId });
        if (error) { toast.error(error.message || 'Failed'); return; }
        toast.success('Reporting updated!');
        fetchAll();
    };

    const handleDeleteTeam = async () => {
        if (!confirmDeleteTeam) return;
        const { error } = await api.delete(`/api/v1/org/teams/${confirmDeleteTeam._id}`);
        if (error) { toast.error(error.message || 'Cannot delete team'); return; }
        toast.success(`Team "${confirmDeleteTeam.name}" deleted`);
        setDeleteTeam(null);
        fetchAll();
    };

    const handleSaveTeam = async () => {
        setSavingTeam(true);
        const payload = { ...teamForm, leadId: teamForm.leadId || undefined };
        const req = editTeam
            ? api.patch(`/api/v1/org/teams/${editTeam._id}`, payload)
            : api.post('/api/v1/org/teams', payload);
        const { error } = await req;
        setSavingTeam(false);
        if (error) { toast.error(error.message || 'Failed'); return; }
        toast.success(editTeam ? 'Team updated!' : 'Team created!');
        setShowAddTeam(false);
        setEditTeam(null);
        setTeamForm({ name: '', description: '', color: '#0052CC', icon: '', leadId: '' });
        fetchAll();
    };

    const openEditTeam = (t: Team) => {
        setEditTeam(t);
        setTeamForm({ name: t.name, description: t.description ?? '', color: t.color, icon: '', leadId: t.leadId?._id ?? '' });
        setShowAddTeam(true);
    };

    const handleSaveSnapshot = async () => {
        const label = prompt('Snapshot label (e.g. "Q2 2025 structure"):');
        if (!label) return;
        const { error } = await api.post('/api/v1/org/snapshots', { label });
        if (error) { toast.error('Failed to save snapshot'); return; }
        toast.success('Snapshot saved!');
    };

    const teamColors = ['#0052CC','#36B37E','#FF5630','#FFAB00','#6554C0','#00B8D9'];

    // Nested team tree for display
    const rootTeams = teams.filter(t => !t.parentTeamId);
    const childrenOf = (parentId: string) => teams.filter(t => String(t.parentTeamId?._id ?? t.parentTeamId) === parentId);

    return (
        <main className="vault-page">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--vault-ink)', margin: 0 }}>Org Structure</h1>
                    <p style={{ fontSize: 13, color: 'var(--vault-ink-muted)', marginTop: 4, marginBottom: 0 }}>
                        Manage teams, reporting lines, and organisation hierarchy
                    </p>
                </div>
                <button className="vault-btn" style={{ fontSize: 12 }} onClick={handleSaveSnapshot}>
                    📸 Save snapshot
                </button>
            </div>

            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                {/* ── Teams panel (left) ───────────────────────────── */}
                <div style={{ width: 240, flexShrink: 0 }}>
                    <div className="vault-card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--vault-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--vault-ink-muted)', margin: 0 }}>Teams</p>
                            <button
                                onClick={() => { setEditTeam(null); setTeamForm({ name: '', description: '', color: '#0052CC', icon: '', leadId: '' }); setShowAddTeam(true); }}
                                style={{ fontSize: 11, background: 'var(--vault-primary)', color: '#fff', border: 'none', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}
                            >
                                + New
                            </button>
                        </div>

                        {/* All filter */}
                        <button
                            onClick={() => setHighlight('')}
                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', background: !highlightTeam ? 'var(--vault-primary-light)' : 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: !highlightTeam ? 'var(--vault-primary)' : 'var(--vault-ink)', fontWeight: !highlightTeam ? 700 : 400, borderBottom: '1px solid var(--vault-border)' }}
                        >
                            All members
                        </button>

                        {loading ? (
                            <p style={{ padding: 14, fontSize: 12, color: 'var(--vault-ink-muted)' }}>Loading…</p>
                        ) : rootTeams.length === 0 ? (
                            <p style={{ padding: 14, fontSize: 12, color: 'var(--vault-ink-muted)' }}>No teams yet</p>
                        ) : (
                            rootTeams.map(t => (
                                <div key={t._id}>
                                    <TeamRow team={t} highlight={highlightTeam} onHighlight={setHighlight} onEdit={openEditTeam} onDelete={setDeleteTeam} />
                                    {childrenOf(t._id).map(child => (
                                        <div key={child._id} style={{ paddingLeft: 16 }}>
                                            <TeamRow team={child} highlight={highlightTeam} onHighlight={setHighlight} onEdit={openEditTeam} onDelete={setDeleteTeam} />
                                        </div>
                                    ))}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* ── Org chart (right) ────────────────────────────── */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="vault-card" style={{ marginBottom: 0 }}>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
                            <input
                                className="vault-input"
                                style={{ width: 200, fontSize: 12 }}
                                placeholder="Search member…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                            <p style={{ fontSize: 12, color: 'var(--vault-ink-muted)', margin: 0 }}>
                                Drag nodes to reassign reporting lines
                            </p>
                        </div>

                        {loading ? (
                            <p style={{ fontSize: 13, color: 'var(--vault-ink-muted)' }}>Loading org chart…</p>
                        ) : (
                            <OrgTreeRenderer
                                roots={roots}
                                unassigned={unassigned}
                                onSelect={(node) => setSelected(allMembers.find(m => m._id === node._id) ?? null)}
                                onReportingChange={handleReportingChange}
                                editable
                                highlightTeam={highlightTeam}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Member editor slide-over */}
            {selectedMember && (
                <MemberEditorSlideOver
                    member={selectedMember as any}
                    teams={teams}
                    allMembers={allMembers as any}
                    onClose={() => setSelected(null)}
                    onSaved={() => { setSelected(null); fetchAll(); }}
                />
            )}

            {/* Add / Edit team modal */}
            <Modal isOpen={showAddTeam} onClose={() => { setShowAddTeam(false); setEditTeam(null); }} title={editTeam ? 'Edit team' : 'New team'} width="sm">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                        <label style={labelStyle}>Name *</label>
                        <input className="vault-input" value={teamForm.name} onChange={e => setTeamForm(f => ({ ...f, name: e.target.value }))} placeholder="Engineering" />
                    </div>
                    <div>
                        <label style={labelStyle}>Description</label>
                        <input className="vault-input" value={teamForm.description} onChange={e => setTeamForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional" />
                    </div>
                    <div>
                        <label style={labelStyle}>Team lead</label>
                        <select className="vault-input" style={{ fontSize: 13 }} value={teamForm.leadId} onChange={e => setTeamForm(f => ({ ...f, leadId: e.target.value }))}>
                            <option value="">— No lead —</option>
                            {allMembers.map(m => <option key={m._id} value={m._id}>{m.name} ({m.role})</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={labelStyle}>Color</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {teamColors.map(c => (
                                <button key={c} onClick={() => setTeamForm(f => ({ ...f, color: c }))} style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer', outline: teamForm.color === c ? `3px solid ${c}` : 'none', outlineOffset: 2 }} />
                            ))}
                            <input type="color" value={teamForm.color} onChange={e => setTeamForm(f => ({ ...f, color: e.target.value }))} style={{ width: 26, height: 26, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0 }} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                        <button className="vault-btn" onClick={() => { setShowAddTeam(false); setEditTeam(null); }}>Cancel</button>
                        <button className="vault-btn vault-btn--primary" onClick={handleSaveTeam} disabled={savingTeam || !teamForm.name}>
                            {savingTeam ? 'Saving…' : editTeam ? 'Update team' : 'Create team'}
                        </button>
                    </div>
                </div>
            </Modal>

            <ConfirmDialog
                isOpen={!!confirmDeleteTeam}
                onClose={() => setDeleteTeam(null)}
                onConfirm={handleDeleteTeam}
                title="Delete team"
                message={`Delete "${confirmDeleteTeam?.name}"? All members will be unassigned from this team.`}
                confirmLabel="Delete"
            />
        </main>
    );
}

// ─── Team row sub-component ───────────────────────────────────────────────────
function TeamRow({ team, highlight, onHighlight, onEdit, onDelete }: {
    team: Team; highlight: string;
    onHighlight: (n: string) => void;
    onEdit: (t: Team) => void;
    onDelete: (t: Team) => void;
}) {
    const isActive = highlight === team.name;
    return (
        <div style={{ borderBottom: '1px solid var(--vault-border)', background: isActive ? 'var(--vault-primary-light)' : 'none' }}>
            <button
                onClick={() => onHighlight(isActive ? '' : team.name)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer' }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: team.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: isActive ? 'var(--vault-primary)' : 'var(--vault-ink)' }}>{team.name}</span>
                    {team.memberCount !== undefined && (
                        <span style={{ fontSize: 10, color: 'var(--vault-ink-muted)', marginLeft: 'auto' }}>{team.memberCount}</span>
                    )}
                </div>
                {team.leadId?.name && (
                    <p style={{ fontSize: 10, color: 'var(--vault-ink-muted)', margin: '2px 0 0 15px' }}>Lead: {team.leadId.name}</p>
                )}
            </button>
            <div style={{ display: 'flex', gap: 6, padding: '0 14px 8px 15px' }}>
                <button onClick={() => onEdit(team)} style={{ fontSize: 10, color: 'var(--vault-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Edit</button>
                <button onClick={() => onDelete(team)} style={{ fontSize: 10, color: 'var(--vault-danger)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Delete</button>
            </div>
        </div>
    );
}

const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: 'var(--vault-ink)', marginBottom: 5,
};
