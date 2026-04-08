'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { api } from '@/lib/api';
import { VAULT_ROLES, ROLE_LABELS, type VaultRole } from '@/lib/constants';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/components/auth/auth-provider';

const ROLE_OPTIONS = VAULT_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onCreated: () => void;
    orgMembers: { _id: string; name: string; role: VaultRole }[];
}

export function InviteMemberModal({ isOpen, onClose, onCreated, orgMembers }: Props) {
    const { user } = useAuth();
    const perms = usePermissions();

    const [name, setName]             = useState('');
    const [email, setEmail]           = useState('');
    const [role, setRole]             = useState<VaultRole>('DEVELOPER');
    const [jobTitle, setJobTitle]     = useState('');
    const [department, setDept]       = useState('');
    const [reportingTo, setReporting] = useState('');
    const [loading, setLoading]       = useState(false);
    const [error, setError]           = useState('');
    const [inviteLink, setInviteLink] = useState('');
    const [copied, setCopied]         = useState(false);

    const isSysadmin = user?.role === 'SYSADMIN';
    // Non-sysadmins can't assign privileged roles
    const allowedRoles = isSysadmin
        ? ROLE_OPTIONS
        : ROLE_OPTIONS.filter((r) => !['SYSADMIN', 'CEO', 'COO', 'CFO', 'CMO'].includes(r.value));

    const reportingOptions = [
        { value: '', label: '— None —' },
        ...orgMembers.map((m) => ({ value: m._id, label: `${m.name} (${ROLE_LABELS[m.role]})` })),
    ];

    const handleClose = () => {
        setName(''); setEmail(''); setRole('DEVELOPER');
        setJobTitle(''); setDept(''); setReporting('');
        setError(''); setInviteLink(''); setCopied(false);
        onClose();
    };

    const handleSubmit = async () => {
        if (!name.trim() || !email.trim()) { setError('Name and email are required.'); return; }
        setLoading(true); setError('');
        const { data, error: apiErr } = await api.post<any>('/api/v1/auth/invite', {
            name: name.trim(), email: email.trim().toLowerCase(),
            role, jobTitle, department, reportingTo: reportingTo || undefined,
        });
        setLoading(false);
        if (apiErr) { setError(apiErr.message); return; }
        const link = (data as any)?.data?.inviteLink ?? '';
        setInviteLink(link);
        onCreated();
    };

    const handleCopy = async () => {
        await navigator.clipboard.writeText(inviteLink);
        setCopied(true); setTimeout(() => setCopied(false), 1500);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="Invite team member"
            width="md"
            footer={
                !inviteLink ? (
                    <>
                        <Button variant="secondary" onClick={handleClose} disabled={loading}>Cancel</Button>
                        <Button variant="primary" onClick={handleSubmit} loading={loading}>Send invite</Button>
                    </>
                ) : (
                    <Button variant="secondary" onClick={handleClose}>Close</Button>
                )
            }
        >
            {inviteLink ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ background: 'var(--vault-success-light)', border: '1px solid var(--vault-success)', borderRadius: 4, padding: '10px 14px', fontSize: 13, color: 'var(--vault-success)' }}>
                        ✓ Invite created for <strong>{name}</strong>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--vault-ink-muted)' }}>Share this link with the team member:</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input
                            readOnly
                            value={inviteLink}
                            className="vault-input"
                            style={{ flex: 1, fontFamily: 'monospace', fontSize: 12 }}
                        />
                        <Button variant={copied ? 'secondary' : 'primary'} onClick={handleCopy}>
                            {copied ? '✓ Copied' : 'Copy'}
                        </Button>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {error && (
                        <div style={{ background: 'var(--vault-danger-light)', color: 'var(--vault-danger)', border: '1px solid var(--vault-danger)', borderRadius: 3, padding: '8px 12px', fontSize: 13 }}>
                            {error}
                        </div>
                    )}
                    <Input label="Full name *" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
                    <Input label="Email *" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as VaultRole)} options={allowedRoles} />
                    <Input label="Job title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Senior Backend Engineer" />
                    <Input label="Department" value={department} onChange={(e) => setDept(e.target.value)} placeholder="e.g. Engineering" />
                    <Select label="Reports to" value={reportingTo} onChange={(e) => setReporting(e.target.value)} options={reportingOptions} />
                </div>
            )}
        </Modal>
    );
}
