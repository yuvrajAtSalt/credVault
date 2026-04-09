import { UserModel } from '../user/user.schema';
import { EffectivePermissions } from './permissions';
import { Types } from 'mongoose';

/**
 * Returns the numeric tier of a role for hierarchy comparisons.
 * 0 = Sysadmin (Top)
 * 1 = C-Suite
 * 2 = Department Heads (CMO)
 * 3 = Management
 * 4 = ICs (Dev, QA, DevOps)
 */
export function getRoleTier(role: string, permissions: EffectivePermissions): number {
    if (permissions.isGod) return 0;
    
    switch (role.toUpperCase()) {
        case 'SYSADMIN': return 0;
        case 'CEO':
        case 'COO':
        case 'CFO': return 1;
        case 'CMO': return 2;
        case 'MANAGER': return 3;
        case 'DEVOPS':
        case 'DEVELOPER':
        case 'QA': return 4;
        case 'CUSTOM':
            // Fallback heuristics for custom roles based on permissions
            if (permissions.canSeeAllProjects && permissions.canSeeAllCredentials) return 1; // Executive equivalent
            if (permissions.canManageTeam && permissions.canGrantVisibility) return 3;       // Manager equivalent
            return 4; // Default to IC
        default: return 4;
    }
}

/**
 * Checks if the actor is above the target in the reporting chain.
 * True if actor is target's immediate manager OR an ancestor manager.
 */
export async function isAboveInHierarchy(
    actorId: string | Types.ObjectId,
    targetId: string | Types.ObjectId,
): Promise<boolean> {
    if (String(actorId) === String(targetId)) return false;

    const visited = new Set<string>();
    let currentId = String(targetId);

    while (currentId) {
        if (visited.has(currentId)) break; // Prevent circular loop crashes
        visited.add(currentId);

        const current = await UserModel.findById(currentId).select('reportingTo').lean();
        if (!current || !current.reportingTo) return false;

        const managerId = String(current.reportingTo);
        if (managerId === String(actorId)) return true;
        
        currentId = managerId;
    }

    return false;
}

/**
 * Checks if a target user is in the actor's team (either same team or reporting).
 */
export async function isInManagersTeam(
    managerId: string | Types.ObjectId,
    targetId: string | Types.ObjectId,
): Promise<boolean> {
    const manager = await UserModel.findById(managerId).select('teamId').lean();
    if (!manager) return false;

    const target = await UserModel.findById(targetId).select('teamId reportingTo').lean();
    if (!target) return false;

    // Check 1: Target reports to Manager
    if (target.reportingTo && String(target.reportingTo) === String(managerId)) return true;

    // Check 2: Target is in the same team
    if (manager.teamId && target.teamId && String(manager.teamId) === String(target.teamId)) return true;

    // Check 3: Check full reporting chain just in case
    return await isAboveInHierarchy(managerId, targetId);
}

/**
 * Composite check for management authority.
 * To manage someone:
 * 1. Actor must be tier 0 or 1 (C-suite/Sysadmin)
 * 2. OR Actor must be manager tier (3) AND above them in hierarchy.
 */
export async function canManage(
    actorTier: number,
    actorId: string | Types.ObjectId,
    targetTier: number,
    targetId: string | Types.ObjectId,
): Promise<boolean> {
    // 1. Sysadmins / C-Suite can manage anyone EXCEPT sysadmins (unless they are also sysadmin)
    if (actorTier <= 1) {
        if (targetTier === 0 && actorTier !== 0) return false; // C-suite cannot manage sysadmin
        return true;
    }

    // 2. Managers can only manage those below them in the hierarchy
    if (actorTier === 3 && targetTier > 3) {
        return await isAboveInHierarchy(actorId, targetId);
    }

    // 3. ICs cannot manage anyone
    return false;
}
