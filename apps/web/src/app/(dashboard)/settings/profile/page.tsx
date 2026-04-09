'use client';

import { useState, useEffect } from 'react';
import { API_BASE_URL, ROLE_LABELS, VaultRole } from '@/lib/constants';
import { useAuth } from '@/components/auth/auth-provider';
import { useToast } from '@/components/ui/Toast';

export default function ProfileSettingsPage() {
    const { user, token, setAuth } = useAuth();
    const { toast } = useToast();

    const [name, setName]             = useState('');
    const [jobTitle, setJobTitle]     = useState('');
    const [department, setDepartment] = useState('');
    const [saving, setSaving]         = useState(false);

    // Password change
    const [currentPw, setCurrentPw]   = useState('');
    const [newPw, setNewPw]           = useState('');
    const [confirmPw, setConfirmPw]   = useState('');
    const [pwSaving, setPwSaving]     = useState(false);

    useEffect(() => {
        if (!user || !token) return;
        // Fetch full profile
        fetch(`${API_BASE_URL}/api/v1/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
            credentials: 'include',
        })
            .then(r => r.json())
            .then(json => {
                const u = json.data?.data;
                if (u) {
                    setName(u.name ?? '');
                    setJobTitle(u.jobTitle ?? '');
                    setDepartment(u.department ?? '');
                }
            });
    }, [user, token]);

    const handleSaveProfile = async () => {
        if (!user) return;
        setSaving(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/members/${user._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                credentials: 'include',
                body: JSON.stringify({ name, jobTitle, department }),
            });
            const json = await res.json();
            if (res.ok) {
                toast.success('Profile saved!');
                // Refresh auth context with updated name
                setAuth({ ...user, name }, token!);
            } else {
                toast.error(json.error?.message || 'Failed to save profile.');
            }
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async () => {
        if (newPw !== confirmPw) {
            toast.error('New passwords do not match.');
            return;
        }
        if (newPw.length < 8) {
            toast.error('New password must be at least 8 characters.');
            return;
        }
        setPwSaving(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/auth/change-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                credentials: 'include',
                body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
            });
            const json = await res.json();
            if (res.ok) {
                toast.success('Password changed successfully!');
                setCurrentPw(''); setNewPw(''); setConfirmPw('');
            } else {
                toast.error(json.error?.message || 'Failed to change password.');
            }
        } finally {
            setPwSaving(false);
        }
    };

    const roleLabel = user?.role ? ROLE_LABELS[user.role as VaultRole] ?? user.role : '';

    function getInitials(n: string) {
        const parts = (n || '?').trim().split(' ');
        return (parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase();
    }

    return (
        <main style={{ padding: '28px 32px', maxWidth: 680 }}>
            <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--vault-ink)', margin: 0 }}>Profile Settings</h1>
                <p style={{ fontSize: 13, color: 'var(--vault-ink-muted)', marginTop: 4 }}>Manage your personal information and password.</p>
            </div>

            {/* Profile card */}
            <div className="vault-card" style={{ padding: 24, marginBottom: 24 }}>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--vault-ink)', margin: '0 0 20px' }}>Personal Information</h2>

                {/* Avatar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                    <div style={{
                        width: 64, height: 64, borderRadius: '50%',
                        background: 'var(--vault-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 22, fontWeight: 700, color: '#fff', flexShrink: 0,
                    }}>
                        {getInitials(name || user?.name || '')}
                    </div>
                    <div>
                        <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--vault-ink)' }}>{name || user?.name}</p>
                        <span style={{
                            display: 'inline-block', marginTop: 4, fontSize: 10, fontWeight: 700,
                            padding: '2px 8px', borderRadius: 4, letterSpacing: '0.05em',
                            background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
                            color: '#8b5cf6',
                        }}>
                            {roleLabel}
                        </span>
                    </div>
                </div>

                {/* Fields */}
                <div style={{ display: 'grid', gap: 16 }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--vault-ink)', marginBottom: 6 }}>
                            Full name
                        </label>
                        <input id="profile-name" className="vault-input" value={name} onChange={e => setName(e.target.value)} />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--vault-ink)', marginBottom: 6 }}>
                            Email address
                        </label>
                        <input
                            className="vault-input"
                            value={user?.email ?? ''}
                            disabled
                            style={{ opacity: 0.5, cursor: 'not-allowed' }}
                        />
                        <p style={{ fontSize: 11, color: 'var(--vault-ink-subtle)', marginTop: 4 }}>Email cannot be changed.</p>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--vault-ink)', marginBottom: 6 }}>
                            Role
                        </label>
                        <input
                            className="vault-input"
                            value={roleLabel}
                            disabled
                            style={{ opacity: 0.5, cursor: 'not-allowed' }}
                        />
                        <p style={{ fontSize: 11, color: 'var(--vault-ink-subtle)', marginTop: 4 }}>Role can only be changed by a System Admin.</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--vault-ink)', marginBottom: 6 }}>
                                Job title
                            </label>
                            <input
                                id="profile-jobtitle"
                                className="vault-input"
                                value={jobTitle}
                                onChange={e => setJobTitle(e.target.value)}
                                placeholder="e.g. Senior Engineer"
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--vault-ink)', marginBottom: 6 }}>
                                Department
                            </label>
                            <input
                                id="profile-department"
                                className="vault-input"
                                value={department}
                                onChange={e => setDepartment(e.target.value)}
                                placeholder="e.g. Engineering"
                            />
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: 20 }}>
                    <button
                        id="profile-save"
                        className="vault-btn vault-btn--primary"
                        onClick={handleSaveProfile}
                        disabled={saving}
                        style={{ padding: '9px 20px', fontWeight: 600 }}
                    >
                        {saving ? 'Saving…' : 'Save profile'}
                    </button>
                </div>
            </div>

            {/* Change password card */}
            <div className="vault-card" style={{ padding: 24 }}>
                <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--vault-ink)', margin: '0 0 20px' }}>Change Password</h2>

                <div style={{ display: 'grid', gap: 16 }}>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--vault-ink)', marginBottom: 6 }}>
                            Current password
                        </label>
                        <input
                            id="pw-current"
                            type="password"
                            className="vault-input"
                            value={currentPw}
                            onChange={e => setCurrentPw(e.target.value)}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--vault-ink)', marginBottom: 6 }}>
                            New password
                        </label>
                        <input
                            id="pw-new"
                            type="password"
                            className="vault-input"
                            value={newPw}
                            onChange={e => setNewPw(e.target.value)}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--vault-ink)', marginBottom: 6 }}>
                            Confirm new password
                        </label>
                        <input
                            id="pw-confirm"
                            type="password"
                            className="vault-input"
                            value={confirmPw}
                            onChange={e => setConfirmPw(e.target.value)}
                        />
                    </div>
                </div>

                {newPw && confirmPw && newPw !== confirmPw && (
                    <p style={{ fontSize: 12, color: 'var(--vault-danger)', marginTop: 8 }}>Passwords do not match.</p>
                )}

                <div style={{ marginTop: 20 }}>
                    <button
                        id="pw-submit"
                        className="vault-btn vault-btn--primary"
                        onClick={handleChangePassword}
                        disabled={pwSaving || !currentPw || !newPw || !confirmPw}
                        style={{ padding: '9px 20px', fontWeight: 600 }}
                    >
                        {pwSaving ? 'Changing…' : 'Change password'}
                    </button>
                </div>
            </div>
        </main>
    );
}
