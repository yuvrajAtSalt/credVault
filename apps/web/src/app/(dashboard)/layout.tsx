import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Dashboard | VaultStack',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            {/* Sidebar placeholder — Phase 02 builds the full sidebar */}
            <nav className="vault-sidebar">
                <a href="/dashboard" className="vault-sidebar__logo">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="11" width="18" height="11" rx="2" stroke="white" strokeWidth="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    <span className="vault-sidebar__logo-text">VaultStack</span>
                </a>
                <div className="vault-sidebar__nav">
                    <span className="vault-sidebar__section-label">Navigation</span>
                    {[
                        { href: '/dashboard', label: 'Dashboard' },
                        { href: '/projects',  label: 'Projects' },
                        { href: '/team',      label: 'Team' },
                        { href: '/audit',     label: 'Audit Log' },
                        { href: '/settings',  label: 'Settings' },
                    ].map((item) => (
                        <a key={item.href} href={item.href} className="vault-nav-item">
                            {item.label}
                        </a>
                    ))}
                </div>
            </nav>

            {/* Main content */}
            <div className="vault-shell">
                {children}
            </div>
        </div>
    );
}
