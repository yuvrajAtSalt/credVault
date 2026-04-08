'use client';

import { useAuth } from '@/components/auth/auth-provider';
import { BASE_PERMISSIONS, VaultRole } from '@/lib/constants';

export function usePermissions() {
    const { user } = useAuth();

    const role = (user?.role as VaultRole) ?? null;
    const perms = role ? BASE_PERMISSIONS[role] : null;

    return {
        role,
        isGod: () => perms?.isGod ?? false,
        canSeeAllProjects: () => perms?.canSeeAllProjects ?? false,
        canCreateProject: () => perms?.canCreateProject ?? false,
        canAddCredential: (/* projectId? */) => perms?.canAddCredential ?? false,
        canManageTeam: () => perms?.canManageTeam ?? false,
        canManageRoles: () => perms?.canManageRoles ?? false,
        canGrantVisibility: (/* projectId? */) => perms?.canGrantVisibility ?? false,
        canSeeAllCredentials: (/* projectId? */) => perms?.canSeeAllCredentials ?? false,
    };
}
