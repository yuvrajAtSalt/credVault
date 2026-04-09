'use client';

import Link from 'next/link';

export default function NotFound() {
    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--vault-bg)',
            padding: 20
        }}>
            <div className="vault-card" style={{ textAlign: 'center', padding: '40px 32px', maxWidth: 400 }}>
                {/* SVG Illustration: Vault door */}
                <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'center' }}>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="var(--vault-primary)" strokeWidth="2" fill="rgba(0,82,204,0.1)"/>
                        <circle cx="12" cy="12" r="3" stroke="var(--vault-primary)" strokeWidth="2"/>
                        <rect x="11" y="12" width="2" height="4" fill="var(--vault-primary)"/>
                    </svg>
                </div>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--vault-ink)', margin: '0 0 8px' }}>Page not found</h1>
                <p style={{ fontSize: 14, color: 'var(--vault-ink-muted)', margin: '0 0 24px', lineHeight: 1.5 }}>
                    The page you are looking for does not exist or you don't have access to it.
                </p>
                <Link
                    href="/dashboard"
                    className="vault-btn vault-btn--primary"
                    style={{ textDecoration: 'none', display: 'inline-block' }}
                >
                    ← Back to dashboard
                </Link>
            </div>
        </div>
    );
}
