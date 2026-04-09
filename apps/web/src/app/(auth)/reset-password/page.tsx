'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { API_BASE_URL } from '@/lib/constants';

function getStrength(pw: string): { score: number; label: string; color: string } {
    let score = 0;
    if (pw.length >= 8)  score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 1) return { score, label: 'Weak',   color: '#FF5630' };
    if (score === 2) return { score, label: 'Fair',   color: '#FFAB00' };
    if (score === 3) return { score, label: 'Medium', color: '#FFC400' };
    return              { score, label: 'Strong',  color: '#36B37E' };
}

function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token') ?? '';

    const [validating, setValidating]     = useState(true);
    const [tokenValid, setTokenValid]     = useState(false);
    const [invalidReason, setInvalidReason] = useState('');

    const [password, setPassword]         = useState('');
    const [confirm, setConfirm]           = useState('');
    const [showPw, setShowPw]             = useState(false);
    const [showConfirm, setShowConfirm]   = useState(false);
    const [loading, setLoading]           = useState(false);
    const [error, setError]               = useState('');
    const [success, setSuccess]           = useState(false);
    const [countdown, setCountdown]       = useState(3);

    const strength = getStrength(password);

    // Validate token on mount
    const validate = useCallback(async () => {
        if (!token) { setInvalidReason('invalid'); setValidating(false); return; }
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/auth/reset-password/validate?token=${encodeURIComponent(token)}`, { credentials: 'include' });
            const json = await res.json();
            const payload = json?.data?.data ?? json?.data;
            if (payload?.valid) {
                setTokenValid(true);
            } else {
                setInvalidReason(payload?.reason ?? 'invalid');
            }
        } catch {
            setInvalidReason('invalid');
        } finally {
            setValidating(false);
        }
    }, [token]);

    useEffect(() => { validate(); }, [validate]);

    // Countdown redirect after success
    useEffect(() => {
        if (!success) return;
        const id = setInterval(() => setCountdown((c) => c - 1), 1000);
        return () => clearInterval(id);
    }, [success]);

    useEffect(() => {
        if (countdown <= 0) router.replace('/login');
    }, [countdown, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (password !== confirm) { setError('Passwords do not match.'); return; }
        if (strength.score < 2)   { setError('Please choose a stronger password.'); return; }
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ token, newPassword: password }),
            });
            const json = await res.json();
            if (!res.ok) { setError(json.error?.message || 'Reset failed.'); return; }
            setSuccess(true);
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const pageWrapper = (content: React.ReactNode) => (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--vault-surface)', padding: 20,
        }}>
            <div style={{ width: '100%', maxWidth: 420 }}>{content}</div>
        </div>
    );

    if (validating) return pageWrapper(
        <p style={{ textAlign: 'center', color: 'var(--vault-ink-muted)', fontSize: 14 }}>Validating link…</p>
    );

    if (!tokenValid) return pageWrapper(
        <div className="vault-card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✕</div>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--vault-ink)', marginBottom: 8 }}>
                This link has expired or is invalid.
            </p>
            <p style={{ fontSize: 14, color: 'var(--vault-ink-muted)', marginBottom: 20 }}>
                {invalidReason === 'expired' ? 'Your reset link has expired (links are valid for 1 hour).' : 'This reset link is not valid.'}
            </p>
            <Link href="/forgot-password" style={{ color: 'var(--vault-primary)', fontSize: 14 }}>
                Request a new reset link →
            </Link>
        </div>
    );

    if (success) return pageWrapper(
        <div className="vault-card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--vault-success)', marginBottom: 8 }}>Password updated!</p>
            <p style={{ fontSize: 14, color: 'var(--vault-ink-muted)' }}>
                Redirecting to login in {countdown}…
            </p>
        </div>
    );

    return pageWrapper(
        <>
            <div style={{ marginBottom: 24 }}>
                <Link href="/login" style={{ fontSize: 13, color: 'var(--vault-ink-muted)', textDecoration: 'none' }}>← Back to login</Link>
            </div>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--vault-ink)', marginBottom: 4 }}>Reset your password</h1>
            </div>
            <div className="vault-card" style={{ padding: 32 }}>
                <form onSubmit={handleSubmit} noValidate>
                    {error && (
                        <div style={{
                            background: 'var(--vault-danger-light)', color: 'var(--vault-danger)',
                            border: '1px solid var(--vault-danger)', borderRadius: 6,
                            padding: '10px 14px', fontSize: 13, marginBottom: 20,
                        }}>{error}</div>
                    )}

                    {/* New password */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--vault-ink)', marginBottom: 6 }}>New password</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                suppressHydrationWarning
                                type={showPw ? 'text' : 'password'}
                                className="vault-input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Min. 8 characters"
                                required
                                disabled={loading}
                                style={{ paddingRight: 44 }}
                            />
                            <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide' : 'Show'}
                                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vault-ink-muted)', fontSize: 13 }}>
                                {showPw ? '🙈' : '👁'}
                            </button>
                        </div>
                        {/* Strength meter */}
                        {password && (
                            <div style={{ marginTop: 8 }}>
                                <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                                    {[1, 2, 3, 4].map((n) => (
                                        <div key={n} style={{
                                            height: 4, flex: 1, borderRadius: 2,
                                            background: strength.score >= n ? strength.color : 'var(--vault-border)',
                                            transition: 'background 200ms',
                                        }} />
                                    ))}
                                </div>
                                <p style={{ fontSize: 11, color: strength.color, fontWeight: 600, margin: 0 }}>
                                    Password strength: {strength.label}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Confirm password */}
                    <div style={{ marginBottom: 24 }}>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--vault-ink)', marginBottom: 6 }}>Confirm new password</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                suppressHydrationWarning
                                type={showConfirm ? 'text' : 'password'}
                                className="vault-input"
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                placeholder="Repeat your password"
                                required
                                disabled={loading}
                                style={{ paddingRight: 44 }}
                            />
                            <button type="button" onClick={() => setShowConfirm((v) => !v)} aria-label={showConfirm ? 'Hide' : 'Show'}
                                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vault-ink-muted)', fontSize: 13 }}>
                                {showConfirm ? '🙈' : '👁'}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="vault-btn vault-btn--primary"
                        disabled={loading || !password || !confirm}
                        style={{ width: '100%', padding: '10px', fontSize: 14, fontWeight: 600 }}
                    >
                        {loading ? 'Updating…' : 'Set new password'}
                    </button>
                </form>
            </div>
        </>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--vault-surface)' }}>
                <p style={{ color: 'var(--vault-ink-muted)', fontSize: 14 }}>Loading…</p>
            </div>
        }>
            <ResetPasswordForm />
        </Suspense>
    );
}
