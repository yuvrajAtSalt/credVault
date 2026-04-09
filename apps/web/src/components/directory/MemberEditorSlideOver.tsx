'use client';

import { useState, useEffect } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

interface OrgMember {
    _id: string;
    name: string;
    role: string;
    jobTitle?: string;
    department?: string;
    avatarUrl?: string;
    isOrgRoot?: boolean;
    reportingTo?: { _id: string; name: string; role: string } | null;
    teamId?: { _id: string; name: string; color: string } | null;
}

interface Team {
    _id: string;
    name: string;
    color: string;
    slug: string;
}

interface Props {
    member: OrgMember | null;
    teams: Team[];
    allMembers: OrgMember[];
    onClose: () => void;
    onSaved: () => void;
}

export function MemberEditorSlideOver({ member, teams, allMembers, onClose, onSaved }: Props) {
    const { toast } = useToast();
    const [reportingTo, setReportingTo]   = useState('');
    const [teamId, setTeamId]             = useState('');
    const [jobTitle, setJobTitle]         = useState('');
    const [department, setDepartment]     = useState('');
    const [isOrgRoot, setIsOrgRoot]       = useState(false);
    const [chain, setChain]               = useState<any[]>([]);
    const [showChain, setShowChain]       = useState(false);
    const [saving, setSaving]             = useState(false);

    useEffect(() => {
        if (!member) return;
        setReportingTo(member.reportingTo?._id ?? '');
        setTeamId(member.teamId?._id ?? '');
        setJobTitle(member.jobTitle ?? '');
        setDepartment(member.department ?? '');
        setIsOrgRoot(member.isOrgRoot ?? false);
        setChain([]);
        setShowChain(false);
    }, [member]);

    const loadChain = async () => {
        if (!member) return;
        const { data } = await api.get<any>(`/api/v1/org/members/${member._id}/chain`);
        setChain(data?.data?.data?.chain ?? []);
        setShowChain(true);
    };

    const handleSave = async () => {
        if (!member) return;
        setSaving(true);
        const { error } = await api.patch(`/api/v1/org/members/${member._id}/reporting`, {
            reportingTo: reportingTo || null,
            teamId:      teamId || null,
            isOrgRoot,
        });
        // Also save profile fields via the member endpoint
        await api.patch(`/api/v1/members/${member._id}`, { jobTitle, department });
        setSaving(false);
        if (error) { toast.error(error.message || 'Failed to save'); return; }
        toast.success('Member updated!');
        onSaved();
        onClose();
    };

    if (!member) return null;

    const currentRootName = allMembers.find(m => m.isOrgRoot && m._id !== member._id)?.name;

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200 }}
            />

            {/* Slide-over panel */}
            <div style={{
                position: 'fixed', top: 0, right: 0, width: 380, height: '100vh',
                background: 'var(--vault-bg)', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
                zIndex: 201, display: 'flex', flexDirection: 'column', overflowY: 'auto',
            }}>
                {/* Header */}
                <div style={{ padding: '20px 20px 0', borderBottom: '1px solid var(--vault-border)', paddingBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <Avatar name={member.name} src={member.avatarUrl} size="lg" />
                    <div style={{ flex: 1 }}>
                        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--vault-ink)', margin: 0 }}>{member.name}</h2>
                        <Badge role={member.role as any} />
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--vault-ink-muted)', lineHeight: 1 }}>✕</button>
                </div>

                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>
                    {/* Identity */}
                    <section>
                        <h3 style={sectionTitle}>Identity</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div>
                                <label style={labelStyle}>Job title</label>
                                <input className="vault-input" style={{ fontSize: 13 }} value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="e.g. Senior Engineer" />
                            </div>
                            <div>
                                <label style={labelStyle}>Department</label>
                                <input className="vault-input" style={{ fontSize: 13 }} value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. Engineering" />
                            </div>
                        </div>
                    </section>

                    {/* Reporting */}
                    <section>
                        <h3 style={sectionTitle}>Reporting</h3>
                        <label style={labelStyle}>Reports to</label>
                        <select className="vault-input" style={{ fontSize: 13 }} value={reportingTo} onChange={e => setReportingTo(e.target.value)}>
                            <option value="">— None (unassigned) —</option>
                            {allMembers.filter(m => m._id !== member._id).map(m => (
                                <option key={m._id} value={m._id}>{m.name} ({m.role})</option>
                            ))}
                        </select>
                        {reportingTo && (
                            <button
                                onClick={() => setReportingTo('')}
                                style={{ marginTop: 6, fontSize: 11, color: 'var(--vault-danger)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            >
                                Clear reporting
                            </button>
                        )}
                        <button
                            onClick={loadChain}
                            style={{ display: 'block', marginTop: 8, fontSize: 12, color: 'var(--vault-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                            View reporting chain ↓
                        </button>
                        {showChain && chain.length > 0 && (
                            <div style={{ marginTop: 8, background: 'var(--vault-surface)', borderRadius: 6, padding: '8px 12px' }}>
                                {chain.map((c, i) => (
                                    <div key={c._id ?? i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', paddingLeft: i * 10 }}>
                                        <span style={{ fontSize: 10, color: 'var(--vault-ink-subtle)' }}>{'└─'.repeat(Math.min(i, 1))}</span>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--vault-ink)' }}>{c.name}</span>
                                        <span style={{ fontSize: 10, color: 'var(--vault-ink-muted)' }}>{c.role}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Team */}
                    <section>
                        <h3 style={sectionTitle}>Team</h3>
                        <select className="vault-input" style={{ fontSize: 13 }} value={teamId} onChange={e => setTeamId(e.target.value)}>
                            <option value="">— No team —</option>
                            {teams.map(t => (
                                <option key={t._id} value={t._id}>
                                    {t.name}
                                </option>
                            ))}
                        </select>
                    </section>

                    {/* Org root */}
                    <section>
                        <h3 style={sectionTitle}>Org root</h3>
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                            <input
                                type="checkbox"
                                checked={isOrgRoot}
                                onChange={e => setIsOrgRoot(e.target.checked)}
                                style={{ marginTop: 2 }}
                            />
                            <span>
                                Set as organisation root (top of hierarchy)
                                {isOrgRoot && !member.isOrgRoot && currentRootName && (
                                    <span style={{ display: 'block', fontSize: 11, color: 'var(--vault-warning)', marginTop: 3 }}>
                                        ⚠ This will remove {currentRootName}'s root status.
                                    </span>
                                )}
                            </span>
                        </label>
                    </section>
                </div>

                {/* Footer */}
                <div style={{ padding: '14px 20px', borderTop: '1px solid var(--vault-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button className="vault-btn" onClick={onClose}>Cancel</button>
                    <button className="vault-btn vault-btn--primary" onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving…' : 'Save changes'}
                    </button>
                </div>
            </div>
        </>
    );
}

const sectionTitle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.08em', color: 'var(--vault-ink-muted)',
    margin: '0 0 10px',
};

const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: 'var(--vault-ink)', marginBottom: 5,
};
