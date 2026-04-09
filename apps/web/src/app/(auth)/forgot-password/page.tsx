'use client';

import { useState } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '@/lib/constants';

export default function ForgotPasswordPage() {
    const [email, setEmail]       = useState('');
    const [loading, setLoading]   = useState(false);
    const [sent, setSent]         = useState(false);
    const [error, setError]       = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email }),
            });
            if (!res.ok) {
                const json = await res.json();
                setError(json.error?.message || 'Something went wrong.');
            } else {
                setSent(true);
            }
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--vault-surface)', padding: 20,
        }}>
            <div style={{ width: '100%', maxWidth: 400 }}>
                {/* Back link */}
                <div style={{ marginBottom: 24 }}>
                    <Link href="/login" style={{ fontSize: 13, color: 'var(--vault-ink-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                        ← Back to login
                    </Link>
                </div>

                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 48, height: 48, background: 'var(--vault-primary)', borderRadius: 10, marginBottom: 16,
                    }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <rect x="3" y="11" width="18" height="11" rx="2" stroke="white" strokeWidth="2"/>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                    </div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--vault-ink)', marginBottom: 4 }}>Forgot your password?</h1>
                    <p style={{ fontSize: 14, color: 'var(--vault-ink-muted)' }}>
                        Enter your email address and we'll send you a reset link.
                    </p>
                </div>

                <div className="vault-card" style={{ padding: 32 }}>
                    {sent ? (
                        /* Success state */
                        <div style={{ textAlign: 'center', padding: '8px 0' }}>
                            <div style={{ fontSize: 40, marginBottom: 16 }}>✉️</div>
                            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--vault-ink)', marginBottom: 8 }}>Check your inbox</p>
                            <p style={{ fontSize: 14, color: 'var(--vault-ink-muted)' }}>
                                If an account exists for that email, a reset link has been sent. You can close this page.
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} noValidate>
                            {error && (
                                <div style={{
                                    background: 'var(--vault-danger-light)', color: 'var(--vault-danger)',
                                    border: '1px solid var(--vault-danger)', borderRadius: 'var(--vault-radius-sm)',
                                    padding: '10px 14px', fontSize: 13, marginBottom: 20,
                                }}>
                                    {error}
                                </div>
                            )}
                            <div style={{ marginBottom: 20 }}>
                                <label htmlFor="forgot-email" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--vault-ink)', marginBottom: 6 }}>
                                    Email address
                                </label>
                                <input
                                    suppressHydrationWarning
                                    id="forgot-email"
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
                            <button
                                type="submit"
                                className="vault-btn vault-btn--primary"
                                disabled={loading || !email}
                                style={{ width: '100%', padding: '10px', fontSize: 14, fontWeight: 600 }}
                            >
                                {loading ? 'Sending…' : 'Send reset link'}
                            </button>
                        </form>
                    )}
                </div>

                <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--vault-ink-subtle)', marginTop: 16 }}>
                    In development, the reset link is printed to server logs.
                </p>
            </div>
        </div>
    );
}
