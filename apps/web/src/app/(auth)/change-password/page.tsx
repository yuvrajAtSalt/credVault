'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/auth-provider';

export default function ChangePasswordPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [form, setForm]       = useState({ newPassword: '', confirm: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (form.newPassword !== form.confirm) { setError('Passwords do not match.'); return; }
        if (form.newPassword.length < 8)       { setError('Password must be at least 8 characters.'); return; }
        setLoading(true);
        const res = await api.post('/api/v1/auth/change-password', {
            currentPassword: 'FORCE_CHANGE', // sentinel — backend handles forcePasswordChange differently
            newPassword: form.newPassword,
        });
        setLoading(false);
        if (res.error) { setError(res.error.message); return; }
        router.replace('/dashboard');
    };

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--vault-bg)',
        }}>
            <div style={{
                background: '#fff', borderRadius: 12, padding: '40px 36px',
                boxShadow: '0 4px 24px rgba(23,43,77,0.12)', width: '100%', maxWidth: 420,
            }}>
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <div style={{
                        width: 48, height: 48, borderRadius: '50%',
                        background: 'rgba(0,82,204,0.1)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
                    }}>
                        🔐
                    </div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--vault-text)', margin: 0 }}>
                        Set Your Password
                    </h1>
                    <p style={{ fontSize: 13, color: 'var(--vault-text-secondary)', marginTop: 6 }}>
                        Your administrator has set a temporary password. Please create a new one to continue.
                    </p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--vault-text)', display: 'block', marginBottom: 6 }}>
                            New Password
                        </label>
                        <input
                            type="password" required minLength={8}
                            placeholder="Min 8 chars, 1 uppercase, 1 number"
                            value={form.newPassword}
                            onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
                            className="vault-input"
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--vault-text)', display: 'block', marginBottom: 6 }}>
                            Confirm Password
                        </label>
                        <input
                            type="password" required
                            placeholder="Must match new password"
                            value={form.confirm}
                            onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
                            className="vault-input"
                        />
                    </div>
                    {error && (
                        <p style={{ fontSize: 12, color: 'var(--vault-danger)', background: 'rgba(222,53,11,0.08)', padding: '8px 12px', borderRadius: 6, margin: 0 }}>
                            {error}
                        </p>
                    )}
                    <button
                        type="submit" disabled={loading}
                        className="vault-btn vault-btn--primary"
                        style={{ marginTop: 4, width: '100%', padding: '10px 0', fontSize: 14, fontWeight: 600 }}
                    >
                        {loading ? 'Saving…' : 'Set Password & Continue'}
                    </button>
                </form>
            </div>
        </div>
    );
}
