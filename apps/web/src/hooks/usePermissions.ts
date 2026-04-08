'use client';

import { useAuth } from '@/components/auth/auth-provider';
import { BASE_PERMISSIONS, VaultRole } from '@/lib/constants';

/**
 * usePermissions — returns boolean helpers derived from BASE_PERMISSIONS.
 * Usage: const { canCreateProject, isGod } = usePermissions();
 */
export function usePermissions(projectOverride?: { scope?: 'all' | 'own' }) {
    const { user } = useAuth();

    if (!user) {
        return {
            canSeeAllProjects: false,
            canCreateProject: false,
            canAddCredential: false,
            canManageTeam: false,
            canManageRoles: false,
            canGrantVisibility: false,
            canSeeAllCredentials: false,
            isGod: false,
            // helpers
            canSeeCredential: () => false,
            canInviteMembers: false,
        };
    }

    const role = user.role as VaultRole;
    const perms = BASE_PERMISSIONS[role] ?? BASE_PERMISSIONS['DEVELOPER'];

    // If a project-level visibility grant is passed, merge it
    const canSeeAllCredentials =
        perms.canSeeAllCredentials || projectOverride?.scope === 'all';

    return {
        ...perms,
        canSeeAllCredentials,
        canInviteMembers: perms.canManageTeam,

        /**
         * canSeeCredential(addedByUserId)
         * Returns true if the user can view a specific credential.
         * Creator always sees their own; execs/sysadmin see all.
         */
        canSeeCredential: (addedByUserId: string) =>
            canSeeAllCredentials || addedByUserId === user._id,
    };
}
