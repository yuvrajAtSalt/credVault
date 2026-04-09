'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Skeleton } from '@/components/ui/Skeleton';

interface EnvVariable {
    _id: string;
    key: string;
    value: string;
    isSecret: boolean;
    group: string;
    isOverridden: boolean;
    sensitivityLevel?: 'normal' | 'sensitive' | 'critical';
    addedBy: { _id: string; name: string; role: string } | null;
}

interface EnvGroup {
    name: string;
    variables: EnvVariable[];
}

interface Environment {
    _id: string;
    name: string;
    slug: string;
    color: string;
    isBaseEnvironment: boolean;
    variableCount?: number;
    description?: string;
}

interface Props {
    projectId: string;
    environments: Environment[];
    baseEnvKeys?: string[];   // keys from base env for sync indicator
    onEnvsChange: () => void; // refetch env list
}

const KEY_REGEX = /^[A-Z][A-Z0-9_]*$/;

const ENV_COLORS = ['#0052CC','#36B37E','#FF5630','#FFAB00','#6554C0','#00B8D9','#8777D9','#57D9A3'];

// ─── Add Variable Modal ───────────────────────────────────────────────────────
function AddVariableModal({ envId, projectId, existingGroups, prefillKey, onDone, onClose }: {
    envId: string; projectId: string; existingGroups: string[];
    prefillKey?: string; onDone: () => void; onClose: () => void;
}) {
    const { toast } = useToast();
    const [key, setKey]         = useState(prefillKey ?? '');
    const [value, setValue]     = useState('');
    const [isSecret, setSecret] = useState(true);
    const [group, setGroup]     = useState('General');
    const [newGroup, setNewGroup] = useState('');
    const [showValue, setShowValue] = useState(false);
    const [saving, setSaving]   = useState(false);

    const keyError = key && !KEY_REGEX.test(key) ? 'Must be uppercase letters, digits, underscore only' : '';
    const finalGroup = group === '__new__' ? newGroup : group;

    const handleSubmit = async () => {
        if (!KEY_REGEX.test(key)) { toast.error('Invalid key format'); return; }
        if (!value) { toast.error('Value is required'); return; }
        setSaving(true);
        const { error } = await api.post(`/api/v1/projects/${projectId}/envs/${envId}/variables`, {
            key, value, isSecret, group: finalGroup || 'General',
        });
        setSaving(false);
        if (error) { toast.error(error.message || 'Failed to create variable'); return; }
        toast.success(`${key} added!`);
        onDone();
    };

    return (
        <Modal isOpen onClose={onClose} title="Add variable" width="sm">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--vault-ink)', marginBottom: 5 }}>
                        Key *
                    </label>
                    <input
                        className="vault-input"
                        style={{ fontFamily: 'monospace', textTransform: 'uppercase' }}
                        value={key}
                        onChange={e => setKey(e.target.value.toUpperCase())}
                        placeholder="DATABASE_URL"
                        disabled={!!prefillKey}
                    />
                    {keyError && <p style={{ fontSize: 11, color: 'var(--vault-danger)', marginTop: 3 }}>{keyError}</p>}
                </div>

                <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--vault-ink)', marginBottom: 5 }}>
                        Value *
                    </label>
                    <div style={{ position: 'relative' }}>
                        {showValue ? (
                            <textarea
                                className="vault-input"
                                style={{ fontFamily: 'monospace', minHeight: 80, resize: 'vertical', paddingRight: 40 }}
                                value={value}
                                onChange={e => setValue(e.target.value)}
                                placeholder="Enter value…"
                            />
                        ) : (
                            <input
                                type="password"
                                className="vault-input"
                                style={{ fontFamily: 'monospace', paddingRight: 40 }}
                                value={value}
                                onChange={e => setValue(e.target.value)}
                                placeholder="Enter value…"
                                autoComplete="new-password"
                            />
                        )}
                        <button
                            type="button"
                            onClick={() => setShowValue(!showValue)}
                            style={{ position: 'absolute', right: 10, top: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vault-ink-muted)', fontSize: 12 }}
                        >
                            {showValue ? '🙈' : '👁'}
                        </button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--vault-ink)', marginBottom: 5 }}>Group</label>
                        <select className="vault-input" style={{ fontSize: 12 }} value={group} onChange={e => setGroup(e.target.value)}>
                            {[...new Set(['General', ...existingGroups])].map(g => <option key={g} value={g}>{g}</option>)}
                            <option value="__new__">+ New group…</option>
                        </select>
                        {group === '__new__' && (
                            <input
                                className="vault-input"
                                style={{ marginTop: 6, fontSize: 12 }}
                                value={newGroup}
                                onChange={e => setNewGroup(e.target.value)}
                                placeholder="Group name"
                            />
                        )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 6 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                            <input type="checkbox" checked={isSecret} onChange={e => setSecret(e.target.checked)} />
                            Mark as secret
                        </label>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                    <button className="vault-btn" onClick={onClose}>Cancel</button>
                    <button className="vault-btn vault-btn--primary" onClick={handleSubmit} disabled={saving}>
                        {saving ? 'Saving…' : 'Add variable'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

// ─── Paste .env Modal ─────────────────────────────────────────────────────────
function PasteEnvModal({ envId, projectId, onDone, onClose }: {
    envId: string; projectId: string; onDone: () => void; onClose: () => void;
}) {
    const { toast } = useToast();
    const [raw, setRaw]           = useState('');
    const [overwrite, setOverwrite] = useState(false);
    const [group, setGroup]       = useState('');
    const [saving, setSaving]     = useState(false);

    const parsed = raw
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#') && l.includes('='))
        .map(l => {
            const idx = l.indexOf('=');
            return { key: l.slice(0, idx).trim(), val: l.slice(idx + 1).trim() };
        })
        .filter(({ key }) => /^[A-Z_][A-Z0-9_]*$/.test(key));

    const handleSubmit = async () => {
        if (parsed.length === 0) { toast.error('No valid variables found'); return; }
        setSaving(true);
        const { data, error } = await api.post<any>(`/api/v1/projects/${projectId}/envs/${envId}/variables/bulk`, {
            variables: parsed.map(({ key, val }) => ({ key, value: val, group: group || 'General' })),
            overwriteExisting: overwrite,
        });
        setSaving(false);
        if (error) { toast.error(error.message || 'Failed'); return; }
        const r = data?.data;
        toast.success(`${r?.inserted ?? 0} inserted, ${r?.updated ?? 0} updated, ${r?.skipped ?? 0} skipped`);
        onDone();
    };

    return (
        <Modal isOpen onClose={onClose} title="Paste .env file" width="md">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <textarea
                    className="vault-input"
                    style={{ fontFamily: 'monospace', minHeight: 180, fontSize: 12, resize: 'vertical' }}
                    value={raw}
                    onChange={e => setRaw(e.target.value)}
                    placeholder={'DATABASE_URL=mongodb://...\nAWS_KEY=AKIA...\n# comments are ignored'}
                />

                {parsed.length > 0 && (
                    <div style={{ background: 'var(--vault-surface)', borderRadius: 6, padding: '10px 14px', maxHeight: 160, overflowY: 'auto' }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--vault-ink-muted)', marginBottom: 6 }}>
                            Preview — {parsed.length} variable{parsed.length !== 1 ? 's' : ''} detected:
                        </p>
                        {parsed.map(({ key, val }) => (
                            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0', fontFamily: 'monospace' }}>
                                <span style={{ fontWeight: 600, color: 'var(--vault-ink)' }}>{key}</span>
                                <span style={{ color: 'var(--vault-ink-muted)' }}>{val.length} chars</span>
                            </div>
                        ))}
                    </div>
                )}

                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                        <input type="checkbox" checked={overwrite} onChange={e => setOverwrite(e.target.checked)} />
                        Overwrite existing keys
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--vault-ink)' }}>Group:</label>
                        <input
                            className="vault-input"
                            style={{ width: 140, fontSize: 12 }}
                            value={group}
                            onChange={e => setGroup(e.target.value)}
                            placeholder="General"
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button className="vault-btn" onClick={onClose}>Cancel</button>
                    <button className="vault-btn vault-btn--primary" onClick={handleSubmit} disabled={saving || parsed.length === 0}>
                        {saving ? 'Importing…' : `Import ${parsed.length} variable${parsed.length !== 1 ? 's' : ''}`}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

// ─── Compare Modal ────────────────────────────────────────────────────────────
function CompareModal({ projectId, environments, onClose }: {
    projectId: string; environments: Environment[]; onClose: () => void;
}) {
    const [envA, setEnvA] = useState(environments[0]?._id ?? '');
    const [envB, setEnvB] = useState(environments[1]?._id ?? '');
    const [result, setResult] = useState<{ onlyInA: string[]; onlyInB: string[]; inBoth: string[]; mismatched: string[] } | null>(null);
    const [loading, setLoading] = useState(false);

    const compare = async () => {
        if (!envA || !envB) return;
        setLoading(true);
        const { data } = await api.get<any>(`/api/v1/projects/${projectId}/envs/compare?envA=${envA}&envB=${envB}`);
        setResult(data?.data ?? null);
        setLoading(false);
    };

    const envAName = environments.find(e => e._id === envA)?.name ?? 'A';
    const envBName = environments.find(e => e._id === envB)?.name ?? 'B';

    return (
        <Modal isOpen onClose={onClose} title="Compare environments" width="lg">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <select className="vault-input" style={{ flex: 1, fontSize: 12 }} value={envA} onChange={e => { setEnvA(e.target.value); setResult(null); }}>
                        {environments.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
                    </select>
                    <span style={{ color: 'var(--vault-ink-muted)', fontSize: 13 }}>vs</span>
                    <select className="vault-input" style={{ flex: 1, fontSize: 12 }} value={envB} onChange={e => { setEnvB(e.target.value); setResult(null); }}>
                        {environments.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
                    </select>
                    <button className="vault-btn vault-btn--primary" style={{ fontSize: 12 }} onClick={compare} disabled={loading || envA === envB}>
                        {loading ? '…' : 'Compare'}
                    </button>
                </div>

                {result && (
                    <div style={{ border: '1px solid var(--vault-border)', borderRadius: 8, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                                <tr style={{ background: 'var(--vault-surface-2)', borderBottom: '1px solid var(--vault-border)' }}>
                                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Key</th>
                                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>{envAName}</th>
                                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>{envBName}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    ...result.inBoth.map(k => ({ key: k, type: result.mismatched.includes(k) ? 'mismatch' : 'same' })),
                                    ...result.onlyInA.map(k => ({ key: k, type: 'onlyA' })),
                                    ...result.onlyInB.map(k => ({ key: k, type: 'onlyB' })),
                                ].map(({ key, type }) => {
                                    const bg = type === 'same' ? 'rgba(54,179,126,0.06)' :
                                               type === 'mismatch' ? 'rgba(255,171,0,0.08)' :
                                               type === 'onlyA'    ? 'rgba(0,82,204,0.06)' :
                                                                      'rgba(101,84,192,0.06)';
                                    return (
                                        <tr key={key} style={{ borderBottom: '1px solid var(--vault-border)', background: bg }}>
                                            <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{key}</td>
                                            <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                                                {type !== 'onlyB' ? (type === 'mismatch' ? <span style={{ color: '#f59e0b' }}>✓ (≠)</span> : '✓') : <span style={{ color: 'var(--vault-ink-subtle)' }}>—</span>}
                                            </td>
                                            <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                                                {type !== 'onlyA' ? (type === 'mismatch' ? <span style={{ color: '#f59e0b' }}>✓ (≠)</span> : '✓') : <span style={{ color: 'var(--vault-ink-subtle)' }}>—</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        <div style={{ padding: '8px 12px', background: 'var(--vault-surface)', display: 'flex', gap: 16, fontSize: 11, color: 'var(--vault-ink-muted)' }}>
                            <span>✓ same &nbsp;</span>
                            <span style={{ color: '#f59e0b' }}>✓ (≠) different value</span>
                            <span style={{ color: '#0052CC' }}>only in {envAName}</span>
                            <span style={{ color: '#6554C0' }}>only in {envBName}</span>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}

// ─── Add Environment Modal ────────────────────────────────────────────────────
function AddEnvironmentModal({ projectId, environments, onDone, onClose }: {
    projectId: string; environments: Environment[]; onDone: (envId: string) => void; onClose: () => void;
}) {
    const { toast } = useToast();
    const [name, setName]       = useState('');
    const [desc, setDesc]       = useState('');
    const [color, setColor]     = useState(ENV_COLORS[0]);
    const [cloneFrom, setClone] = useState('');
    const [saving, setSaving]   = useState(false);

    const handleSubmit = async () => {
        if (!name.trim()) { toast.error('Name is required'); return; }
        setSaving(true);
        const { data, error } = await api.post<any>(`/api/v1/projects/${projectId}/envs`, {
            name, description: desc, color,
            ...(cloneFrom ? { cloneFromEnvId: cloneFrom } : {}),
        });
        setSaving(false);
        if (error) { toast.error(error.message || 'Failed'); return; }
        toast.success(`Environment "${name}" created!`);
        onDone(data?.data?._id ?? '');
    };

    return (
        <Modal isOpen onClose={onClose} title="Add environment" width="sm">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--vault-ink)', marginBottom: 5 }}>Name *</label>
                    <input className="vault-input" value={name} onChange={e => setName(e.target.value)} placeholder="production" />
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--vault-ink)', marginBottom: 5 }}>Description</label>
                    <input className="vault-input" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Optional description" />
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--vault-ink)', marginBottom: 8 }}>Color</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {ENV_COLORS.map(c => (
                            <button
                                key={c}
                                onClick={() => setColor(c)}
                                style={{
                                    width: 28, height: 28, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer',
                                    outline: color === c ? `3px solid ${c}` : 'none',
                                    outlineOffset: 2,
                                }}
                            />
                        ))}
                        <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0 }} />
                    </div>
                </div>
                {environments.length > 0 && (
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--vault-ink)', marginBottom: 5 }}>Clone from</label>
                        <select className="vault-input" style={{ fontSize: 12 }} value={cloneFrom} onChange={e => setClone(e.target.value)}>
                            <option value="">Start empty</option>
                            {environments.map(e => <option key={e._id} value={e._id}>{e.name} ({e.variableCount ?? 0} vars)</option>)}
                        </select>
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button className="vault-btn" onClick={onClose}>Cancel</button>
                    <button className="vault-btn vault-btn--primary" onClick={handleSubmit} disabled={saving}>
                        {saving ? 'Creating…' : 'Create environment'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

// ─── Variable Row ─────────────────────────────────────────────────────────────
function VariableRow({ v, projectId, envId, onDelete, onEdit, baseKeys }: {
    v: EnvVariable; projectId: string; envId: string;
    onDelete: (id: string) => void; onEdit: () => void;
    baseKeys?: string[];
}) {
    const { toast } = useToast();
    const [revealed, setRevealed] = useState<string | null>(null);
    const [revealing, setRevealing] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [editValue, setEditValue] = useState('');
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirm] = useState(false);
    
    // Phase 10: Critical credential prompt
    const [promptingReason, setPromptingReason] = useState(false);
    const [reason, setReason] = useState('');

    const currentUserId = ''; // we can just pull it from useAuth if needed, but if omitted it will just prompt anyway.
    // wait, we can pass `currentUserId` to VariableRow from EnvManagerPanel.
    // Actually, addedBy._id is available. If we don't have currentUserId, we just prompt.

    const reveal = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (revealed !== null) { setRevealed(null); return; }

        if (v.sensitivityLevel === 'critical' && !reason /* && not owner could be checked but let it prompt and server decide or just prompt */) {
            setPromptingReason(true);
            return;
        }

        setRevealing(true);
        const { data, error } = await api.post<any>(`/api/v1/projects/${projectId}/envs/${envId}/variables/${v._id}/reveal`, { reason });
        setRevealing(false);
        if (error) { toast.error('Cannot reveal: ' + error.message); return; }
        
        setRevealed(data?.data?.value ?? '');
        setPromptingReason(false);
        setReason('');
    };

    const copy = async () => {
        let val = revealed;
        if (val === null) {
            const reqReason = v.sensitivityLevel === 'critical' ? window.prompt('Reason for copying critical variable:') : '';
            if (v.sensitivityLevel === 'critical' && !reqReason) return;

            const { data, error } = await api.post<any>(`/api/v1/projects/${projectId}/envs/${envId}/variables/${v._id}/reveal`, { reason: reqReason });
            if (error) { toast.error('Cannot copy'); return; }
            val = data?.data?.value ?? '';
            setRevealed(val);
        }
        await navigator.clipboard.writeText(val ?? '');
        toast.success('Copied to clipboard!');
    };

    const saveEdit = async () => {
        setSaving(true);
        const { error } = await api.patch(`/api/v1/projects/${projectId}/envs/${envId}/variables/${v._id}`, { value: editValue });
        setSaving(false);
        if (error) { toast.error(error.message || 'Failed to save'); return; }
        toast.success(`${v.key} updated!`);
        setEditMode(false);
        onEdit();
    };

    const isMissingInBase = baseKeys && !baseKeys.includes(v.key);

    return (
        <>
            <div
                className="credential-row"
                style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderBottom: '1px solid var(--vault-border)',
                    transition: 'background 120ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--vault-surface-raised)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
                {/* Key */}
                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12, color: 'var(--vault-ink)', minWidth: 180, flexShrink: 0 }}>
                    {v.key}
                </span>

                {/* Group chip */}
                <span style={{ fontSize: 10, padding: '2px 7px', background: 'var(--vault-surface)', border: '1px solid var(--vault-border)', borderRadius: 10, color: 'var(--vault-ink-muted)', flexShrink: 0 }}>
                    {v.group}
                </span>

                {/* Value / edit */}
                {editMode ? (
                    <div style={{ flex: 1, display: 'flex', gap: 6 }}>
                        <input
                            className="vault-input"
                            style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }}
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            autoFocus
                        />
                        <button className="vault-btn vault-btn--primary" style={{ fontSize: 11 }} onClick={saveEdit} disabled={saving}>{saving ? '…' : 'Save'}</button>
                        <button className="vault-btn" style={{ fontSize: 11 }} onClick={() => setEditMode(false)}>Cancel</button>
                    </div>
                ) : promptingReason ? (
                    <form onSubmit={reveal} style={{ flex: 1, display: 'flex', gap: 6 }}>
                        <input
                            autoFocus
                            placeholder="Reason for revealing critical variable..."
                            value={reason} onChange={e => setReason(e.target.value)}
                            style={{ flex: 1, border: '1px solid var(--vault-border)', padding: '4px 8px', fontSize: 12, borderRadius: 3, letterSpacing: 'normal', outline: 'none' }}
                        />
                        <button type="submit" disabled={!reason.trim()} style={{ background: 'var(--vault-primary)', color: '#fff', border: 'none', borderRadius: 3, padding: '0 10px', fontSize: 12, fontWeight: 600, cursor: reason.trim() ? 'pointer' : 'not-allowed' }}>Confirm</button>
                        <button type="button" onClick={() => setPromptingReason(false)} style={{ background: 'var(--vault-bg-hover)', color: 'var(--vault-ink)', border: 'none', borderRadius: 3, padding: '0 8px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                    </form>
                ) : (
                    <span style={{ flex: 1, fontFamily: 'monospace', fontSize: 12, color: revealed !== null ? 'var(--vault-ink)' : 'var(--vault-ink-muted)', letterSpacing: revealed !== null ? 'normal' : 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {revealed !== null ? revealed : '••••••••'}
                        {v.sensitivityLevel === 'critical' && (
                            <span style={{ fontSize: 9, background: 'var(--vault-danger-light)', color: 'var(--vault-danger)', padding: '1px 4px', borderRadius: 2, fontWeight: 800, letterSpacing: 0.5 }}>CRITICAL</span>
                        )}
                    </span>
                )}

                {/* Action buttons */}
                {!editMode && (
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button
                            onClick={reveal}
                            title={revealed !== null ? 'Hide' : 'Reveal'}
                            style={{ ...btnStyle, color: revealed !== null ? 'var(--vault-primary)' : 'var(--vault-ink-muted)' }}
                        >
                            {revealing ? '…' : revealed !== null ? '🙈' : '👁'}
                        </button>
                        <button onClick={copy} title="Copy value" style={btnStyle}>⎘</button>
                        <button
                            onClick={() => { setEditValue(''); setEditMode(true); }}
                            title="Edit"
                            style={btnStyle}
                        >✎</button>
                        <button onClick={() => setConfirm(true)} title="Delete" style={{ ...btnStyle, color: 'var(--vault-danger)' }}>✕</button>
                    </div>
                )}
            </div>

            <ConfirmDialog
                isOpen={confirmDelete}
                onClose={() => setConfirm(false)}
                onConfirm={() => { setConfirm(false); onDelete(v._id); }}
                title="Delete variable"
                message={`Delete "${v.key}"? This action cannot be undone.`}
                confirmLabel="Delete"
            />
        </>
    );
}

const btnStyle: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--vault-ink-muted)', fontSize: 14, padding: '3px 5px',
    borderRadius: 4, transition: 'color 120ms, background 120ms',
};

// ─── Main Env Variable Editor ─────────────────────────────────────────────────
export function EnvVariableEditor({ projectId, environment, baseEnvKeys, onEnvsChange }: {
    projectId: string; environment: Environment; baseEnvKeys?: string[]; onEnvsChange: () => void;
}) {
    const { toast } = useToast();
    const [groups, setGroups]         = useState<EnvGroup[]>([]);
    const [hiddenCount, setHidden]    = useState(0);
    const [loading, setLoading]       = useState(true);
    const [collapsed, setCollapsed]   = useState<Set<string>>(new Set());
    const [search, setSearch]         = useState('');
    const [filterGroup, setFilter]    = useState('');
    const [showAdd, setShowAdd]       = useState(false);
    const [showPaste, setShowPaste]   = useState(false);
    const [showCompare, setShowCompare] = useState(false);
    const [prefillKey, setPrefillKey] = useState<string | undefined>();
    const [showExportMenu, setExport] = useState(false);
    const [sharingPolicy, setSharingPolicy] = useState<any>(null);
    const exportRef = useRef<HTMLDivElement>(null);

    const fetchVars = useCallback(async () => {
        setLoading(true);
        const { data } = await api.get<any>(`/api/v1/projects/${projectId}/envs/${environment._id}/variables`);
        const d = data?.data;
        setGroups(d?.groups ?? []);
        setHidden(d?.hiddenCount ?? 0);
        setLoading(false);
    }, [projectId, environment._id]);

    useEffect(() => {
        fetchVars();
        // Fetch org policy
        api.get<any>('/api/v1/organisation').then(res => {
            setSharingPolicy(res.data?.data?.credentialSharingPolicy);
        });
    }, [fetchVars]);

    const handleDelete = async (varId: string) => {
        await api.delete(`/api/v1/projects/${projectId}/envs/${environment._id}/variables/${varId}`);
        toast.success('Variable deleted');
        fetchVars();
    };

    const handleExport = async (format: string, clipboard = false) => {
        if (sharingPolicy) {
            if (clipboard && !sharingPolicy.allowCopyToClipboard) {
                toast.error('Copy to clipboard is disabled by organisation policy.');
                return;
            }
            if (format === 'dotenv' && !sharingPolicy.allowEnvFileExport) {
                toast.error('Environment file export is disabled by organisation policy.');
                return;
            }
        }

        let reason = '';
        if (sharingPolicy?.requireExportJustification) {
            reason = window.prompt('Please provide a justification for this export (required by policy):') || '';
            if (!reason) {
                toast.error('Justification is required to proceed with export.');
                return;
            }
        }

        const url = `/api/v1/projects/${projectId}/envs/${environment._id}/export?format=${format}&reason=${encodeURIComponent(reason)}`;
        if (clipboard) {
            try {
                const res = await fetch(url, { credentials: 'include' });
                if (!res.ok) {
                    const err = await res.json();
                    toast.error(err.error?.message || 'Export failed');
                    return;
                }
                const text = await res.text();
                await navigator.clipboard.writeText(text);
                toast.success('Copied to clipboard!');
            } catch (e) {
                toast.error('Failed to copy to clipboard');
            }
        } else {
            try {
                const res  = await fetch(url, { credentials: 'include' });
                if (!res.ok) {
                    const err = await res.json();
                    toast.error(err.error?.message || 'Export failed');
                    return;
                }
                const blob = await res.blob();
                const a    = document.createElement('a');
                a.href     = URL.createObjectURL(blob);
                a.download = `${environment.slug}.${format === 'dotenv' ? 'env' : format}`;
                a.click();
                toast.info(`Exporting ${environment.name} as ${format}`);
            } catch (e) {
                toast.error('Failed to download file');
            }
        }
        setExport(false);
    };

    const allGroupNames = groups.map(g => g.name);
    const allVarKeys = groups.flatMap(g => g.variables.map(v => v.key));

    const filteredGroups = groups.map(g => ({
        ...g,
        variables: g.variables.filter(v => {
            const matchSearch = !search || v.key.includes(search.toUpperCase());
            const matchGroup  = !filterGroup || g.name === filterGroup;
            return matchSearch && matchGroup;
        }),
    })).filter(g => g.variables.length > 0);

    const missingBaseKeys = (baseEnvKeys ?? []).filter(k => !allVarKeys.includes(k));

    return (
        <div>
            {/* Actions bar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, alignItems: 'center' }}>
                <input
                    className="vault-input"
                    style={{ width: 200, fontSize: 12 }}
                    placeholder="Search variables…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <select className="vault-input" style={{ width: 140, fontSize: 12 }} value={filterGroup} onChange={e => setFilter(e.target.value)}>
                    <option value="">All groups</option>
                    {allGroupNames.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <button className="vault-btn vault-btn--primary" style={{ fontSize: 12 }} onClick={() => { setPrefillKey(undefined); setShowAdd(true); }}>
                    + Add variable
                </button>
                <button className="vault-btn" style={{ fontSize: 12 }} onClick={() => setShowPaste(true)}>
                    ↓ Paste .env
                </button>
                <div style={{ position: 'relative' }} ref={exportRef}>
                    <button className="vault-btn" style={{ fontSize: 12 }} onClick={() => setExport(!showExportMenu)}>
                        ↑ Export ▾
                    </button>
                    {showExportMenu && (
                        <div style={{
                            position: 'absolute', top: '100%', left: 0, zIndex: 100,
                            background: 'var(--vault-bg)', border: '1px solid var(--vault-border)',
                            borderRadius: 8, padding: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                            minWidth: 180,
                        }}>
                            <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--vault-danger)', borderBottom: '1px solid var(--vault-border)', marginBottom: 4 }}>
                                ⚠ Contains plaintext secrets. Don't commit.
                            </div>
                            {[
                                { label: 'Download as .env', f: 'dotenv' },
                                { label: 'Download as .json', f: 'json' },
                                { label: 'Download as .yaml', f: 'yaml' },
                                { label: 'Copy to clipboard (.env)', f: 'dotenv', clip: true },
                            ].map(({ label, f, clip }) => (
                                <button
                                    key={label}
                                    onClick={() => handleExport(f, clip)}
                                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--vault-ink)', borderRadius: 4 }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--vault-surface)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Base env sync indicators */}
            {missingBaseKeys.length > 0 && (
                <div style={{ background: 'rgba(255,171,0,0.08)', border: '1px solid rgba(255,171,0,0.3)', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b', marginBottom: 8 }}>
                        ⚠ {missingBaseKeys.length} key{missingBaseKeys.length !== 1 ? 's' : ''} from the base environment not set here:
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {missingBaseKeys.map(k => (
                            <button
                                key={k}
                                onClick={() => { setPrefillKey(k); setShowAdd(true); }}
                                style={{
                                    fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
                                    background: 'rgba(255,171,0,0.12)', border: '1px solid rgba(255,171,0,0.4)',
                                    borderRadius: 4, padding: '3px 8px', cursor: 'pointer', color: '#b45309',
                                }}
                            >
                                {k} + Add
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Variable list */}
            {loading ? (
                <div className="vault-card" style={{ padding: 0 }}>
                    {[1, 2, 3].map(i => <Skeleton key={i} variant="row" style={{ padding: '10px 14px', borderBottom: '1px solid var(--vault-border)' }} />)}
                </div>
            ) : filteredGroups.length === 0 ? (
                <div className="vault-card" style={{ padding: 48, textAlign: 'center' }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🔑</div>
                    <p style={{ fontWeight: 600, color: 'var(--vault-ink)', margin: 0 }}>No variables yet</p>
                    <p style={{ fontSize: 13, color: 'var(--vault-ink-muted)', marginTop: 4, marginBottom: 16 }}>
                        Add variables manually or paste a .env file to get started.
                    </p>
                    <button className="vault-btn vault-btn--primary" style={{ fontSize: 12 }} onClick={() => setShowAdd(true)}>
                        + Add first variable
                    </button>
                </div>
            ) : (
                <div className="vault-card" style={{ padding: 0, overflow: 'hidden' }}>
                    {filteredGroups.map(group => (
                        <div key={group.name}>
                            {/* Group header */}
                            <div
                                onClick={() => setCollapsed(prev => {
                                    const next = new Set(prev);
                                    next.has(group.name) ? next.delete(group.name) : next.add(group.name);
                                    return next;
                                })}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
                                    background: 'var(--vault-surface)', borderBottom: '1px solid var(--vault-border)',
                                    cursor: 'pointer', userSelect: 'none',
                                }}
                            >
                                <span style={{ fontSize: 10, transition: 'transform 150ms', transform: collapsed.has(group.name) ? 'rotate(-90deg)' : 'rotate(0)' }}>▾</span>
                                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--vault-ink)' }}>{group.name}</span>
                                <span style={{ fontSize: 10, background: 'var(--vault-surface-2)', borderRadius: 10, padding: '1px 7px', color: 'var(--vault-ink-muted)' }}>
                                    {group.variables.length}
                                </span>
                            </div>

                            {!collapsed.has(group.name) && group.variables.map(v => (
                                <VariableRow
                                    key={v._id}
                                    v={v}
                                    projectId={projectId}
                                    envId={environment._id}
                                    onDelete={handleDelete}
                                    onEdit={fetchVars}
                                    baseKeys={baseEnvKeys}
                                />
                            ))}
                        </div>
                    ))}

                    {hiddenCount > 0 && (
                        <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--vault-ink-muted)', background: 'var(--vault-surface)', borderTop: '1px solid var(--vault-border)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            🔒 {hiddenCount} variable{hiddenCount !== 1 ? 's' : ''} hidden due to visibility rules
                        </div>
                    )}
                </div>
            )}

            {/* Modals */}
            {showAdd && (
                <AddVariableModal
                    envId={environment._id}
                    projectId={projectId}
                    existingGroups={allGroupNames}
                    prefillKey={prefillKey}
                    onDone={() => { setShowAdd(false); fetchVars(); onEnvsChange(); }}
                    onClose={() => setShowAdd(false)}
                />
            )}
            {showPaste && (
                <PasteEnvModal
                    envId={environment._id}
                    projectId={projectId}
                    onDone={() => { setShowPaste(false); fetchVars(); onEnvsChange(); }}
                    onClose={() => setShowPaste(false)}
                />
            )}
        </div>
    );
}

// ─── Main Env Manager Panel (exported for project detail page) ────────────────
export function EnvManagerPanel({ projectId }: { projectId: string }) {
    const { toast } = useToast();
    const [environments, setEnvironments] = useState<Environment[]>([]);
    const [activeEnvId, setActiveEnvId]   = useState<string>('');
    const [loading, setLoading]           = useState(true);
    const [showAddEnv, setShowAddEnv]     = useState(false);
    const [showCompare, setShowCompare]   = useState(false);
    const [confirmDeleteEnv, setConfirmDeleteEnv] = useState<Environment | null>(null);

    const fetchEnvs = useCallback(async () => {
        const { data } = await api.get<any>(`/api/v1/projects/${projectId}/envs`);
        const list: Environment[] = data?.data ?? [];
        setEnvironments(list);
        if (list.length > 0 && !activeEnvId) setActiveEnvId(list[0]._id);
        setLoading(false);
    }, [projectId, activeEnvId]);

    useEffect(() => { fetchEnvs(); }, [fetchEnvs]);

    const handleDeleteEnv = async () => {
        if (!confirmDeleteEnv) return;
        const { error } = await api.delete(`/api/v1/projects/${projectId}/envs/${confirmDeleteEnv._id}`);
        if (error) { toast.error(error.message || 'Failed to delete'); return; }
        toast.success(`${confirmDeleteEnv.name} deleted`);
        setConfirmDeleteEnv(null);
        setActiveEnvId('');
        fetchEnvs();
    };

    const activeEnv = environments.find(e => e._id === activeEnvId);

    // Base env keys for sync indicator
    const baseEnv = environments.find(e => e.isBaseEnvironment);
    const [baseKeys, setBaseKeys] = useState<string[]>([]);

    useEffect(() => {
        if (!baseEnv || baseEnv._id === activeEnvId) { setBaseKeys([]); return; }
        api.get<any>(`/api/v1/projects/${projectId}/envs/${baseEnv._id}/variables`).then(({ data }) => {
            const groups: EnvGroup[] = data?.data?.groups ?? [];
            setBaseKeys(groups.flatMap(g => g.variables.map(v => v.key)));
        });
    }, [baseEnv, activeEnvId, projectId]);

    if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--vault-ink-muted)' }}>Loading environments…</div>;

    return (
        <div>
            {/* Environment pill tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
                {environments.map(env => (
                    <button
                        key={env._id}
                        onClick={() => setActiveEnvId(env._id)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                            cursor: 'pointer', border: '2px solid transparent',
                            background: activeEnvId === env._id ? (env.color + '22') : 'var(--vault-surface)',
                            color: activeEnvId === env._id ? env.color : 'var(--vault-ink-muted)',
                            borderColor: activeEnvId === env._id ? env.color : 'transparent',
                            transition: 'all 150ms',
                        }}
                    >
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: env.color, flexShrink: 0 }} />
                        {env.name}
                        {env.variableCount !== undefined && (
                            <span style={{ fontSize: 10, opacity: 0.7 }}>({env.variableCount})</span>
                        )}
                        {env.isBaseEnvironment && <span title="Base environment" style={{ fontSize: 9, opacity: 0.6 }}>★</span>}
                    </button>
                ))}
                <button
                    onClick={() => setShowAddEnv(true)}
                    style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, background: 'none', border: '2px dashed var(--vault-border)', cursor: 'pointer', color: 'var(--vault-ink-muted)', fontWeight: 500 }}
                >
                    + Add environment
                </button>
                {environments.length >= 2 && (
                    <button
                        onClick={() => setShowCompare(true)}
                        style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, background: 'none', border: '1px solid var(--vault-border)', cursor: 'pointer', color: 'var(--vault-ink-muted)' }}
                    >
                        ⇄ Compare
                    </button>
                )}
                {activeEnv && (
                    <button
                        onClick={() => setConfirmDeleteEnv(activeEnv)}
                        style={{ padding: '5px 10px', borderRadius: 20, fontSize: 11, background: 'none', border: '1px solid var(--vault-border)', cursor: 'pointer', color: 'var(--vault-danger)', marginLeft: 'auto' }}
                    >
                        ✕ Delete env
                    </button>
                )}
            </div>

            {/* Variable editor */}
            {activeEnv ? (
                <EnvVariableEditor
                    projectId={projectId}
                    environment={activeEnv}
                    baseEnvKeys={baseEnv && baseEnv._id !== activeEnvId ? baseKeys : undefined}
                    onEnvsChange={fetchEnvs}
                />
            ) : (
                <div style={{ padding: 48, textAlign: 'center' }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🌐</div>
                    <p style={{ fontWeight: 600, color: 'var(--vault-ink)' }}>No environments yet</p>
                    <p style={{ fontSize: 13, color: 'var(--vault-ink-muted)', marginTop: 4, marginBottom: 16 }}>
                        Create an environment (staging, production, etc.) to start managing env variables.
                    </p>
                    <button className="vault-btn vault-btn--primary" onClick={() => setShowAddEnv(true)}>+ Create first environment</button>
                </div>
            )}

            {/* Modals */}
            {showAddEnv && (
                <AddEnvironmentModal
                    projectId={projectId}
                    environments={environments}
                    onDone={(id) => { setShowAddEnv(false); fetchEnvs(); setActiveEnvId(id); }}
                    onClose={() => setShowAddEnv(false)}
                />
            )}
            {showCompare && (
                <CompareModal
                    projectId={projectId}
                    environments={environments}
                    onClose={() => setShowCompare(false)}
                />
            )}
            <ConfirmDialog
                isOpen={!!confirmDeleteEnv}
                onClose={() => setConfirmDeleteEnv(null)}
                onConfirm={handleDeleteEnv}
                title="Delete environment"
                message={`Delete "${confirmDeleteEnv?.name}" and all its variables? This cannot be undone.`}
                confirmLabel="Delete"
            />
        </div>
    );
}
