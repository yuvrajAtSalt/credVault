'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { useAuthActions } from '@/hooks/useAuthActions';
import { usePermissions } from '@/hooks/usePermissions';
import { Topbar } from '@/components/layout/Topbar';
import { ROLE_LABELS, VaultRole, ROLE_COLORS } from '@/lib/constants';

const NAV_ITEMS = [
    { href: '/dashboard', label: 'Dashboard', icon: '⊞' },
    { href: '/projects',  label: 'Projects',  icon: '◻' },
    { href: '/team',      label: 'Team',       icon: '◎' },
    { href: '/directory', label: 'Directory',  icon: '⊕' },
    { href: '/audit',     label: 'Audit Log',  icon: '≡' },
    { href: '/settings',  label: 'Settings',   icon: '⚙' },
];

function UserAvatar({ name }: { name: string }) {
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

    const roleLabel = user?.role
        ? ROLE_LABELS[user.role as VaultRole] ?? user.role
        : '';
    const roleCss = user?.role
        ? ROLE_COLORS[user.role as VaultRole] ?? 'vault-role--qa'
        : '';

    const visibleItems = NAV_ITEMS.filter((item) => {
        if (item.href === '/settings' || item.href === '/audit') {
            return perms.isGod() || perms.canManageRoles();
        }
        return true;
    });

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            {/* ── Mobile backdrop ─────────────────────────────────── */}
            {sidebarOpen && (
                <div
                    className="vault-overlay"
                    style={{ zIndex: 40 }}
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* ── Sidebar ─────────────────────────────────────────── */}
            <nav className={`vault-sidebar${sidebarOpen ? ' is-open' : ''}`}>
                {/* Logo */}
                <a href="/dashboard" className="vault-sidebar__logo">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="11" width="18" height="11" rx="2" stroke="white" strokeWidth="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    <span className="vault-sidebar__logo-text">Cred Vault</span>
                </a>

                {/* Nav items */}
                <div className="vault-sidebar__nav">
                    <span className="vault-sidebar__section-label">Navigation</span>
                    {visibleItems.map((item) => {
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

            {/* ── Main content ────────────────────────────────────── */}
            <div className="vault-shell">
                <Topbar onOpenSidebar={() => setSidebarOpen(true)} />
                {children}
            </div>
        </div>
    );
}
