'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { useAuthActions } from '@/hooks/useAuthActions';
import { usePermissions } from '@/hooks/usePermissions';
import { Topbar } from '@/components/layout/Topbar';
import { ToastProvider } from '@/components/ui/Toast';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { ROLE_LABELS, VaultRole, ROLE_COLORS } from '@/lib/constants';
import { CommandPalette } from '@/components/command/CommandPalette';
import { useRealtimeEvents } from '@/hooks/useRealtimeEvents';

const NAV_ITEMS = [
    { href: '/dashboard', label: 'Dashboard', icon: '⊞' },
    { href: '/projects',  label: 'Projects',  icon: '◻' },
    { href: '/team',      label: 'Team',       icon: '◎' },
    { href: '/directory', label: 'Directory',  icon: '⊕' },
];

const SETTINGS_ITEMS = [
    { href: '/settings/profile',                   label: 'Profile',              adminOnly: false },
    { href: '/settings/organisation/general',      label: 'General',              adminOnly: true  },
    { href: '/settings/roles',                     label: 'Roles & Permissions',  adminOnly: true  },
    { href: '/settings/permissions/requests',      label: 'Access Requests',      adminOnly: true  },
    { href: '/settings/organisation/structure',    label: 'Teams',                adminOnly: true  },
    { href: '/settings/users',                     label: 'Users',                adminOnly: true  },
    { href: '/settings/audit-log',                 label: 'Audit Log',            adminOnly: true  },
];

function UserAvatar({ name }: { name?: string }) {
    if (!name) return <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />;
    const parts = name.trim().split(' ');
    const initials = parts.length >= 2
        ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
        : name.slice(0, 2).toUpperCase();
    return (
        <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
        }}>
            {initials}
        </div>
    );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const { user } = useAuth();
    const { logout } = useAuthActions();
    const perms = usePermissions();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(() => pathname.startsWith('/settings'));

    const roleLabel = user?.role ? ROLE_LABELS[user.role as VaultRole] ?? user.role : '';
    const roleCss   = user?.role ? ROLE_COLORS[user.role as VaultRole] ?? 'vault-role--qa' : '';
    const isAdmin   = perms.isGod() || perms.canManageRoles();

    const isSettingsActive = pathname.startsWith('/settings');

    useRealtimeEvents();

    return (
        <ToastProvider>
            <div style={{ display: 'flex', minHeight: '100vh' }}>
                {/* Mobile backdrop */}
                {sidebarOpen && (
                    <div
                        className="vault-overlay"
                        style={{ zIndex: 40 }}
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* Sidebar */}
                <nav className={`vault-sidebar${sidebarOpen ? ' is-open' : ''}`}>
                    {/* Logo */}
                    <a href="/dashboard" className="vault-sidebar__logo">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                            <rect x="3" y="11" width="18" height="11" rx="2" stroke="white" strokeWidth="2"/>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        <span className="vault-sidebar__logo-text">Cred Vault</span>
                    </a>

                    {/* Primary nav */}
                    <div className="vault-sidebar__nav">
                        <span className="vault-sidebar__section-label">Navigation</span>
                        {NAV_ITEMS.map((item) => {
                            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setSidebarOpen(false)}
                                    className={`vault-nav-item${active ? ' is-active' : ''}`}
                                >
                                    <span style={{ fontSize: 14 }}>{item.icon}</span>
                                    {item.label}
                                </Link>
                            );
                        })}

                        {/* Settings group */}
                        <span className="vault-sidebar__section-label" style={{ marginTop: 16 }}>Settings</span>
                        <button
                            suppressHydrationWarning
                            onClick={() => setSettingsOpen((v) => !v)}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                width: '100%', background: isSettingsActive ? 'rgba(255,255,255,0.1)' : 'none',
                                border: 'none', cursor: 'pointer',
                                color: isSettingsActive ? '#fff' : 'var(--vault-sidebar-text)',
                                fontSize: 13, fontWeight: 500, padding: '8px 10px',
                                borderRadius: 6, transition: 'background 120ms',
                            }}
                            onMouseEnter={e => !isSettingsActive && (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                            onMouseLeave={e => !isSettingsActive && (e.currentTarget.style.background = 'none')}
                        >
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 14 }}>⚙</span>
                                Settings
                            </span>
                            <span style={{
                                fontSize: 10,
                                transition: 'transform 200ms',
                                transform: settingsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                            }}>▾</span>
                        </button>

                        {settingsOpen && (
                            <div style={{ paddingLeft: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {SETTINGS_ITEMS.filter(s => !s.adminOnly || isAdmin).map((item) => {
                                    const active = pathname === item.href || pathname.startsWith(item.href);
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            onClick={() => setSidebarOpen(false)}
                                            style={{
                                                display: 'block', padding: '6px 10px',
                                                borderRadius: 5, fontSize: 12,
                                                color: active ? '#fff' : 'var(--vault-sidebar-text)',
                                                background: active ? 'rgba(255,255,255,0.12)' : 'none',
                                                fontWeight: active ? 600 : 400,
                                                textDecoration: 'none',
                                                transition: 'background 120ms, color 120ms',
                                            }}
                                        >
                                            {item.label}
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* User footer */}
                    {user && (
                        <div style={{
                            padding: '12px 12px 16px',
                            borderTop: '1px solid rgba(255,255,255,0.08)',
                            display: 'flex', flexDirection: 'column', gap: 8,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <UserAvatar name={user.name} />
                                <div style={{ overflow: 'hidden' }}>
                                    <p style={{ fontSize: 12, fontWeight: 600, color: '#fff', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {user.name}
                                    </p>
                                    <p style={{ fontSize: 11, color: 'var(--vault-sidebar-text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {user.email}
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span className={`vault-role-badge ${roleCss}`} style={{ fontSize: 10 }}>
                                    {roleLabel}
                                </span>
                                <button
                                    onClick={logout}
                                    style={{
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        color: 'var(--vault-sidebar-text)', fontSize: 11,
                                        padding: '2px 6px', borderRadius: 3,
                                        transition: 'color 120ms',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--vault-sidebar-text)')}
                                    aria-label="Sign out"
                                >
                                    Sign out
                                </button>
                            </div>
                        </div>
                    )}
                </nav>

                {/* Main content */}
                <div className="vault-shell">
                    <Topbar onOpenSidebar={() => setSidebarOpen(true)} />
                    <CommandPalette />
                    <ErrorBoundary>
                        {children}
                    </ErrorBoundary>
                </div>
            </div>
        </ToastProvider>
    );
}
