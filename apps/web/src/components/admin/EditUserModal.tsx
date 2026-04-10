'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { VAULT_ROLES, ROLE_LABELS } from '@/lib/constants';
import { Select } from '@/components/ui/Select';
import { Toggle } from '@/components/ui/Toggle';

const fetcher = (url: string) => api.get<any>(url).then((r) => r.data);

type Tab = 'profile' | 'role' | 'account';

interface Props {
    user: any;
    onClose: () => void;
}

export function EditUserModal({ user, onClose }: Props) {
    const [tab, setTab]         = useState<Tab>('profile');
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState('');
    const [success, setSuccess] = useState('');
    const [resetPw, setResetPw] = useState('');
    const [confirmDeact, setConfirmDeact] = useState(false);

    const { data: teams }       = useSWR('/api/v1/org/teams', fetcher);
    const { data: customRoles } = useSWR('/api/v1/admin/roles', fetcher);
    const { data: members }     = useSWR('/api/v1/members', fetcher);

    const [form, setForm] = useState({
        name:       user.name       || '',
        email:      user.email      || '',
        secondaryEmails: user.secondaryEmails || [],
        jobTitle:   user.jobTitle   || '',
        department: user.department || '',
        role:       user.role       || 'DEVELOPER',
        customRoleId: user.customRoleId?._id || '',
        roleType:   user.role === 'CUSTOM' ? 'custom' : 'builtin' as 'builtin' | 'custom',
        teamId:     user.teamId?._id || user.teamId || '',
        reportingTo: user.reportingTo?._id || user.reportingTo || '',
        isOrgRoot:  user.isOrgRoot || false,
        isActive:   user.isActive !== false,
        forcePasswordChange: user.forcePasswordChange || false,
    });

    const up = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

    const save = async (patch: Record<string, any>) => {
        setError(''); setSuccess(''); setLoading(true);
        const res = await api.patch(`/api/v1/admin/users/${user._id}`, patch);
        setLoading(false);
        if (res.error) { setError(res.error.message); } else { setSuccess('Saved successfully.'); }
    };

    const saveProfile = () => save({
        name: form.name,
        email: form.email,
        secondaryEmails: form.secondaryEmails,
        jobTitle: form.jobTitle,
        department: form.department
    });

    const saveRole    = () => save({
        role: form.roleType === 'builtin' ? form.role : 'CUSTOM',
        customRoleId: form.roleType === 'custom' ? form.customRoleId : null,
        teamId: form.teamId || null,
        reportingTo: form.reportingTo || null,
        isOrgRoot: form.isOrgRoot,
    });

    const handleResetPassword = async () => {
        if (resetPw.length < 8) { setError('Min 8 characters'); return; }
        await save({ password: resetPw, forcePasswordChange: form.forcePasswordChange });
        setResetPw('');
    };

    const deactivate = async () => {
        setLoading(true);
        await api.patch(`/api/v1/admin/users/${user._id}`, { isActive: false });
        setLoading(false);
        onClose();
    };

    const reactivate = async () => {
        await api.post(`/api/v1/admin/users/${user._id}/reactivate`, {});
        setSuccess('User reactivated.');
    };

    const TABS: { id: Tab; label: string }[] = [
        { id: 'profile', label: 'Profile' },
        { id: 'role',    label: 'Role & Team' },
        { id: 'account', label: 'Account' },
    ];

    return (
        <div className="vault-overlay" style={{ zIndex: 100 }} onClick={onClose}>
            <div className="vault-modal vault-modal--md" onClick={(e) => e.stopPropagation()}>
                <div style={{ padding: '20px 24px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Edit: {user.name}</h2>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--vault-text-secondary)' }}>✕</button>
                    </div>
                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--vault-border)' }}>
                        {TABS.map((t) => (
                            <button key={t.id} onClick={() => { setTab(t.id); setError(''); setSuccess(''); }}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    padding: '8px 14px', fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
                                    color: tab === t.id ? 'var(--vault-primary)' : 'var(--vault-text-secondary)',
                                    borderBottom: `2px solid ${tab === t.id ? 'var(--vault-primary)' : 'transparent'}`,
                                    marginBottom: -1,
                                }}>
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Profile tab */}
                    {tab === 'profile' && <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <section>
                                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--vault-text-secondary)', marginBottom: 10, letterSpacing: '0.04em' }}>Basic Identity</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <Field label="Full Name"><input className="vault-input" value={form.name} onChange={(e) => up({ name: e.target.value })} /></Field>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                        <Field label="Job Title"><input className="vault-input" value={form.jobTitle} onChange={(e) => up({ jobTitle: e.target.value })} /></Field>
                                        <Field label="Department"><input className="vault-input" value={form.department} onChange={(e) => up({ department: e.target.value })} /></Field>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--vault-text-secondary)', marginBottom: 10, letterSpacing: '0.04em' }}>Email Addresses</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <Field label="Primary Email"><input className="vault-input" type="email" value={form.email} onChange={(e) => up({ email: e.target.value })} /></Field>
                                    
                                    <div>
                                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--vault-text)', display: 'block', marginBottom: 5 }}>Secondary Emails</label>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {form.secondaryEmails.map((email: string, i: number) => (
                                                <div key={i} style={{ display: 'flex', gap: 8 }}>
                                                    <input className="vault-input" style={{ flex: 1 }} value={email} onChange={(e) => {
                                                        const next = [...form.secondaryEmails];
                                                        next[i] = e.target.value;
                                                        up({ secondaryEmails: next });
                                                    }} />
                                                    <button className="vault-btn vault-btn--ghost" onClick={() => {
                                                        up({ secondaryEmails: form.secondaryEmails.filter((_: any, idx: number) => idx !== i) });
                                                    }} style={{ color: 'var(--vault-danger)', padding: '0 10px' }}>✕</button>
                                                </div>
                                            ))}
                                            <button className="vault-btn vault-btn--ghost" onClick={() => up({ secondaryEmails: [...form.secondaryEmails, ''] })} style={{ fontSize: 12, borderStyle: 'dashed' }}>
                                                + Add another email
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>
                        <Footer loading={loading} error={error} success={success} onSave={saveProfile} />
                    </>}

                    {/* Role & Team tab */}
                    {tab === 'role' && <>
                        <Field label="Role Type">
                            <div style={{ display: 'flex', gap: 10 }}>
                                {(['builtin', 'custom'] as const).map((t) => (
                                    <button key={t} type="button" onClick={() => up({ roleType: t })}
                                        style={{
                                            flex: 1, padding: '7px 0', borderRadius: 6, fontSize: 12, fontWeight: 600,
                                            border: `1.5px solid ${form.roleType === t ? 'var(--vault-primary)' : 'var(--vault-border)'}`,
                                            background: form.roleType === t ? 'rgba(0,82,204,0.07)' : '#fff',
                                            color: form.roleType === t ? 'var(--vault-primary)' : 'var(--vault-text-secondary)', cursor: 'pointer',
                                        }}>
                                        {t === 'builtin' ? 'Built-in' : 'Custom'}
                                    </button>
                                ))}
                            </div>
                        </Field>
                        {form.roleType === 'builtin' ? (
                            <Field label="Role">
                                <Select
                                    value={form.role}
                                    onChange={(val) => up({ role: val })}
                                    options={VAULT_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r as keyof typeof ROLE_LABELS] }))}
                                />
                            </Field>
                        ) : (
                            <Field label="Custom Role">
                                <Select
                                    value={form.customRoleId || ''}
                                    onChange={(val) => up({ customRoleId: val })}
                                    options={[
                                        ...((customRoles?.data ?? []).filter((r: any) => !r.isBuiltIn).map((r: any) => ({ value: r._id, label: r.name })))
                                    ]}
                                    placeholder="Select…"
                                />
                            </Field>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <Field label="Reports To">
                                <Select
                                    value={form.reportingTo || ''}
                                    onChange={(val) => up({ reportingTo: val })}
                                    options={[
                                        { value: '', label: '— None —' },
                                        ...((members?.data ?? []).filter((m: any) => m._id !== user._id).map((m: any) => ({ value: m._id, label: m.name })))
                                    ]}
                                    placeholder="— None —"
                                />
                            </Field>
                            <Field label="Team">
                                <Select
                                    value={form.teamId || ''}
                                    onChange={(val) => up({ teamId: val })}
                                    options={[
                                        { value: '', label: '— None —' },
                                        ...((teams?.data ?? []).map((t: any) => ({ value: t._id, label: t.name })))
                                    ]}
                                    placeholder="— None —"
                                />
                            </Field>
                        </div>
                        <Toggle
                            checked={form.isOrgRoot}
                            onChange={(checked) => up({ isOrgRoot: checked })}
                            label="Set as organisation root"
                        />
                        <Footer loading={loading} error={error} success={success} onSave={saveRole} />
                    </>}

                    {/* Account tab */}
                    {tab === 'account' && <>
                        <div className="vault-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Reset Password</p>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input className="vault-input" type="text" value={resetPw} onChange={(e) => setResetPw(e.target.value)} placeholder="New temporary password" style={{ flex: 1 }} />
                                <button className="vault-btn vault-btn--ghost" onClick={handleResetPassword} disabled={loading} style={{ fontSize: 12 }}>Reset</button>
                            </div>
                            <div style={{ marginTop: 8 }}>
                                <Toggle
                                    checked={form.forcePasswordChange}
                                    onChange={(checked) => up({ forcePasswordChange: checked })}
                                    label="Force password change on next login"
                                />
                            </div>
                        </div>

                        <div className="vault-card" style={{ padding: 16 }}>
                            <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600 }}>
                                Account Status: <span style={{ color: user.isActive ? 'var(--vault-success)' : 'var(--vault-danger)' }}>{user.isActive ? 'Active' : 'Inactive'}</span>
                            </p>
                            {user.isActive ? (
                                confirmDeact ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        <p style={{ margin: 0, fontSize: 12, color: 'var(--vault-danger)' }}>
                                            Deactivating {user.name} will revoke their access to all projects. This can be reversed.
                                        </p>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button className="vault-btn vault-btn--danger" onClick={deactivate} disabled={loading}>Confirm Deactivate</button>
                                            <button className="vault-btn vault-btn--ghost" onClick={() => setConfirmDeact(false)}>Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    <button className="vault-btn vault-btn--danger" onClick={() => setConfirmDeact(true)}>Deactivate Account</button>
                                )
                            ) : (
                                <button className="vault-btn vault-btn--primary" onClick={reactivate} disabled={loading}>Reactivate Account</button>
                            )}
                        </div>
                        {(error || success) && <p style={{ margin: 0, fontSize: 12, color: error ? 'var(--vault-danger)' : 'var(--vault-success)', padding: '8px 12px', borderRadius: 6, background: error ? 'rgba(222,53,11,0.08)' : 'rgba(54,179,126,0.1)' }}>{error || success}</p>}
                    </>}
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

function Footer({ loading, error, success, onSave }: { loading: boolean; error: string; success: string; onSave: () => void }) {
    return (
        <>
            {error   && <p style={{ margin: 0, fontSize: 12, color: 'var(--vault-danger)',  background: 'rgba(222,53,11,0.08)',   padding: '8px 12px', borderRadius: 6 }}>{error}</p>}
            {success && <p style={{ margin: 0, fontSize: 12, color: 'var(--vault-success)', background: 'rgba(54,179,126,0.1)',   padding: '8px 12px', borderRadius: 6 }}>{success}</p>}
            <button className="vault-btn vault-btn--primary" onClick={onSave} disabled={loading} style={{ alignSelf: 'flex-end' }}>
                {loading ? 'Saving…' : 'Save Changes'}
            </button>
        </>
    );
}
