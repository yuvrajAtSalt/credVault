'use client';

import React, { Component, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('[ErrorBoundary]', error, info);
    }

    render() {
        if (!this.state.hasError) return this.props.children;

        if (this.props.fallback) return this.props.fallback;

        const isDev = process.env.NODE_ENV === 'development';

        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--vault-surface)',
                padding: 24,
            }}>
                <div style={{
                    background: 'var(--vault-bg)',
                    border: '1px solid var(--vault-danger)',
                    borderRadius: 12,
                    padding: '40px 48px',
                    maxWidth: 480,
                    textAlign: 'center',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                }}>
                    {/* Icon */}
                    <div style={{
                        width: 56, height: 56, borderRadius: '50%',
                        background: 'var(--vault-danger-light)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 20px',
                    }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--vault-danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="12" y1="8" x2="12" y2="12"/>
                            <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                    </div>

                    <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--vault-ink)', marginBottom: 8 }}>
                        Something went wrong
                    </h1>
                    <p style={{ fontSize: 13, color: 'var(--vault-ink-muted)', marginBottom: 24, lineHeight: 1.6 }}>
                        An unexpected error occurred. Please try reloading the page.
                    </p>

                    {/* Dev-only error detail */}
                    {isDev && this.state.error && (
                        <pre style={{
                            fontSize: 11,
                            color: 'var(--vault-danger)',
                            background: 'var(--vault-danger-light)',
                            border: '1px solid var(--vault-danger)',
                            borderRadius: 6,
                            padding: '10px 12px',
                            textAlign: 'left',
                            overflow: 'auto',
                            marginBottom: 20,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                        }}>
                            {this.state.error.message}
                        </pre>
                    )}

                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            background: 'var(--vault-primary)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            padding: '10px 24px',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'background 120ms',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--vault-primary-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'var(--vault-primary)')}
                    >
                        Reload page
                    </button>
                </div>
            </div>
        );
    }
}
