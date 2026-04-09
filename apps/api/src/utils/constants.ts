// ─── VaultStack RBAC constants ────────────────────────────────────────────────
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

export const ROLE_LABELS: Record<VaultRole, string> = {
    SYSADMIN: 'System Admin',
    CEO: 'CEO',
    COO: 'COO',
    CFO: 'CFO',
    CMO: 'CMO',
    MANAGER: 'Manager',
    DEVOPS: 'DevOps',
    DEVELOPER: 'Developer',
    QA: 'QA Engineer',
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
    // ── Phase 09 additions ──────────────────────────────────────────────────
    canManageMembers: boolean;      // create/edit/deactivate employees
    canViewAuditLog: boolean;       // see full organisation audit trail
    canManageOrgSettings: boolean;  // edit org name, hierarchy, settings
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
export const ADMIN_ROLES: VaultRole[] = ['SYSADMIN'];
export const MANAGER_ROLES: VaultRole[] = ['MANAGER'];
export const PRIVLEGED_ROLES: VaultRole[] = ['SYSADMIN', 'MANAGER'];

// ─── Phase 09: all permission keys ────────────────────────────────────────────
export const ALL_PERMISSIONS = [
    'canSeeAllProjects',
    'canCreateProject',
    'canAddCredential',
    'canManageTeam',
    'canGrantVisibility',
    'canSeeAllCredentials',
    'canManageRoles',
    'canManageMembers',
    'canViewAuditLog',
    'canManageOrgSettings',
    'isGod',
] as const;

export type Permission = typeof ALL_PERMISSIONS[number];

