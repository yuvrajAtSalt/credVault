'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { api } from '@/lib/api';
import { VAULT_ROLES, ROLE_LABELS, type VaultRole } from '@/lib/constants';
import { useAuth } from '@/components/auth/auth-provider';

const ROLE_OPTIONS = VAULT_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));

interface Member {
    _id: string;
    name: string;
    email: string;
    role: VaultRole;
    jobTitle?: string;
    department?: string;
    avatarUrl?: string;
    // The API may return a populated object or a plain string ID
    reportingTo?: { _id: string; name?: string; role?: VaultRole } | string | null;
    isActive: boolean;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
    member: Member | null;
    orgMembers: { _id: string; name: string; role: VaultRole }[];
}

export function EditMemberModal({ isOpen, onClose, onSaved, member, orgMembers }: Props) {
    const { user } = useAuth();
    const isSysadmin = user?.role === 'SYSADMIN';
    const isSelf = member?._id === user?._id;

    const [name, setName]             = useState('');
    const [role, setRole]             = useState<VaultRole>('DEVELOPER');
    const [originalRole, setOrigRole] = useState<VaultRole>('DEVELOPER');
    const [jobTitle, setJobTitle]     = useState('');
    const [department, setDept]       = useState('');
    const [reportingTo, setReporting] = useState('');
    const [loading, setLoading]       = useState(false);
    const [deactivating, setDeact]    = useState(false);
    const [confirmOpen, setConfirm]   = useState(false);
    const [error, setError]           = useState('');

    useEffect(() => {
        if (member) {
            setName(member.name);
            setRole(member.role);
            setOrigRole(member.role);
            setJobTitle(member.jobTitle ?? '');
            setDept(member.department ?? '');
            // reportingTo may be a plain ID string or a populated { _id } object
            const rt = member.reportingTo;
            setReporting(
                !rt ? '' :
                typeof rt === 'string' ? rt :
                rt._id,
            );
            setError('');
        }
    }, [member]);

    const reportingOptions = [
        { value: '', label: '— None —' },
        ...orgMembers
            .filter((m) => m._id !== member?._id)
            .map((m) => ({ value: m._id, label: `${m.name} (${ROLE_LABELS[m.role]})` })),
    ];

    const roleChanged = role !== originalRole;

    const handleSave = async () => {
        setLoading(true); setError('');
        const patch: any = { jobTitle, department, reportingTo: reportingTo || undefined };
        if (isSysadmin) { patch.name = name; patch.role = role; }
        const { error: apiErr } = await api.patch(`/api/v1/members/${member!._id}`, patch);
        setLoading(false);
        if (apiErr) { setError(apiErr.message); return; }
        onSaved(); onClose();
    };

    const handleDeactivate = async () => {
        setDeact(true);
        await api.post(`/api/v1/members/${member!._id}/deactivate`, {});
        setDeact(false);
        setConfirm(false);
        onSaved(); onClose();
    };

    if (!member) return null;

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title={`Edit — ${member.name}`}
                width="md"
                footer={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        {isSysadmin && member.isActive && (
                            <Button variant="danger" size="sm" onClick={() => setConfirm(true)}>Deactivate</Button>
                        )}
                        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                            <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
                            <Button variant="primary" onClick={handleSave} loading={loading}>Save changes</Button>
                        </div>
                    </div>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {error && (
                        <div style={{ background: 'var(--vault-danger-light)', color: 'var(--vault-danger)', border: '1px solid var(--vault-danger)', borderRadius: 3, padding: '8px 12px', fontSize: 13 }}>
                            {error}
                        </div>
                    )}

                    {isSysadmin && (
                        <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
                    )}

                    {isSysadmin && (
                        <>
                            <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as VaultRole)} options={ROLE_OPTIONS} />
                            {roleChanged && (
                                <div style={{ background: 'var(--vault-warning-light)', border: '1px solid var(--vault-warning)', borderRadius: 3, padding: '8px 12px', fontSize: 12, color: '#974F0C' }}>
                                    ⚠️ Changing this user's role will update their access across all projects immediately.
                                </div>
                            )}
                        </>
                    )}

                    <Input label="Job title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
                    <Input label="Department" value={department} onChange={(e) => setDept(e.target.value)} />
                    {isSysadmin && (
                        <Select label="Reports to" value={reportingTo} onChange={(e) => setReporting(e.target.value)} options={reportingOptions} />
                    )}
                </div>
            </Modal>

            <ConfirmDialog
                isOpen={confirmOpen}
                onClose={() => setConfirm(false)}
                onConfirm={handleDeactivate}
                title="Deactivate member"
                message={`Deactivate ${member.name}? They will lose access immediately.`}
                confirmLabel="Deactivate"
                loading={deactivating}
            />
        </>
    );
}
