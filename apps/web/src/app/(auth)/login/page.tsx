'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { API_BASE_URL } from '@/lib/constants';

// ── Inner form — uses useSearchParams() so must be inside <Suspense> ──────────
function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { setAuth } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password }),
            });

            const json = await res.json();

            if (!res.ok) {
                setError(json.error?.message || 'Invalid email or password.');
                return;
            }

            const { user, token } = json.data.data;
            setAuth(user, token);

            const from = searchParams.get('from') || '/dashboard';
            router.replace(from);
        } catch {
            setError('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--vault-surface)',
            padding: '20px',
        }}>
            <div style={{ width: '100%', maxWidth: '400px' }}>

                {/* Logo / Title */}
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '48px',
                        height: '48px',
                        background: 'var(--vault-primary)',
                        borderRadius: '10px',
                        marginBottom: '16px',
                    }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <rect x="3" y="11" width="18" height="11" rx="2" stroke="white" strokeWidth="2"/>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                    </div>
                    <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--vault-ink)', marginBottom: '4px' }}>
                        Cred Vault
                    </h1>
                    <p style={{ fontSize: '14px', color: 'var(--vault-ink-muted)' }}>
                        Sign in to your workspace
                    </p>
                </div>

                {/* Card */}
                <div className="vault-card" style={{ padding: '32px' }}>
                    <form onSubmit={handleSubmit} noValidate>

                        {/* Error */}
                        {error && (
                            <div style={{
                                background: 'var(--vault-danger-light)',
                                color: 'var(--vault-danger)',
                                border: '1px solid var(--vault-danger)',
                                borderRadius: 'var(--vault-radius-sm)',
                                padding: '10px 14px',
                                fontSize: '13px',
                                marginBottom: '20px',
                            }}>
                                {error}
                            </div>
                        )}

                        {/* Email */}
                        <div style={{ marginBottom: '16px' }}>
                            <label htmlFor="login-email" style={{
                                display: 'block',
                                fontSize: '13px',
                                fontWeight: 600,
                                color: 'var(--vault-ink)',
                                marginBottom: '6px',
                            }}>
                                Email address
                            </label>
                            <input
                                id="login-email"
                                type="email"
                                className="vault-input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@company.com"
                                autoComplete="email"
                                required
                                disabled={loading}
                            />
                        </div>

                        {/* Password */}
                        <div style={{ marginBottom: '24px' }}>
                            <label htmlFor="login-password" style={{
                                display: 'block',
                                fontSize: '13px',
                                fontWeight: 600,
                                color: 'var(--vault-ink)',
                                marginBottom: '6px',
                            }}>
                                Password
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    id="login-password"
                                    type={showPassword ? 'text' : 'password'}
                                    className="vault-input"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    autoComplete="current-password"
                                    required
                                    disabled={loading}
                                    style={{ paddingRight: '44px' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    style={{
                                        position: 'absolute',
                                        right: '10px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'var(--vault-ink-muted)',
                                        padding: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                    }}
                                    tabIndex={-1}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                                            <line x1="1" y1="1" x2="23" y2="23"/>
                                        </svg>
                                    ) : (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                            <circle cx="12" cy="12" r="3"/>
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            id="login-submit"
                            type="submit"
                            className="vault-btn vault-btn--primary"
                            disabled={loading}
                            style={{ width: '100%', padding: '10px', fontSize: '14px', fontWeight: 600 }}
                        >
                            {loading ? 'Signing in…' : 'Sign in'}
                        </button>
                    </form>
                </div>

                <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--vault-ink-subtle)', marginTop: '16px' }}>
                    Access is by invite only. Contact your System Admin.
                </p>
            </div>
        </div>
    );
}

// ── Page shell — wraps LoginForm in Suspense as required by Next.js ───────────
export default function LoginPage() {
    return (
        <Suspense fallback={
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--vault-surface)' }}>
                <p style={{ color: 'var(--vault-ink-muted)', fontSize: 14 }}>Loading…</p>
            </div>
        }>
            <LoginForm />
        </Suspense>
    );
}
