// ─── VaultStack Role constants ─────────────────────────────────────────────
export const VAULT_ROLES = [
    'SYSADMIN',
    'CEO',
    'COO',
    'CFO',
    'CMO',
    'MANAGER',
    'DEVOPS',
    'DEVELOPER',
    'QA',
] as const;

export type VaultRole = (typeof VAULT_ROLES)[number];

// ─── Executive roles — see all credentials org-wide ────────────────────────
export const EXECUTIVE_ROLES: VaultRole[] = ['CEO', 'COO', 'CFO'];

// ─── Admin-level roles — can manage team / roles ───────────────────────────
export const ADMIN_ROLES: VaultRole[] = ['SYSADMIN'];

// ─── Manager-level roles — can grant visibility ────────────────────────────
export const MANAGER_ROLES: VaultRole[] = ['MANAGER'];

// ─── Contributor roles — add credentials to assigned projects ───────────────
export const CONTRIBUTOR_ROLES: VaultRole[] = ['DEVOPS', 'DEVELOPER', 'QA'];

// ─── API ────────────────────────────────────────────────────────────────────
export const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5050';

// ─── Route paths ────────────────────────────────────────────────────────────
export const ROUTES = {
    LOGIN: '/login',
    DASHBOARD: '/dashboard',
    PROJECTS: '/projects',
    TEAM: '/team',
    SETTINGS: '/settings',
    AUDIT: '/audit',
} as const;
