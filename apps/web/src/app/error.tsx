'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service in production
        console.error('Unhandled app error:', error);
    }, [error]);

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--vault-bg)',
            padding: 20
        }}>
            <div className="vault-card" style={{ textAlign: 'center', padding: '40px 32px', maxWidth: 440 }}>
                 <div style={{ marginBottom: 24, fontSize: 40, display: 'flex', justifyContent: 'center' }}>
                    ⚠️
                </div>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--vault-ink)', margin: '0 0 8px' }}>Something went wrong!</h1>
                <p style={{ fontSize: 14, color: 'var(--vault-ink-muted)', margin: '0 0 24px', lineHeight: 1.5 }}>
                    An unexpected error occurred. This issue has been logged.
                </p>
                
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                    <button
                        onClick={() => reset()}
                        className="vault-btn vault-btn--primary"
                    >
                        Try again
                    </button>
                    <Link
                        href="/dashboard"
                        className="vault-btn vault-btn--ghost"
                        style={{ textDecoration: 'none' }}
                    >
                        Go to dashboard
                    </Link>
                </div>
                {process.env.NODE_ENV === 'development' && (
                    <div style={{ marginTop: 32, padding: 12, background: 'var(--vault-surface)', borderRadius: 6, textAlign: 'left', overflowX: 'auto' }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--vault-danger)', margin: '0 0 4px' }}>{error.message}</p>
                        <pre style={{ fontSize: 10, color: 'var(--vault-ink-muted)', margin: 0 }}>{error.stack}</pre>
                    </div>
                )}
            </div>
        </div>
    );
}
