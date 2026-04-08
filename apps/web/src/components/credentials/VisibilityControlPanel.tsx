'use client';

import { useState, useEffect, useCallback } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/lib/api';
import type { VaultRole } from '@/lib/constants';

interface Member {
    userId: { _id: string; name: string; role: VaultRole; avatarUrl?: string };
}

interface Grant {
    grantedTo: string;
    scope: 'all' | 'own';
}

interface Props {
    projectId: string;
    members: Member[];
    currentUserId: string;
}

export function VisibilityControlPanel({ projectId, members, currentUserId }: Props) {
    const [open, setOpen]                   = useState(false);
    const [grants, setGrants]               = useState<Grant[]>([]);
    const [toggling, setToggling]           = useState('');

    const fetchGrants = useCallback(async () => {
        const { data } = await api.get<any>(`/api/v1/projects/${projectId}/credentials/visibility`);
        setGrants((data as any)?.data ?? []);
    }, [projectId]);

    useEffect(() => { if (open) fetchGrants(); }, [open, fetchGrants]);

    const getScopeForUser = (userId: string): 'all' | 'own' => {
        const g = grants.find((g) => g.grantedTo === userId);
        return g?.scope ?? 'own';
    };

    const handleToggle = async (userId: string) => {
        const current = getScopeForUser(userId);
        const next = current === 'all' ? 'own' : 'all';
        setToggling(userId);
        await api.post(`/api/v1/projects/${projectId}/credentials/visibility`, { userId, scope: next });
        await fetchGrants();
        setToggling('');
    };

    // Filter out current user (can't grant to self)
    const eligibleMembers = members.filter((m) => m.userId._id !== currentUserId);

    return (
        <div style={{ borderTop: '1px solid var(--vault-border)' }}>
            {/* Collapsible header */}
            <button
                onClick={() => setOpen(!open)}
                style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 600, color: 'var(--vault-ink)',
                }}
            >
                <span>🔐 Visibility control</span>
                <span style={{ fontSize: 12, color: 'var(--vault-ink-muted)', transition: 'transform 150ms', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
            </button>

            {open && (
                <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <p style={{ fontSize: 12, color: 'var(--vault-ink-muted)', marginBottom: 4 }}>
                        Toggle to grant full credential visibility to team members.
                    </p>
                    {eligibleMembers.length === 0 && (
                        <p style={{ fontSize: 13, color: 'var(--vault-ink-subtle)' }}>No other members to configure.</p>
                    )}
                    {eligibleMembers.map((m) => {
                        const scope = getScopeForUser(m.userId._id);
                        const isAll = scope === 'all';
                        const isToggling = toggling === m.userId._id;
                        return (
                            <div key={m.userId._id} style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '10px 12px',
                                background: 'var(--vault-surface)',
                                borderRadius: 6,
                            }}>
                                <Avatar name={m.userId.name} src={m.userId.avatarUrl} size="sm" />
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--vault-ink)', margin: 0 }}>{m.userId.name}</p>
                                    <p style={{ fontSize: 11, color: 'var(--vault-ink-muted)', margin: 0 }}>
                                        Currently: <strong>{isAll ? 'Sees all credentials' : 'Limited (own only)'}</strong>
                                    </p>
                                </div>
                                <Badge variant={isAll ? 'success' : 'neutral'}>
                                    {isAll ? 'All' : 'Limited'}
                                </Badge>
                                <button
                                    onClick={() => handleToggle(m.userId._id)}
                                    disabled={isToggling}
                                    style={{
                                        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                                        background: isAll ? 'var(--vault-primary)' : 'var(--vault-border)',
                                        position: 'relative', transition: 'background 150ms',
                                        opacity: isToggling ? 0.5 : 1,
                                    }}
                                    aria-label={`Toggle visibility for ${m.userId.name}`}
                                >
                                    <span style={{
                                        position: 'absolute', top: 3, left: isAll ? 22 : 3,
                                        width: 18, height: 18, borderRadius: '50%', background: '#fff',
                                        transition: 'left 150ms',
                                    }} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
