'use client';

import React from 'react';

interface EmptyStateProps {
    title: string;
    description?: string;
    icon?: React.ReactNode;
    action?: {
        label: string;
        onClick: () => void;
    };
    style?: React.CSSProperties;
}

export function EmptyState({ title, description, icon, action, style }: EmptyStateProps) {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '64px 24px',
            ...style
        }}>
            {icon ? (
                <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.8 }}>
                    {icon}
                </div>
            ) : (
                <div style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    background: 'var(--vault-surface-2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 20,
                    color: 'var(--vault-ink-subtle)',
                }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                </div>
            )}
            
            <h3 style={{
                fontSize: 16,
                fontWeight: 600,
                color: 'var(--vault-ink)',
                margin: '0 0 8px 0',
            }}>
                {title}
            </h3>
            
            {description && (
                <p style={{
                    fontSize: 14,
                    color: 'var(--vault-ink-muted)',
                    margin: '0 0 24px 0',
                    maxWidth: 320,
                    lineHeight: 1.5,
                }}>
                    {description}
                </p>
            )}
            
            {action && (
                <button
                    className="vault-btn vault-btn--primary"
                    onClick={action.onClick}
                    style={{ fontSize: 13, padding: '8px 16px' }}
                >
                    {action.label}
                </button>
            )}
        </div>
    );
}
