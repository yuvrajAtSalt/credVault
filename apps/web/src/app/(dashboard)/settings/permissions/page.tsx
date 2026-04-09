'use client';

import { BASE_PERMISSIONS, ROLE_LABELS, VAULT_ROLES, VaultRole } from '@/lib/constants';

const COLUMNS: { key: keyof typeof BASE_PERMISSIONS[VaultRole]; label: string; short: string }[] = [
    { key: 'canSeeAllProjects',    label: 'See all projects',   short: 'All Projects'   },
    { key: 'canCreateProject',     label: 'Create project',     short: 'Create Project' },
    { key: 'canAddCredential',     label: 'Add credential',     short: 'Add Cred'       },
    { key: 'canManageTeam',        label: 'Manage team',        short: 'Manage Team'    },
    { key: 'canGrantVisibility',   label: 'Grant visibility',   short: 'Grant Vis.'     },
    { key: 'canManageRoles',       label: 'Manage roles',       short: 'Manage Roles'   },
    { key: 'canSeeAllCredentials', label: 'See all credentials',short: 'All Creds'      },
    { key: 'isGod',                label: 'God mode',           short: 'God Mode'       },
];

const ROLE_DESCRIPTIONS: Record<VaultRole, string> = {
    SYSADMIN:  'Full god-mode access. Sees and manages everything.',
    CEO:       'Executive-level read access across all projects and credentials.',
    COO:       'Operations oversight — full visibility but no team management.',
    CFO:       'Finance oversight — full visibility but no team management.',
    CMO:       'Marketing lead — can create projects and credentials in own scope.',
    MANAGER:   'Team manager — can create projects, manage their team, and grant visibility.',
    DEVOPS:    'Can add credentials but limited to own assigned projects.',
    DEVELOPER: 'Can add credentials but limited to own assigned projects.',
    QA:        'Can add credentials but limited to own assigned projects.',
};

const ROLE_COLORS: Record<VaultRole, string> = {
    SYSADMIN: '#8b5cf6', CEO: '#3b82f6', COO: '#06b6d4', CFO: '#10b981',
    CMO:      '#f59e0b', MANAGER: '#f97316', DEVOPS: '#64748b',
    DEVELOPER:'#6366f1', QA: '#ec4899',
};

function CheckIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
        </svg>
    );
}
function MinusIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
    );
}

export default function PermissionsPage() {
    return (
        <div className="vault-page">
            {/* Header */}
            <div className="vault-page-header">
                <div>
                    <h1 className="vault-page-title">Permissions Matrix</h1>
                    <p className="vault-page-subtitle">
                        Read-only view of role-based access control across the organisation.
                    </p>
                </div>
            </div>

            {/* Matrix Table */}
            <div className="vault-card" style={{ padding: 0, overflow: 'auto', marginBottom: 32 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--vault-border)' }}>
                            <th style={{
                                padding: '12px 16px', textAlign: 'left', fontSize: 12,
                                fontWeight: 600, color: 'var(--vault-ink-muted)', width: 160,
                                background: 'var(--vault-surface-raised)',
                            }}>Role</th>
                            {COLUMNS.map((col) => (
                                <th key={col.key} title={col.label} style={{
                                    padding: '12px 10px', textAlign: 'center', fontSize: 11,
                                    fontWeight: 600, color: 'var(--vault-ink-muted)',
                                    background: 'var(--vault-surface-raised)',
                                    whiteSpace: 'nowrap',
                                }}>
                                    {col.short}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {VAULT_ROLES.map((role, i) => {
                            const perms = BASE_PERMISSIONS[role];
                            return (
                                <tr key={role} style={{
                                    borderBottom: i < VAULT_ROLES.length - 1 ? '1px solid var(--vault-border)' : 'none',
                                    transition: 'background 120ms',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--vault-surface-raised)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <td style={{ padding: '12px 16px' }}>
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 6,
                                            fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
                                            color: ROLE_COLORS[role],
                                            background: ROLE_COLORS[role] + '18',
                                            border: `1px solid ${ROLE_COLORS[role]}40`,
                                            borderRadius: 4, padding: '3px 8px',
                                        }}>
                                            {ROLE_LABELS[role]}
                                        </span>
                                    </td>
                                    {COLUMNS.map((col) => (
                                        <td key={col.key} style={{ textAlign: 'center', padding: '12px 10px' }}>
                                            {perms[col.key] ? <CheckIcon /> : <MinusIcon />}
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Role Legend */}
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--vault-ink)', marginBottom: 16 }}>Role Descriptions</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {VAULT_ROLES.map((role) => {
                    const perms = BASE_PERMISSIONS[role];
                    const granted = COLUMNS.filter((c) => perms[c.key]);
                    return (
                        <div key={role} className="vault-card" style={{ padding: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                <span style={{
                                    fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                                    color: ROLE_COLORS[role],
                                    background: ROLE_COLORS[role] + '18',
                                    border: `1px solid ${ROLE_COLORS[role]}40`,
                                    borderRadius: 4, padding: '2px 7px',
                                }}>
                                    {ROLE_LABELS[role]}
                                </span>
                            </div>
                            <p style={{ fontSize: 12, color: 'var(--vault-ink-muted)', marginBottom: 12, lineHeight: 1.5 }}>
                                {ROLE_DESCRIPTIONS[role]}
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {granted.map((c) => (
                                    <span key={c.key} style={{
                                        fontSize: 10, padding: '2px 6px',
                                        background: 'rgba(34,197,94,0.1)',
                                        border: '1px solid rgba(34,197,94,0.25)',
                                        borderRadius: 3, color: '#22c55e',
                                        fontWeight: 500,
                                    }}>
                                        {c.short}
                                    </span>
                                ))}
                                {granted.length === 0 && (
                                    <span style={{ fontSize: 11, color: 'var(--vault-ink-subtle)' }}>No elevated permissions</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
