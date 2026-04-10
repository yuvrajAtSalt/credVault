'use client';

import { useState, useEffect, useRef } from 'react';
import { API_BASE_URL, VAULT_ROLES, ROLE_LABELS, VaultRole } from '@/lib/constants';
import { useAuth } from '@/components/auth/auth-provider';
import { useToast } from '@/components/ui/Toast';

interface OrgData {
    _id: string;
    name: string;
    slug: string;
    logoUrl?: string;
    hierarchy: string[];
    accessReviewPolicy?: {
        enabled: boolean;
        frequencyDays: number;
        reminderDaysBeforeDue: number;
        autoRevokeOnMiss: boolean;
    };
    credentialSharingPolicy?: {
        allowEnvFileExport: boolean;
        allowCopyToClipboard: boolean;
        allowBulkExport: boolean;
        requireExportJustification: boolean;
        maxExportsPerDayPerUser: number;
        allowedExportRoles: string[];
        watermarkExports: boolean;
    };
}

export default function OrganisationSettingsPage() {
    const { token } = useAuth();
    const { toast } = useToast();

    const [org, setOrg]           = useState<OrgData | null>(null);
    const [name, setName]         = useState('');
    const [logoUrl, setLogoUrl]   = useState('');
    const [loading, setLoading]   = useState(true);
    const [saving, setSaving]     = useState(false);

    // Access Review Policy
    const [policy, setPolicy] = useState({
        enabled: false,
        frequencyDays: 90,
        reminderDaysBeforeDue: 7,
        autoRevokeOnMiss: false,
    });

    // Sharing Policy
    const [sharingPolicy, setSharingPolicy] = useState({
        allowEnvFileExport: true,
        allowCopyToClipboard: true,
        allowBulkExport: false,
        requireExportJustification: false,
        maxExportsPerDayPerUser: 0,
        allowedExportRoles: [] as string[],
        watermarkExports: false,
    });

    // Drag-and-drop hierarchy
    const allRoles = [...VAULT_ROLES] as VaultRole[];
    const [hierarchy, setHierarchy] = useState<string[]>([]);
    const dragIndex = useRef<number | null>(null);

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/v1/organisation`, {
            headers: { Authorization: `Bearer ${token}` },
            credentials: 'include',
        })
            .then(r => r.json())
            .then(json => {
                const d = json.data?.data;
                if (d) {
                    setOrg(d);
                    setName(d.name);
                    setLogoUrl(d.logoUrl ?? '');
                    setHierarchy(d.hierarchy?.length ? d.hierarchy : allRoles.map(r => r.toLowerCase()));
                    if (d.accessReviewPolicy) setPolicy(d.accessReviewPolicy);
                    if (d.credentialSharingPolicy) setSharingPolicy(d.credentialSharingPolicy);
                }
            })
            .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/organisation`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                credentials: 'include',
                body: JSON.stringify({ 
                    name, 
                    logoUrl, 
                    hierarchy, 
                    accessReviewPolicy: policy,
                    credentialSharingPolicy: sharingPolicy 
                }),
            });
            const json = await res.json();
            if (res.ok) {
                toast.success('Organisation settings saved!');
                setOrg(json.data?.data);
            } else {
                toast.error(json.error?.message || 'Failed to save.');
            }
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div style={{ padding: 48, textAlign: 'center', color: 'var(--vault-ink-muted)' }}>Loading…</div>;

    return (
        <div className="vault-page" style={{ paddingBottom: 100 }}>
            <div className="vault-page-header">
                <div>
                    <h1 className="vault-page-title">Organisation Settings</h1>
                    <p className="vault-page-subtitle">Manage your organisation profile and compliance policies.</p>
                </div>
            </div>

            {/* Basic info card */}
            <div className="vault-card" style={{ padding: 24, marginBottom: 24 }}>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--vault-ink)', margin: '0 0 20px' }}>General Information</h2>

                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--vault-ink)', marginBottom: 6 }}>
                        Organisation name
                    </label>
                    <input
                        id="org-name"
                        className="vault-input"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Acme Corp"
                    />
                </div>

                <div style={{ marginBottom: 8 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--vault-ink)', marginBottom: 6 }}>
                        Logo URL
                    </label>
                    <input
                        id="org-logo"
                        className="vault-input"
                        value={logoUrl}
                        onChange={e => setLogoUrl(e.target.value)}
                        placeholder="https://example.com/logo.png"
                    />
                </div>

                {logoUrl && (
                    <div style={{ marginTop: 12 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={logoUrl}
                            alt="Logo preview"
                            style={{ height: 40, borderRadius: 6, border: '1px solid var(--vault-border)', objectFit: 'contain', background: '#fff', padding: 4 }}
                            onError={e => (e.currentTarget.style.display = 'none')}
                        />
                    </div>
                )}
            </div>

            {/* Access Reviews card */}
            <div className="vault-card" style={{ padding: 24, marginBottom: 24 }}>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--vault-ink)', margin: '0 0 6px' }}>Access Reviews</h2>
                <p style={{ fontSize: 12, color: 'var(--vault-ink-muted)', marginBottom: 20 }}>
                    Configure periodic review cycles for project memberships. This ensures access is revoked when no longer needed.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                     <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                        <div style={{ position: 'relative', width: 36, height: 20 }}>
                            <input
                                type="checkbox"
                                style={{ opacity: 0, width: 0, height: 0 }}
                                checked={policy.enabled}
                                onChange={e => setPolicy({ ...policy, enabled: e.target.checked })}
                            />
                            <div style={{
                                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                background: policy.enabled ? 'var(--vault-primary)' : '#ccc',
                                borderRadius: 10, transition: '0.4s'
                            }} />
                            <div style={{
                                position: 'absolute', height: 16, width: 16, left: policy.enabled ? 18 : 2, bottom: 2,
                                background: 'white', borderRadius: '50%', transition: '0.4s'
                            }} />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>Enable periodic access reviews</span>
                    </label>

                    {policy.enabled && (
                        <div style={{ paddingLeft: 48, display: 'flex', flexDirection: 'column', gap: 20, borderLeft: '2px solid var(--vault-border)' }}>
                            <div style={{ maxWidth: 280 }}>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--vault-ink)', marginBottom: 6 }}>Review Frequency</label>
                                <select className="vault-input" value={policy.frequencyDays} onChange={e => setPolicy({ ...policy, frequencyDays: Number(e.target.value) })}>
                                    <option value={30}>Every 30 days</option>
                                    <option value={60}>Every 60 days</option>
                                    <option value={90}>Every 90 days</option>
                                    <option value={180}>Every 180 days</option>
                                </select>
                            </div>

                            <div style={{ maxWidth: 280 }}>
                                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--vault-ink)', marginBottom: 6 }}>Advance Reminders</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <input type="number" className="vault-input" style={{ width: 80 }} value={policy.reminderDaysBeforeDue} onChange={e => setPolicy({ ...policy, reminderDaysBeforeDue: Number(e.target.value) })} />
                                    <span style={{ fontSize: 13, color: 'var(--vault-ink-muted)' }}>days before deadline</span>
                                </div>
                            </div>

                            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                                <input type="checkbox" checked={policy.autoRevokeOnMiss} onChange={e => setPolicy({ ...policy, autoRevokeOnMiss: e.target.checked })} />
                                <span style={{ fontSize: 13, color: 'var(--vault-ink)' }}>Auto-revoke access if review is not completed by due date</span>
                            </label>
                        </div>
                    )}
                </div>
            </div>

            {/* Sharing Policy card */}
            <div className="vault-card" style={{ padding: 24, marginBottom: 24 }}>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--vault-ink)', margin: '0 0 6px' }}>Credential Sharing Policy</h2>
                <p style={{ fontSize: 12, color: 'var(--vault-ink-muted)', marginBottom: 20 }}>
                    Define how secrets can leave the platform. These guardrails help prevent accidental data leaks.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                        <input type="checkbox" checked={sharingPolicy.allowEnvFileExport} onChange={e => setSharingPolicy({ ...sharingPolicy, allowEnvFileExport: e.target.checked })} />
                        <span style={{ fontSize: 13 }}>Allow .env file export</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                        <input type="checkbox" checked={sharingPolicy.allowCopyToClipboard} onChange={e => setSharingPolicy({ ...sharingPolicy, allowCopyToClipboard: e.target.checked })} />
                        <span style={{ fontSize: 13 }}>Allow copy to clipboard</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                        <input type="checkbox" checked={sharingPolicy.requireExportJustification} onChange={e => setSharingPolicy({ ...sharingPolicy, requireExportJustification: e.target.checked })} />
                        <span style={{ fontSize: 13 }}>Require justification for exports</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                        <input type="checkbox" checked={sharingPolicy.watermarkExports} onChange={e => setSharingPolicy({ ...sharingPolicy, watermarkExports: e.target.checked })} />
                        <span style={{ fontSize: 13 }}>Watermark exported files</span>
                    </label>

                    <div style={{ gridColumn: 'span 1' }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--vault-ink)', marginBottom: 6 }}>Max daily exports per user</label>
                        <input 
                            type="number" className="vault-input" style={{ width: 120 }} 
                            value={sharingPolicy.maxExportsPerDayPerUser} 
                            onChange={e => setSharingPolicy({ ...sharingPolicy, maxExportsPerDayPerUser: Number(e.target.value) })}
                        />
                        <p style={{ fontSize: 11, color: 'var(--vault-ink-muted)', marginTop: 4 }}>0 = Unlimited</p>
                    </div>
                </div>
            </div>

            {/* Hierarchy drag-to-reorder */}
            <div className="vault-card" style={{ padding: 24, marginBottom: 24 }}>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--vault-ink)', margin: '0 0 6px' }}>Role Hierarchy</h2>
                <p style={{ fontSize: 12, color: 'var(--vault-ink-muted)', marginBottom: 16 }}>
                    Drag to reorder. This controls display order in the org chart.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {hierarchy.map((roleKey, idx) => {
                        const roleLabel = ROLE_LABELS[(roleKey.toUpperCase() as VaultRole)] ?? roleKey;
                        return (
                            <div
                                key={roleKey}
                                draggable
                                onDragStart={() => { dragIndex.current = idx; }}
                                onDragOver={e => e.preventDefault()}
                                onDrop={() => {
                                    if (dragIndex.current === null || dragIndex.current === idx) return;
                                    const next = [...hierarchy];
                                    const [moved] = next.splice(dragIndex.current, 1);
                                    next.splice(idx, 0, moved);
                                    setHierarchy(next);
                                    dragIndex.current = null;
                                }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '8px 12px', borderRadius: 6,
                                    background: 'var(--vault-surface-raised)',
                                    border: '1px solid var(--vault-border)',
                                    cursor: 'grab', userSelect: 'none',
                                    transition: 'box-shadow 120ms',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)')}
                                onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                            >
                                <span style={{ color: 'var(--vault-ink-muted)', fontSize: 14, flexShrink: 0 }}>⠿</span>
                                <span style={{ fontSize: 11, color: 'var(--vault-ink-muted)', width: 20, fontWeight: 600 }}>{idx + 1}</span>
                                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--vault-ink)' }}>{roleLabel}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Save */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                    id="org-save"
                    className="vault-btn vault-btn--primary"
                    onClick={handleSave}
                    disabled={saving}
                    style={{ padding: '10px 32px', fontWeight: 600 }}
                >
                    {saving ? 'Saving…' : 'Save all changes'}
                </button>
            </div>
        </div>
    );
}
