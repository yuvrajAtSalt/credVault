import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Dashboard | VaultStack',
    description: 'Your VaultStack project overview.',
};

export default function DashboardPage() {
    return (
        <main className="vault-page">
            <div style={{ marginBottom: '28px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--vault-ink)', marginBottom: '4px' }}>
                    Dashboard
                </h1>
                <p style={{ fontSize: '14px', color: 'var(--vault-ink-muted)' }}>
                    Welcome to VaultStack — your secure credentials hub.
                </p>
            </div>

            {/* Phase 02 replaces this placeholder with real project cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '16px',
            }}>
                {[
                    { label: 'Total Projects', value: '—', color: 'var(--vault-primary)' },
                    { label: 'Credentials Stored', value: '—', color: 'var(--vault-success)' },
                    { label: 'Team Members', value: '—', color: 'var(--vault-warning)' },
                    { label: 'Recent Activity', value: '—', color: 'var(--vault-ink-muted)' },
                ].map((card) => (
                    <div key={card.label} className="vault-card">
                        <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--vault-ink-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                            {card.label}
                        </p>
                        <p style={{ fontSize: '28px', fontWeight: 700, color: card.color }}>
                            {card.value}
                        </p>
                    </div>
                ))}
            </div>

            <div className="vault-card" style={{ marginTop: '24px' }}>
                <p style={{ fontSize: '13px', color: 'var(--vault-ink-muted)', textAlign: 'center', padding: '32px 0' }}>
                    Phase 02 — Project listing & sidebar navigation coming next.
                </p>
            </div>
        </main>
    );
}
