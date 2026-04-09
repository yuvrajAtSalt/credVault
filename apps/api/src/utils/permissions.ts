import { BASE_PERMISSIONS, VaultRole } from './constants';
import type { IPermissionSet } from '../admin/custom-role.schema';

// ─── Effective permissions type (superset of BASE_PERMISSIONS) ───────────────
export interface EffectivePermissions extends IPermissionSet {
    // source maps for UI display (populated by the detail API, not required everywhere)
    _sources?: Record<string, 'role' | 'custom_role' | 'special_grant' | 'special_revoke'>;
}

// ─── Map BASE_PERMISSIONS to new IPermissionSet shape ────────────────────────
function baseRoleToPermissionSet(role: VaultRole): IPermissionSet {
    const b = BASE_PERMISSIONS[role];
    return {
        canSeeAllProjects:    b.canSeeAllProjects,
        canCreateProject:     b.canCreateProject,
        canAddCredential:     b.canAddCredential,
        canManageTeam:        b.canManageTeam,
        canGrantVisibility:   b.canGrantVisibility,
        canSeeAllCredentials: b.canSeeAllCredentials,
        canManageRoles:       b.canManageRoles,
        // New Phase 09 permissions — derive sensible defaults from existing flags
        canManageMembers:     b.isGod || b.canManageRoles,
        canViewAuditLog:      b.isGod || b.canManageRoles,
        canManageOrgSettings: b.isGod,
        isGod:                b.isGod,
    };
}

/**
 * Synchronous resolver — call after auth middleware has already fetched the user
 * and populated `customRoleId` (as an object, not just an ObjectId reference).
 *
 * Merging order:
 *   1. Base role permissions (from BUILT_IN constants)     — floor
 *   2. Custom role permissions (if user.customRoleId set)  — custom floor
 *   3. Special grants/revocations (individual overrides)   — ceiling
 */
export function resolvePermissionsSync(user: any): EffectivePermissions {
    // ── Step 1: start from built-in role ──────────────────────────────────────
    let effective: IPermissionSet;

    if (user.role === 'CUSTOM' && user.customRoleId?.permissions) {
        // Custom role — use its full permission set
        effective = { ...user.customRoleId.permissions };
    } else if (BASE_PERMISSIONS[user.role as VaultRole]) {
        effective = baseRoleToPermissionSet(user.role as VaultRole);
    } else {
        // Fallback: no permissions (unknown role)
        effective = {
            canSeeAllProjects: false, canCreateProject: false,
            canAddCredential: false, canManageTeam: false,
            canGrantVisibility: false, canSeeAllCredentials: false,
            canManageRoles: false, canManageMembers: false,
            canViewAuditLog: false, canManageOrgSettings: false,
            isGod: false,
        };
    }

    // ── Step 2: god mode = everything true ───────────────────────────────────
    if (effective.isGod) {
        const all = Object.fromEntries(
            Object.keys(effective).map((k) => [k, true]),
        ) as unknown as IPermissionSet;
        effective = all;
    }

    // ── Step 3: apply individual special permissions ──────────────────────────
    const now = new Date();
    for (const sp of user.specialPermissions ?? []) {
        if (!sp.isActive) continue;
        if (sp.expiresAt && new Date(sp.expiresAt) <= now) continue; // expired
        if (sp.permission in effective) {
            (effective as any)[sp.permission] = sp.value;
        }
    }

    return effective as EffectivePermissions;
}

/**
 * Expire all special permissions past their expiresAt date for a user document.
 * Mutates the specialPermissions array in-place and saves.
 * Returns the count of expired permissions.
 */
export async function expireStalePermissions(user: any): Promise<number> {
    const now = new Date();
    let count = 0;
    for (const sp of user.specialPermissions ?? []) {
        if (sp.isActive && sp.expiresAt && new Date(sp.expiresAt) <= now) {
            sp.isActive = false;
            count++;
        }
    }
    if (count > 0) await user.save();
    return count;
}
