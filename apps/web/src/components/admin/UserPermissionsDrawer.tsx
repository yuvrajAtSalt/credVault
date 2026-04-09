'use client';

import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { api } from '@/lib/api';
import { ALL_PERMISSIONS, PERMISSION_LABELS } from '@/lib/constants';

const fetcher = (url: string) => api.get<any>(url).then((r) => r.data);

interface Props { user: any; onClose: () => void; }

const SOURCE_COLORS: Record<string, string> = {
    role:            'var(--vault-text-secondary)',
    custom_role:     '#7B61FF',
    special_grant:   'var(--vault-primary)',
    explicitly_revoked: 'var(--vault-danger)',
};

export function UserPermissionsDrawer({ user, onClose }: Props) {
    const [grantForm, setGrantForm] = useState({ permission: '', value: true, reason: '', expiresAt: '' });
    const [grantLoading, setGrantLoading] = useState(false);
    const [grantError, setGrantError]     = useState('');

    const { data, isLoading } = useSWR(`/api/v1/admin/users/${user._id}/permissions`, fetcher);
    const refresh = () => mutate(`/api/v1/admin/users/${user._id}/permissions`);

    const effective  = data?.effectivePermissions ?? {};
    const rolePerms  = data?.rolePermissions ?? {};
    const specials   = (data?.specialPermissions ?? []) as any[];

    function getSource(perm: string): { label: string; color: string } {
        const sp = specials.find((s: any) => s.permission === perm && s.isActive && !s.isExpired);
        if (sp) return { label: sp.value ? `Special grant${sp.expiresAt ? ` (exp. ${new Date(sp.expiresAt).toLocaleDateString()})` : ''}` : 'Explicitly revoked', color: sp.value ? SOURCE_COLORS.special_grant : SOURCE_COLORS.explicitly_revoked };
        return { label: `Role (${user.customRoleId?.name || user.role})`, color: SOURCE_COLORS.role };
    }

    const grantPermission = async () => {
        if (!grantForm.permission || !grantForm.reason) { setGrantError('Permission and reason are required.'); return; }
        setGrantError(''); setGrantLoading(true);
        const res = await api.post(`/api/v1/admin/users/${user._id}/permissions/grant`, {
            permission: grantForm.permission,
            value: grantForm.value,
            reason: grantForm.reason,
            expiresAt: grantForm.expiresAt || null,
        });
        setGrantLoading(false);
        if (res.error) { setGrantError(res.error.message); return; }
        setGrantForm({ permission: '', value: true, reason: '', expiresAt: '' });
        refresh();
    };

    const revokeGrant = async (permName: string) => {
        await api.delete(`/api/v1/admin/users/${user._id}/permissions/${permName}`);
        refresh();
    };

    function getInitials(name: string) {
        const p = name.trim().split(' ');
        return p.length >= 2 ? `${p[0][0]}${p[p.length - 1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
    }

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(23,43,77,0.4)', zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}>
            <div onClick={(e) => e.stopPropagation()} style={{
                width: 480, background: '#fff', height: '100%', overflowY: 'auto',
                boxShadow: '-4px 0 24px rgba(23,43,77,0.15)',
                display: 'flex', flexDirection: 'column',
            }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--vault-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: '50%', background: 'rgba(0,82,204,0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 700, color: 'var(--vault-primary)', flexShrink: 0,
                    }}>
                        {getInitials(user.name)}
                    </div>
                    <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{user.name}</p>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--vault-text-secondary)' }}>{user.email}</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--vault-text-secondary)' }}>✕</button>
                </div>

                <div style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {/* Effective permissions table */}
                    <section>
                        <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--vault-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Effective Permissions
                        </h3>
                        {isLoading ? <p style={{ color: 'var(--vault-text-secondary)', fontSize: 13 }}>Loading…</p> : (
                            <div style={{ border: '1px solid var(--vault-border)', borderRadius: 8, overflow: 'hidden' }}>
                                {ALL_PERMISSIONS.map((perm, idx) => {
                                    const granted = !!effective[perm];
                                    const src = getSource(perm);
                                    const meta = PERMISSION_LABELS[perm];
                                    return (
                                        <div key={perm} style={{
                                            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                                            borderTop: idx > 0 ? '1px solid var(--vault-border)' : 'none',
                                            background: idx % 2 === 0 ? '#fff' : 'var(--vault-bg)',
                                        }}>
                                            <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{granted ? '✓' : '–'}</span>
                                            <div style={{ flex: 1 }}>
                                                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--vault-text)' }}>{meta.label}</p>
                                                <p style={{ margin: 0, fontSize: 11, color: 'var(--vault-text-secondary)' }}>{meta.description}</p>
                                            </div>
                                            <span style={{ fontSize: 10, fontWeight: 600, color: src.color, whiteSpace: 'nowrap' }}>{src.label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    {/* Active special grants */}
                    {specials.filter((s: any) => s.isActive && !s.isExpired).length > 0 && (
                        <section>
                            <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--vault-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Active Special Grants
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {specials.filter((s: any) => s.isActive && !s.isExpired).map((sp: any) => (
                                    <div key={sp._id} style={{
                                        border: '1px solid var(--vault-border)', borderRadius: 8, padding: '12px 14px',
                                        display: 'flex', alignItems: 'flex-start', gap: 12,
                                    }}>
                                        <span style={{ fontSize: 16, marginTop: 1 }}>{sp.value ? '✓' : '✗'}</span>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: sp.value ? 'var(--vault-primary)' : 'var(--vault-danger)' }}>
                                                {sp.permission}
                                            </p>
                                            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--vault-text-secondary)' }}>
                                                "{sp.reason}" — granted by {sp.grantedBy?.name || 'Admin'}
                                                {sp.expiresAt && ` · expires ${new Date(sp.expiresAt).toLocaleDateString()}`}
                                            </p>
                                        </div>
                                        <button
                                            className="vault-btn vault-btn--ghost"
                                            style={{ fontSize: 11, padding: '3px 8px', color: 'var(--vault-danger)' }}
                                            onClick={() => { if (confirm(`Revoke ${sp.permission}?`)) revokeGrant(sp.permission); }}>
                                            Revoke
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Grant new permission form */}
                    <section style={{ borderTop: '1px solid var(--vault-border)', paddingTop: 20 }}>
                        <h3 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: 'var(--vault-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Grant Permission
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
                                <select className="vault-input" value={grantForm.permission} onChange={(e) => setGrantForm((f) => ({ ...f, permission: e.target.value }))}>
                                    <option value="">Select permission…</option>
                                    {ALL_PERMISSIONS.map((p) => <option key={p} value={p}>{PERMISSION_LABELS[p].label}</option>)}
                                </select>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button type="button" onClick={() => setGrantForm((f) => ({ ...f, value: true }))}
                                        style={{ padding: '0 12px', borderRadius: 6, border: `1.5px solid ${grantForm.value ? 'var(--vault-success)' : 'var(--vault-border)'}`, background: grantForm.value ? 'rgba(54,179,126,0.1)' : '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: grantForm.value ? 'var(--vault-success)' : 'var(--vault-text-secondary)' }}>
                                        Grant
                                    </button>
                                    <button type="button" onClick={() => setGrantForm((f) => ({ ...f, value: false }))}
                                        style={{ padding: '0 12px', borderRadius: 6, border: `1.5px solid ${!grantForm.value ? 'var(--vault-danger)' : 'var(--vault-border)'}`, background: !grantForm.value ? 'rgba(222,53,11,0.08)' : '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: !grantForm.value ? 'var(--vault-danger)' : 'var(--vault-text-secondary)' }}>
                                        Revoke
                                    </button>
                                </div>
                            </div>
                            <input className="vault-input" placeholder="Reason (required)" value={grantForm.reason} onChange={(e) => setGrantForm((f) => ({ ...f, reason: e.target.value }))} />
                            <input className="vault-input" type="datetime-local" value={grantForm.expiresAt} onChange={(e) => setGrantForm((f) => ({ ...f, expiresAt: e.target.value }))}
                                style={{ fontSize: 12 }} title="Expiry date (optional)" />
                            {grantError && <p style={{ margin: 0, fontSize: 12, color: 'var(--vault-danger)' }}>{grantError}</p>}
                            <button className="vault-btn vault-btn--primary" onClick={grantPermission} disabled={grantLoading}>
                                {grantLoading ? 'Saving…' : 'Apply Permission'}
                            </button>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
