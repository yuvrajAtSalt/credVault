'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { api } from '@/lib/api';
import { RoleModal } from '@/components/admin/RoleModal';

const fetcher = (url: string) => api.get<any>(url).then((r) => r.data);

export default function RolesPage() {
    const [editRole, setEditRole] = useState<any>(null);
    const [creating, setCreating] = useState(false);

    const { data: response, isLoading } = useSWR('/api/v1/admin/roles', fetcher);
    const roles = response?.data ?? [];
    const refresh = () => mutate('/api/v1/admin/roles');

    const deleteRole = async (role: any) => {
        if (!confirm(`Delete "${role.name}"? This cannot be undone.`)) return;
        const res = await api.delete(`/api/v1/admin/roles/${role._id}`);
        if (res.error) alert(res.error.message);
        else refresh();
    };

    return (
        <div className="vault-page">
            <div className="vault-page-header">
                <div>
                    <h1 className="vault-page-title">Roles</h1>
                    <p className="vault-page-subtitle">Manage built-in and custom organisation roles</p>
                </div>
                <button className="vault-btn vault-btn--primary" onClick={() => setCreating(true)}>+ New Role</button>
            </div>

            {isLoading ? (
                <p style={{ color: 'var(--vault-text-secondary)' }}>Loading…</p>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                    {(roles ?? []).map((role: any) => (
                        <div key={role._id} className="vault-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{
                                        display: 'inline-block', padding: '3px 8px', borderRadius: 6,
                                        fontSize: 11, fontWeight: 700, background: role.color + '22',
                                        color: role.color, border: `1px solid ${role.color}44`,
                                    }}>
                                        {role.badgeLabel}
                                    </span>
                                    <div>
                                        <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{role.name}</p>
                                        {role.isBuiltIn && <span style={{ fontSize: 10, color: 'var(--vault-text-secondary)' }}>Built-in</span>}
                                    </div>
                                </div>
                                {!role.isBuiltIn && (
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button className="vault-btn vault-btn--ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => setEditRole(role)}>Edit</button>
                                        <button className="vault-btn vault-btn--ghost" style={{ padding: '4px 8px', fontSize: 11, color: 'var(--vault-danger)' }} onClick={() => deleteRole(role)}>✕</button>
                                    </div>
                                )}
                            </div>

                            {role.description && <p style={{ margin: 0, fontSize: 12, color: 'var(--vault-text-secondary)' }}>{role.description}</p>}

                            {/* Permission pills */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {Object.entries(role.permissions ?? {}).filter(([, v]) => v).map(([k]) => (
                                    <span key={k} style={{
                                        padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                                        background: 'rgba(0,82,204,0.08)', color: 'var(--vault-primary)',
                                    }}>
                                        {k.replace(/^can/, '').replace(/([A-Z])/g, ' $1').trim()}
                                    </span>
                                ))}
                                {role.permissions?.isGod && (
                                    <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: 'rgba(255,171,0,0.15)', color: '#B8860B' }}>
                                        God Mode ★
                                    </span>
                                )}
                            </div>

                            <div style={{ borderTop: '1px solid var(--vault-border)', paddingTop: 10, fontSize: 12, color: 'var(--vault-text-secondary)' }}>
                                👥 {role.memberCount ?? 0} member{role.memberCount !== 1 ? 's' : ''}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {creating && <RoleModal onClose={() => { setCreating(false); refresh(); }} />}
            {editRole  && <RoleModal role={editRole} onClose={() => { setEditRole(null); refresh(); }} />}
        </div>
    );
}
