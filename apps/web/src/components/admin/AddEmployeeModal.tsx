'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { api } from '@/lib/api';
import { VAULT_ROLES, ROLE_LABELS } from '@/lib/constants';

const fetcher = (url: string) => api.get<any>(url).then((r) => r.data?.data || r.data);

type Step = 1 | 2 | 3;

interface Props { onClose: () => void; }

export function AddEmployeeModal({ onClose }: Props) {
    const [step, setStep] = useState<Step>(1);
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState('');
    const [tempPw, setTempPw]   = useState('');  // shown on success

    const { data: teams }       = useSWR('/api/v1/org/teams', fetcher);
    const { data: customRoles } = useSWR('/api/v1/admin/roles', fetcher);
    const { data: members }     = useSWR('/api/v1/members', fetcher);

    const [form, setForm] = useState({
        // Step 1 — Identity
        name: '', email: '', jobTitle: '', department: '',
        // Step 2 — Role & Team
        roleType: 'builtin' as 'builtin' | 'custom',
        role: 'DEVELOPER', customRoleId: '',
        reportingTo: '', teamId: '', isOrgRoot: false,
        // Step 3 — Access
        password: '', forcePasswordChange: true,
    });

    const up = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

    const generatePassword = () => {
        const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        const special = '!@#$';
        let pw = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        pw += special[Math.floor(Math.random() * special.length)];
        pw += Math.floor(Math.random() * 9) + 1;
        up({ password: pw });
    };

    const submit = async () => {
        setError(''); setLoading(true);
        const body: any = {
            name: form.name, email: form.email,
            jobTitle: form.jobTitle || undefined, department: form.department || undefined,
            password: form.password, forcePasswordChange: form.forcePasswordChange,
            teamId: form.teamId || undefined, reportingTo: form.reportingTo || undefined,
            isOrgRoot: form.isOrgRoot,
        };
        if (form.roleType === 'builtin') body.role = form.role;
        else                             body.customRoleId = form.customRoleId;

        const res = await api.post<any>('/api/v1/admin/users', body);
        setLoading(false);
        if (res.error) { setError(res.error.message); return; }
        setTempPw(res.data?.tempPassword ?? form.password);
    };

    const selectedCustomRole = (customRoles ?? []).filter((r: any) => !r.isBuiltIn).find((r: any) => r._id === form.customRoleId);
    const preview = selectedCustomRole?.permissions ??
        (form.roleType === 'builtin' ? null : null);

    if (tempPw) return (
        <div className="vault-overlay" style={{ zIndex: 100 }}>
            <div className="vault-modal vault-modal--md" onClick={(e) => e.stopPropagation()}>
                <div style={{ textAlign: 'center', padding: '32px 24px' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>Employee Created</h2>
                    <p style={{ color: 'var(--vault-text-secondary)', fontSize: 13, marginBottom: 20 }}>
                        Share this temporary password with {form.name}. It will not be shown again.
                    </p>
                    <div style={{
                        background: 'var(--vault-bg)', border: '1px solid var(--vault-border)',
                        borderRadius: 8, padding: '12px 16px', fontFamily: 'monospace',
                        fontSize: 16, fontWeight: 700, letterSpacing: '0.1em',
                        display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center',
                    }}>
                        {tempPw}
                        <button onClick={() => navigator.clipboard.writeText(tempPw)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }} title="Copy">⎘</button>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--vault-warning)', marginTop: 8 }}>
                        ⚠️ They will be asked to change this on first login.
                    </p>
                    <button className="vault-btn vault-btn--primary" onClick={onClose} style={{ marginTop: 20, width: '100%' }}>Done</button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="vault-overlay" style={{ zIndex: 100 }} onClick={onClose}>
            <div className="vault-modal vault-modal--md" onClick={(e) => e.stopPropagation()}>
                {/* Header + step indicator */}
                <div style={{ padding: '20px 24px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Add Employee</h2>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--vault-text-secondary)' }}>✕</button>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                        {(['Identity', 'Role & Team', 'Access'] as const).map((label, idx) => (
                            <div key={label} style={{ flex: 1, textAlign: 'center' }}>
                                <div style={{
                                    height: 3, borderRadius: 2, marginBottom: 6,
                                    background: idx + 1 <= step ? 'var(--vault-primary)' : 'var(--vault-border)',
                                    transition: 'background 200ms',
                                }} />
                                <span style={{ fontSize: 10, fontWeight: 600, color: idx + 1 <= step ? 'var(--vault-primary)' : 'var(--vault-text-secondary)' }}>
                                    Step {idx + 1}: {label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* ── Step 1: Identity ── */}
                    {step === 1 && <>
                        <Field label="Full Name *">
                            <input className="vault-input" required value={form.name} onChange={(e) => up({ name: e.target.value })} placeholder="Kavya Reddy" />
                        </Field>
                        <Field label="Email Address *">
                            <input className="vault-input" type="email" required value={form.email} onChange={(e) => up({ email: e.target.value })} placeholder="kavya@company.com" />
                        </Field>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <Field label="Job Title">
                                <input className="vault-input" value={form.jobTitle} onChange={(e) => up({ jobTitle: e.target.value })} placeholder="Frontend Engineer" />
                            </Field>
                            <Field label="Department">
                                <input className="vault-input" value={form.department} onChange={(e) => up({ department: e.target.value })} placeholder="Engineering" />
                            </Field>
                        </div>
                    </>}

                    {/* ── Step 2: Role & Team ── */}
                    {step === 2 && <>
                        <Field label="Role Type">
                            <div style={{ display: 'flex', gap: 10 }}>
                                {['builtin', 'custom'].map((t) => (
                                    <button key={t} type="button"
                                        onClick={() => up({ roleType: t as any })}
                                        style={{
                                            flex: 1, padding: '8px 0', borderRadius: 6, fontSize: 13, fontWeight: 600,
                                            border: '1.5px solid',
                                            borderColor: form.roleType === t ? 'var(--vault-primary)' : 'var(--vault-border)',
                                            background: form.roleType === t ? 'rgba(0,82,204,0.07)' : '#fff',
                                            color: form.roleType === t ? 'var(--vault-primary)' : 'var(--vault-text-secondary)',
                                            cursor: 'pointer',
                                        }}>
                                        {t === 'builtin' ? 'Built-in' : 'Custom'} Role
                                    </button>
                                ))}
                            </div>
                        </Field>
                        {form.roleType === 'builtin' ? (
                            <Field label="Role">
                                <select className="vault-input" value={form.role} onChange={(e) => up({ role: e.target.value })}>
                                    {VAULT_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                                </select>
                            </Field>
                        ) : (
                            <Field label="Custom Role">
                                <select className="vault-input" value={form.customRoleId} onChange={(e) => up({ customRoleId: e.target.value })}>
                                    <option value="">Select custom role…</option>
                                    {(customRoles ?? []).filter((r: any) => !r.isBuiltIn).map((r: any) => (
                                        <option key={r._id} value={r._id}>{r.name}</option>
                                    ))}
                                </select>
                            </Field>
                        )}
                        <Field label="Reports To">
                            <select className="vault-input" value={form.reportingTo} onChange={(e) => up({ reportingTo: e.target.value })}>
                                <option value="">— None —</option>
                                {(members ?? []).map((m: any) => (
                                    <option key={m._id} value={m._id}>{m.name} ({ROLE_LABELS[m.role as keyof typeof ROLE_LABELS] || m.role})</option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Team">
                            <select className="vault-input" value={form.teamId} onChange={(e) => up({ teamId: e.target.value })}>
                                <option value="">— No team —</option>
                                {(teams ?? []).map((t: any) => <option key={t._id} value={t._id}>{t.name}</option>)}
                            </select>
                        </Field>
                        <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 13 }}>
                            <input type="checkbox" checked={form.isOrgRoot} onChange={(e) => up({ isOrgRoot: e.target.checked })} />
                            <span>Set as organisation root (top of hierarchy)</span>
                        </label>
                    </>}

                    {/* ── Step 3: Access ── */}
                    {step === 3 && <>
                        <Field label="Temporary Password">
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input className="vault-input" type="text" value={form.password}
                                    onChange={(e) => up({ password: e.target.value })}
                                    placeholder="Min 8 chars, 1 uppercase, 1 number" style={{ flex: 1 }} />
                                <button type="button" className="vault-btn vault-btn--ghost" onClick={generatePassword} style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                                    Generate
                                </button>
                            </div>
                        </Field>
                        <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 13 }}>
                            <input type="checkbox" checked={form.forcePasswordChange} onChange={(e) => up({ forcePasswordChange: e.target.checked })} />
                            <span>Force password change on first login</span>
                        </label>
                        {error && <p style={{ margin: 0, fontSize: 12, color: 'var(--vault-danger)', background: 'rgba(222,53,11,0.08)', padding: '8px 12px', borderRadius: 6 }}>{error}</p>}
                    </>}

                    {/* Footer buttons */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                        {step > 1 ? (
                            <button className="vault-btn vault-btn--ghost" onClick={() => setStep((s) => (s - 1) as Step)}>← Back</button>
                        ) : <span />}
                        {step < 3 ? (
                            <button className="vault-btn vault-btn--primary"
                                disabled={step === 1 && (!form.name || !form.email)}
                                onClick={() => setStep((s) => (s + 1) as Step)}>
                                Next →
                            </button>
                        ) : (
                            <button className="vault-btn vault-btn--primary"
                                disabled={loading || !form.password}
                                onClick={submit}>
                                {loading ? 'Creating…' : 'Create Employee'}
                            </button>
                        )}
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
