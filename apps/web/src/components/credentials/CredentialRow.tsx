'use client';

import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { api } from '@/lib/api';
import type { VaultRole } from '@/lib/constants';

const ENV_COLORS: Record<string, { bg: string; color: string }> = {
    production:  { bg: '#FFEBE6', color: '#BF2600' },
    staging:     { bg: '#FFFAE6', color: '#974F0C' },
    development: { bg: '#E3FCEF', color: '#006644' },
    all:         { bg: '#DEEBFF', color: '#0052CC' },
};

interface Credential {
    _id: string;
    label: string;
    value: string; // '[MASKED]' from list
    category: string;
    isSecret: boolean;
    environment: string;
    sensitivityLevel?: 'normal' | 'sensitive' | 'critical';
    addedBy: { _id: string; name: string; role: VaultRole };
    addedByRole: VaultRole;
    createdAt: string;
}

interface CredentialRowProps {
    cred: Credential;
    projectId: string;
    currentUserId: string;
    canDelete: boolean;
    onDeleted: () => void;
}

export function CredentialRow({ cred, projectId, currentUserId, canDelete, onDeleted }: CredentialRowProps) {
    const [revealed, setRevealed]         = useState(false);
    const [revealedVal, setRevealedVal]   = useState('');
    const [revealing, setRevealing]       = useState(false);
    const [copied, setCopied]             = useState(false);
    const [confirmOpen, setConfirmOpen]   = useState(false);
    const [deleting, setDeleting]         = useState(false);

    // Phase 10: Critical credential prompt
    const [promptingReason, setPromptingReason] = useState(false);
    const [reason, setReason]                   = useState('');

    const envStyle = ENV_COLORS[cred.environment] ?? ENV_COLORS.all;

    const handleReveal = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (revealed) { setRevealed(false); setRevealedVal(''); return; }

        if (cred.sensitivityLevel === 'critical' && !reason && currentUserId !== cred.addedBy._id) {
            setPromptingReason(true);
            return;
        }

        setRevealing(true);
        const { data, error } = await api.post<any>(`/api/v1/projects/${projectId}/credentials/${cred._id}/reveal`, { reason });
        setRevealing(false);
        if (error) { alert(error.message); return; }
        
        setRevealedVal((data as any)?.data?.value ?? '');
        setRevealed(true);
        setPromptingReason(false);
        setReason('');
    };

    const handleCopy = async () => {
        const val = revealed ? revealedVal : cred.value;
        await navigator.clipboard.writeText(val);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
    };

    const handleDelete = async () => {
        setDeleting(true);
        await api.delete(`/api/v1/projects/${projectId}/credentials/${cred._id}`);
        setDeleting(false);
        setConfirmOpen(false);
        onDeleted();
    };

    return (
        <div style={{
            background: 'var(--vault-surface)',
            border: '1px solid var(--vault-border)',
            borderRadius: 4,
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
        }}>
            {/* Row 1 — label + env + meta + actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {/* Label */}
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--vault-ink)', flex: 1, minWidth: 120, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {cred.label}
                    {cred.sensitivityLevel === 'critical' && (
                        <span style={{ fontSize: 9, background: 'var(--vault-danger-light)', color: 'var(--vault-danger)', padding: '1px 4px', borderRadius: 2, fontWeight: 800, letterSpacing: 0.5 }}>
                            CRITICAL
                        </span>
                    )}
                </span>

                {/* Environment pill */}
                <span style={{
                    background: envStyle.bg, color: envStyle.color,
                    fontSize: 10, fontWeight: 700, padding: '2px 7px',
                    borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.05em',
                    whiteSpace: 'nowrap',
                }}>
                    {cred.environment}
                </span>

                {/* Added by */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Avatar name={cred.addedBy?.name ?? '?'} size="sm" />
                    <Badge role={cred.addedByRole} />
                </div>

                {/* Reveal */}
                <button
                    onClick={handleReveal}
                    disabled={revealing}
                    title={revealed ? 'Mask' : 'Reveal'}
                    style={{
                        background: revealed ? 'var(--vault-success-light)' : 'var(--vault-tag-bg)',
                        color: revealed ? 'var(--vault-success)' : 'var(--vault-ink-muted)',
                        border: 'none', borderRadius: 3, padding: '3px 8px',
                        cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        transition: 'all 120ms',
                    }}
                >
                    {revealing ? '…' : revealed ? 'Mask' : '👁 Reveal'}
                </button>

                {/* Copy */}
                <button
                    onClick={handleCopy}
                    title="Copy to clipboard"
                    style={{
                        background: copied ? 'var(--vault-success-light)' : 'var(--vault-tag-bg)',
                        color: copied ? 'var(--vault-success)' : 'var(--vault-ink-muted)',
                        border: 'none', borderRadius: 3, padding: '3px 8px',
                        cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        transition: 'all 120ms',
                    }}
                >
                    {copied ? '✓' : '⎘ Copy'}
                </button>

                {/* Delete */}
                {canDelete && (
                    <button
                        onClick={() => setConfirmOpen(true)}
                        title="Delete"
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--vault-danger)', fontSize: 16, lineHeight: 1,
                            padding: '2px 4px',
                        }}
                    >
                        ✕
                    </button>
                )}
            </div>

            {/* Row 2 — value (masked or revealed) */}
            <div style={{
                fontFamily: 'monospace',
                fontSize: 12,
                color: revealed ? 'var(--vault-ink)' : 'var(--vault-ink-subtle)',
                background: 'var(--vault-bg)',
                border: '1px solid var(--vault-border)',
                borderRadius: 3,
                padding: '6px 10px',
                wordBreak: 'break-all',
                letterSpacing: revealed ? 'normal' : '0.15em',
                userSelect: revealed ? 'text' : 'none',
            }}>
                {promptingReason ? (
                    <form onSubmit={handleReveal} style={{ display: 'flex', gap: 8 }}>
                        <input
                            autoFocus
                            placeholder="Reason for revealing critical credential..."
                            value={reason} onChange={e => setReason(e.target.value)}
                            style={{ flex: 1, border: '1px solid var(--vault-border)', padding: '4px 8px', fontSize: 12, borderRadius: 3, letterSpacing: 'normal', outline: 'none' }}
                        />
                        <button type="submit" disabled={!reason.trim()} style={{ background: 'var(--vault-primary)', color: '#fff', border: 'none', borderRadius: 3, padding: '0 10px', fontSize: 12, fontWeight: 600, cursor: reason.trim() ? 'pointer' : 'not-allowed' }}>
                            Confirm
                        </button>
                        <button type="button" onClick={() => setPromptingReason(false)} style={{ background: 'var(--vault-bg-hover)', color: 'var(--vault-ink)', border: 'none', borderRadius: 3, padding: '0 8px', fontSize: 12, cursor: 'pointer' }}>
                            Cancel
                        </button>
                    </form>
                ) : (
                    revealed ? revealedVal : '••••••••••••••••'
                )}
            </div>

            <ConfirmDialog
                isOpen={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={handleDelete}
                title="Delete credential"
                message={`Permanently delete "${cred.label}"? This cannot be undone.`}
                confirmLabel="Delete"
                loading={deleting}
            />
        </div>
    );
}
