'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { ALL_PERMISSIONS, PERMISSION_LABELS } from '@/lib/constants';

interface Props {
    role?: any;          // if provided = edit mode
    onClose: () => void;
}

const EMPTY_PERMISSIONS = Object.fromEntries(ALL_PERMISSIONS.map((p) => [p, false])) as Record<string, boolean>;

function makeSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const PERM_GROUPS = ['Projects', 'Credentials', 'Team', 'Admin'] as const;

export function RoleModal({ role, onClose }: Props) {
    const isEdit = !!role;
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState('');

    const [form, setForm] = useState({
        name:        role?.name        || '',
        description: role?.description || '',
        color:       role?.color       || '#5E6C84',
        badgeLabel:  role?.badgeLabel  || '',
        permissions: { ...EMPTY_PERMISSIONS, ...(role?.permissions ?? {}) },
    });

    const up = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
    const togglePerm = (key: string) => up({ permissions: { ...form.permissions, [key]: !form.permissions[key] } });

    const godToggle = () => {
        const newGod = !form.permissions.isGod;
        if (newGod) {
            // God turns everything on
            up({ permissions: Object.fromEntries(ALL_PERMISSIONS.map((p) => [p, true])) as any });
        } else {
            up({ permissions: { ...form.permissions, isGod: false } });
        }
    };

    const submit = async () => {
        if (!form.name) { setError('Name is required'); return; }
        if (!form.badgeLabel) { setError('Badge label is required (max 8 chars)'); return; }
        setError(''); setLoading(true);

        const payload = {
            name: form.name, description: form.description,
            color: form.color, badgeLabel: form.badgeLabel.slice(0, 8),
            permissions: form.permissions,
        };

        const res = isEdit
            ? await api.patch(`/api/v1/admin/roles/${role._id}`, payload)
            : await api.post('/api/v1/admin/roles', payload);

        setLoading(false);
        if (res.error) { setError(res.error.message); return; }
        onClose();
    };

    return (
        <div className="vault-overlay" style={{ zIndex: 100 }} onClick={onClose}>
            <div className="vault-modal vault-modal--lg" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ padding: '20px 24px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{isEdit ? `Edit: ${role.name}` : 'Create Custom Role'}</h2>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--vault-text-secondary)' }}>✕</button>
                    </div>
                </div>

                <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Basic info */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 12 }}>
                        <Field label="Role Name *">
                            <input suppressHydrationWarning className="vault-input" value={form.name} onChange={(e) => up({ name: e.target.value, badgeLabel: form.badgeLabel || e.target.value.slice(0, 8) })} placeholder="e.g. DevOps Lead" />
                        </Field>
                        <Field label="Badge Label *">
                            <input suppressHydrationWarning className="vault-input" value={form.badgeLabel} maxLength={8}
                                onChange={(e) => up({ badgeLabel: e.target.value })} placeholder="max 8 chars" />
                        </Field>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                        <Field label="Description">
                            <input suppressHydrationWarning className="vault-input" value={form.description} onChange={(e) => up({ description: e.target.value })} placeholder="Brief description of this role" />
                        </Field>
                        <Field label="Colour">
                            <input suppressHydrationWarning type="color" value={form.color} onChange={(e) => up({ color: e.target.value })}
                                style={{ height: 38, width: 60, borderRadius: 6, border: '1px solid var(--vault-border)', cursor: 'pointer', padding: 2 }} />
                        </Field>
                    </div>

                    {/* Preview */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--vault-text-secondary)' }}>Badge preview:</span>
                        <span style={{
                            padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                            background: form.color + '22', color: form.color, border: `1px solid ${form.color}44`,
                        }}>
                            {form.badgeLabel || 'Badge'}
                        </span>
                    </div>

                    {/* Permissions Matrix */}
                    <div>
                        <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700 }}>Permissions Matrix</p>

                        {/* God mode toggle */}
                        <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 8, background: form.permissions.isGod ? 'rgba(255,171,0,0.1)' : 'var(--vault-bg)', border: '1px solid', borderColor: form.permissions.isGod ? 'rgba(255,171,0,0.3)' : 'var(--vault-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <label className="vault-toggle" style={{ cursor: 'pointer' }}>
                                <input suppressHydrationWarning type="checkbox" checked={form.permissions.isGod} onChange={godToggle} style={{ display: 'none' }} />
                                <div style={{ width: 34, height: 18, borderRadius: 9, background: form.permissions.isGod ? '#FFAB00' : 'var(--vault-border)', position: 'relative', transition: 'background 200ms', cursor: 'pointer' }} onClick={godToggle}>
                                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: form.permissions.isGod ? 18 : 2, transition: 'left 200ms' }} />
                                </div>
                            </label>
                            <div>
                                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: form.permissions.isGod ? '#B8860B' : 'var(--vault-text)' }}>God Mode ★</p>
                                <p style={{ margin: 0, fontSize: 11, color: 'var(--vault-text-secondary)' }}>Bypass all permission checks — grants everything automatically</p>
                            </div>
                        </div>

                        {PERM_GROUPS.map((group) => {
                            const groupPerms = ALL_PERMISSIONS.filter((p) => PERMISSION_LABELS[p].group === group && p !== 'isGod');
                            if (!groupPerms.length) return null;
                            return (
                                <div key={group} style={{ marginBottom: 14 }}>
                                    <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: 'var(--vault-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{group}</p>
                                    <div style={{ border: '1px solid var(--vault-border)', borderRadius: 8, overflow: 'hidden' }}>
                                        {groupPerms.map((perm, idx) => {
                                            const meta = PERMISSION_LABELS[perm];
                                            const on   = !!form.permissions[perm];
                                            return (
                                                <div key={perm} onClick={() => !form.permissions.isGod && togglePerm(perm)}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                                                        borderTop: idx > 0 ? '1px solid var(--vault-border)' : 'none',
                                                        cursor: form.permissions.isGod ? 'not-allowed' : 'pointer',
                                                        background: on ? (group === 'Admin' ? 'rgba(255,171,0,0.04)' : 'rgba(0,82,204,0.04)') : '#fff',
                                                        opacity: form.permissions.isGod ? 0.6 : 1,
                                                        transition: 'background 150ms',
                                                    }}>
                                                    <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${on ? 'var(--vault-primary)' : 'var(--vault-border)'}`, background: on ? 'var(--vault-primary)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 150ms' }}>
                                                        {on && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</span>}
                                                    </div>
                                                    <div>
                                                        <p style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>{meta.label}</p>
                                                        <p style={{ margin: 0, fontSize: 11, color: 'var(--vault-text-secondary)' }}>{meta.description}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {error && <p style={{ margin: 0, fontSize: 12, color: 'var(--vault-danger)', background: 'rgba(222,53,11,0.08)', padding: '8px 12px', borderRadius: 6 }}>{error}</p>}
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button className="vault-btn vault-btn--ghost" onClick={onClose}>Cancel</button>
                        <button className="vault-btn vault-btn--primary" onClick={submit} disabled={loading}>
                            {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Role'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--vault-text)', display: 'block', marginBottom: 5 }}>{label}</label>
            {children}
        </div>
    );
}
