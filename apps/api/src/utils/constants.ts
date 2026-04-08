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
}> = {
    SYSADMIN:  { canSeeAllProjects:true,  canCreateProject:true,  canAddCredential:true,  canManageTeam:true,  canManageRoles:true,  canGrantVisibility:true,  canSeeAllCredentials:true,  isGod:true  },
    CEO:       { canSeeAllProjects:true,  canCreateProject:true,  canAddCredential:true,  canManageTeam:false, canManageRoles:false, canGrantVisibility:false, canSeeAllCredentials:true,  isGod:false },
    COO:       { canSeeAllProjects:true,  canCreateProject:true,  canAddCredential:true,  canManageTeam:false, canManageRoles:false, canGrantVisibility:false, canSeeAllCredentials:true,  isGod:false },
    CFO:       { canSeeAllProjects:true,  canCreateProject:true,  canAddCredential:true,  canManageTeam:false, canManageRoles:false, canGrantVisibility:false, canSeeAllCredentials:true,  isGod:false },
    CMO:       { canSeeAllProjects:false, canCreateProject:true,  canAddCredential:true,  canManageTeam:false, canManageRoles:false, canGrantVisibility:false, canSeeAllCredentials:false, isGod:false },
    MANAGER:   { canSeeAllProjects:false, canCreateProject:true,  canAddCredential:true,  canManageTeam:true,  canManageRoles:false, canGrantVisibility:true,  canSeeAllCredentials:false, isGod:false },
    DEVOPS:    { canSeeAllProjects:false, canCreateProject:false, canAddCredential:true,  canManageTeam:false, canManageRoles:false, canGrantVisibility:false, canSeeAllCredentials:false, isGod:false },
    DEVELOPER: { canSeeAllProjects:false, canCreateProject:false, canAddCredential:true,  canManageTeam:false, canManageRoles:false, canGrantVisibility:false, canSeeAllCredentials:false, isGod:false },
    QA:        { canSeeAllProjects:false, canCreateProject:false, canAddCredential:true,  canManageTeam:false, canManageRoles:false, canGrantVisibility:false, canSeeAllCredentials:false, isGod:false },
};

export const EXECUTIVE_ROLES: VaultRole[] = ['CEO', 'COO', 'CFO'];
export const ADMIN_ROLES: VaultRole[] = ['SYSADMIN'];
export const MANAGER_ROLES: VaultRole[] = ['MANAGER'];
export const PRIVLEGED_ROLES: VaultRole[] = ['SYSADMIN', 'MANAGER'];
