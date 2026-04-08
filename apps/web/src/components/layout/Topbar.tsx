'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useAuthActions } from '@/hooks/useAuthActions';
import { Avatar } from '@/components/ui/Avatar';

interface TopbarProps {
    onOpenSidebar: () => void;
}

export function Topbar({ onOpenSidebar }: TopbarProps) {
    const { user } = useAuth();
    const { logout } = useAuthActions();
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <header className="vault-header">
            {/* Mobile menu toggle */}
            <button
                className="vault-mobile-toggle"
                onClick={onOpenSidebar}
                style={{
                    display: 'none', background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 20, color: 'var(--vault-ink-muted)', padding: '4px',
                }}
                aria-label="Open menu"
            >
                ☰
            </button>

            {/* Spacer to push avatar to right */}
            <div style={{ flex: 1 }} />

            {/* Right side actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--vault-ink-muted)' }}
                    aria-label="Notifications"
                >
                    <span role="img" aria-hidden="true">🔔</span>
                </button>

                <div style={{ position: 'relative' }}>
                    <button
                        onClick={() => setMenuOpen(!menuOpen)}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px',
                            borderRadius: 'var(--vault-radius-sm)',
                        }}
                    >
                        <Avatar name={user?.name ?? 'Guest'} size="sm" />
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--vault-ink)' }}>
                            {user?.name?.split(' ')[0]}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--vault-ink-subtle)' }}>▼</span>
                    </button>

                    {menuOpen && (
                        <>
                            <div className="vault-overlay" style={{ background: 'transparent' }} onClick={() => setMenuOpen(false)} />
                            <div
                                className="vault-animate-in"
                                onClick={() => setMenuOpen(false)}
                                style={{
                                    position: 'absolute', top: '100%', right: 0, marginTop: 4,
                                    background: 'var(--vault-bg)',
                                    borderRadius: 'var(--vault-radius-md)',
                                    boxShadow: 'var(--vault-shadow-overlay)',
                                    border: '1px solid var(--vault-border)',
                                    minWidth: 160, zIndex: 210,
                                    display: 'flex', flexDirection: 'column', padding: '4px 0',
                                }}
                            >
                                <button className="vault-menu-item" style={{ padding: '8px 16px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 13 }}>
                                    Profile
                                </button>
                                <hr style={{ border: 'none', borderTop: '1px solid var(--vault-border)', margin: '4px 0' }} />
                                <button className="vault-menu-item" onClick={logout} style={{ padding: '8px 16px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 13, color: 'var(--vault-danger)' }}>
                                    Sign out
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
            <style>{`
                .vault-menu-item:hover { background: var(--vault-surface); }
                @media (max-width: 768px) {
                    .vault-mobile-toggle { display: block !important; }
                }
            `}</style>
        </header>
    );
}
