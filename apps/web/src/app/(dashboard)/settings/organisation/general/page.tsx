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
}

export default function OrganisationSettingsPage() {
    const { token } = useAuth();
    const { toast } = useToast();

    const [org, setOrg]           = useState<OrgData | null>(null);
    const [name, setName]         = useState('');
    const [logoUrl, setLogoUrl]   = useState('');
    const [loading, setLoading]   = useState(true);
    const [saving, setSaving]     = useState(false);

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
                body: JSON.stringify({ name, logoUrl, hierarchy }),
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
        <div className="vault-page">
            <div className="vault-page-header">
                <div>
                    <h1 className="vault-page-title">Organisation Settings</h1>
                    <p className="vault-page-subtitle">Manage your organisation profile and role hierarchy.</p>
                </div>
            </div>

            {/* Basic info card */}
            <div className="vault-card" style={{ padding: 24, marginBottom: 24 }}>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--vault-ink)', margin: '0 0 20px' }}>General</h2>

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
                            style={{ height: 48, borderRadius: 8, border: '1px solid var(--vault-border)', objectFit: 'contain', background: '#fff', padding: 4 }}
                            onError={e => (e.currentTarget.style.display = 'none')}
                        />
                    </div>
                )}

                <p style={{ fontSize: 11, color: 'var(--vault-ink-subtle)', marginTop: 8 }}>
                    Slug: <code style={{ fontSize: 11 }}>{org?.slug}</code> (not editable)
                </p>
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
            <button
                id="org-save"
                className="vault-btn vault-btn--primary"
                onClick={handleSave}
                disabled={saving}
                style={{ padding: '10px 24px', fontWeight: 600 }}
            >
                {saving ? 'Saving…' : 'Save changes'}
            </button>
        </div>
    );
}
