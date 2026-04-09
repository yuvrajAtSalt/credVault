// ─── VaultStack RBAC ─────────────────────────────────────────────────────────
export const VAULT_ROLES = [
    'SYSADMIN', 'CEO', 'COO', 'CFO', 'CMO',
    'MANAGER', 'DEVOPS', 'DEVELOPER', 'QA',
] as const;

export type VaultRole = (typeof VAULT_ROLES)[number];

export const ROLE_LABELS: Record<VaultRole, string> = {
    SYSADMIN:  'System Admin',
    CEO:       'CEO',
    COO:       'COO',
    CFO:       'CFO',
    CMO:       'CMO',
    MANAGER:   'Manager',
    DEVOPS:    'DevOps',
    DEVELOPER: 'Developer',
    QA:        'QA Engineer',
};

export const ROLE_COLORS: Record<VaultRole, string> = {
    SYSADMIN:  'vault-role--sysadmin',
    CEO:       'vault-role--ceo',
    COO:       'vault-role--coo',
    CFO:       'vault-role--cfo',
    CMO:       'vault-role--cmo',
    MANAGER:   'vault-role--manager',
    DEVOPS:    'vault-role--devops',
    DEVELOPER: 'vault-role--developer',
    QA:        'vault-role--qa',
};

export const BASE_PERMISSIONS: Record<VaultRole, {
    canSeeAllProjects: boolean;
    canCreateProject: boolean;
    canAddCredential: boolean;
    canManageTeam: boolean;
    canManageRoles: boolean;
    canGrantVisibility: boolean;
    canSeeAllCredentials: boolean;
    isGod: boolean;
    canManageMembers: boolean;
    canViewAuditLog: boolean;
    canManageOrgSettings: boolean;
}> = {
    SYSADMIN:  { canSeeAllProjects:true,  canCreateProject:true,  canAddCredential:true,  canManageTeam:true,  canManageRoles:true,  canGrantVisibility:true,  canSeeAllCredentials:true,  isGod:true,  canManageMembers:true,  canViewAuditLog:true,  canManageOrgSettings:true  },
    CEO:       { canSeeAllProjects:true,  canCreateProject:true,  canAddCredential:true,  canManageTeam:false, canManageRoles:false, canGrantVisibility:false, canSeeAllCredentials:true,  isGod:false, canManageMembers:false, canViewAuditLog:false, canManageOrgSettings:false },
    COO:       { canSeeAllProjects:true,  canCreateProject:true,  canAddCredential:true,  canManageTeam:false, canManageRoles:false, canGrantVisibility:false, canSeeAllCredentials:true,  isGod:false, canManageMembers:false, canViewAuditLog:false, canManageOrgSettings:false },
    CFO:       { canSeeAllProjects:true,  canCreateProject:true,  canAddCredential:true,  canManageTeam:false, canManageRoles:false, canGrantVisibility:false, canSeeAllCredentials:true,  isGod:false, canManageMembers:false, canViewAuditLog:false, canManageOrgSettings:false },
    CMO:       { canSeeAllProjects:false, canCreateProject:true,  canAddCredential:true,  canManageTeam:false, canManageRoles:false, canGrantVisibility:false, canSeeAllCredentials:false, isGod:false, canManageMembers:false, canViewAuditLog:false, canManageOrgSettings:false },
    MANAGER:   { canSeeAllProjects:false, canCreateProject:true,  canAddCredential:true,  canManageTeam:true,  canManageRoles:false, canGrantVisibility:true,  canSeeAllCredentials:false, isGod:false, canManageMembers:false, canViewAuditLog:false, canManageOrgSettings:false },
    DEVOPS:    { canSeeAllProjects:false, canCreateProject:false, canAddCredential:true,  canManageTeam:false, canManageRoles:false, canGrantVisibility:false, canSeeAllCredentials:false, isGod:false, canManageMembers:false, canViewAuditLog:false, canManageOrgSettings:false },
    DEVELOPER: { canSeeAllProjects:false, canCreateProject:false, canAddCredential:true,  canManageTeam:false, canManageRoles:false, canGrantVisibility:false, canSeeAllCredentials:false, isGod:false, canManageMembers:false, canViewAuditLog:false, canManageOrgSettings:false },
    QA:        { canSeeAllProjects:false, canCreateProject:false, canAddCredential:true,  canManageTeam:false, canManageRoles:false, canGrantVisibility:false, canSeeAllCredentials:false, isGod:false, canManageMembers:false, canViewAuditLog:false, canManageOrgSettings:false },
};

export const EXECUTIVE_ROLES: VaultRole[] = ['CEO', 'COO', 'CFO'];
export const PRIVILEGED_ROLES: VaultRole[] = ['SYSADMIN', 'MANAGER'];

// ─── Phase 09: All Permission Keys & Labels ───────────────────────────────────
export const ALL_PERMISSIONS = [
    'canSeeAllProjects', 'canCreateProject', 'canAddCredential',
    'canManageTeam', 'canGrantVisibility', 'canSeeAllCredentials',
    'canManageRoles', 'canManageMembers', 'canViewAuditLog',
    'canManageOrgSettings', 'isGod',
] as const;

export type Permission = typeof ALL_PERMISSIONS[number];

export const PERMISSION_LABELS: Record<Permission, { label: string; description: string; group: string }> = {
    canSeeAllProjects:    { label: 'See all projects',     description: 'View all projects org-wide, not just assigned ones',        group: 'Projects'     },
    canCreateProject:     { label: 'Create projects',      description: 'Create new projects in the organisation',                    group: 'Projects'     },
    canAddCredential:     { label: 'Add credentials',      description: 'Add credentials and env variables to projects',              group: 'Credentials'  },
    canGrantVisibility:   { label: 'Grant visibility',     description: 'Allow others to see credentials on your projects',           group: 'Credentials'  },
    canSeeAllCredentials: { label: 'See all credentials',  description: 'See credentials added by others, not just own',             group: 'Credentials'  },
    canManageTeam:        { label: 'Manage team',          description: 'Add/remove members from projects',                           group: 'Team'         },
    canManageMembers:     { label: 'Manage employees',     description: 'Create, edit, deactivate employees',                         group: 'Admin'        },
    canManageRoles:       { label: 'Manage roles',         description: 'Create and edit custom roles',                               group: 'Admin'        },
    canViewAuditLog:      { label: 'View audit log',       description: 'See the full organisation audit trail',                      group: 'Admin'        },
    canManageOrgSettings: { label: 'Manage org settings',  description: 'Edit organisation name, hierarchy, and settings',            group: 'Admin'        },
    isGod:                { label: 'God mode',             description: 'Bypass all permission checks — full access',                 group: 'Admin'        },
};

// ─── API ─────────────────────────────────────────────────────────────────────
export const API_BASE_URL =
    typeof window !== 'undefined'
        ? '' // Use absolute URL on server, relative path on client for rewriting
        : process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5050';

// ─── Routes ──────────────────────────────────────────────────────────────────
export const ROUTES = {
    LOGIN:     '/login',
    DASHBOARD: '/dashboard',
    PROJECTS:  '/projects',
    TEAM:      '/team',
    SETTINGS:  '/settings',
    AUDIT:     '/audit',
} as const;
