import userRepo from '../user/user.repo';
import projectRepo from '../project/project.repo';
import { writeAuditLog } from '../audit/audit.repo';
import { BASE_PERMISSIONS, EXECUTIVE_ROLES, ADMIN_ROLES } from '../utils/constants';
import type { VaultRole } from '../utils/constants';

const GLOBAL_VIEWER_ROLES = [...EXECUTIVE_ROLES, ...ADMIN_ROLES, 'MANAGER'];

function canSeeAllMembers(role: string) {
    return GLOBAL_VIEWER_ROLES.includes(role);
}

// ─── list ─────────────────────────────────────────────────────────────────────
export const list = async (
    currentUser: any,
    query: { role?: string; search?: string; department?: string },
) => {
    let users: any[];

    if (canSeeAllMembers(currentUser.role)) {
        // Privileged roles see everyone in the org
        users = await userRepo.findAllUsersByOrg(String(currentUser.organisationId)) as any[];
    } else {
        // Others see only co-members on shared projects
        const projects = await projectRepo.findByMember(
            String(currentUser.organisationId),
            String(currentUser._id),
        );
        const memberIdSet = new Set<string>();
        memberIdSet.add(String(currentUser._id));
        for (const p of projects as any[]) {
            for (const m of p.members ?? []) {
                memberIdSet.add(String(m.userId?._id ?? m.userId));
            }
        }
        const allUsers = await userRepo.findAllUsersByOrg(String(currentUser.organisationId)) as any[];
        users = allUsers.filter((u: any) => memberIdSet.has(String(u._id)));
    }

    // Filters
    if (query.role) {
        users = users.filter((u: any) => String(u.role).toUpperCase() === String(query.role).toUpperCase());
    }
    if (query.department) {
        users = users.filter((u: any) => (u.department ?? '').toLowerCase().includes(query.department!.toLowerCase()));
    }
    if (query.search) {
        const q = query.search.toLowerCase();
        users = users.filter((u: any) =>
            u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
        );
    }

    // Attach projectCount per user
    const enriched = await Promise.all(
        users.map(async (u: any) => {
            const projects = await projectRepo.findByMember(String(currentUser.organisationId), String(u._id));
            const plain = u.toObject ? u.toObject() : u;
            return { ...plain, projectCount: (projects as any[]).length };
        }),
    );

    return { statusCode: 200, message: 'MEMBERS FETCHED', data: enriched };
};

// ─── getById ──────────────────────────────────────────────────────────────────
export const getById = async (memberId: string, currentUser: any) => {
    const user = await userRepo.findUserById(memberId) as any;
    if (!user) throw { statusCode: 404, message: 'USER NOT FOUND' };

    const projects = await projectRepo.findByMember(String(currentUser.organisationId), memberId);
    return { statusCode: 200, message: 'MEMBER FETCHED', data: { ...user.toObject?.() ?? user, projectCount: (projects as any[]).length, projects } };
};

// ─── update ───────────────────────────────────────────────────────────────────
export const update = async (memberId: string, body: any, currentUser: any) => {
    const isSysadmin = currentUser.role === 'SYSADMIN';
    const isSelf = String(memberId) === String(currentUser._id);

    if (!isSysadmin && !isSelf) throw { statusCode: 403, message: 'FORBIDDEN' };

    // Self can only update safe fields
    const allowedSelfFields = ['jobTitle', 'department', 'avatarUrl'];
    const patch: Record<string, any> = {};
    if (isSysadmin) {
        Object.assign(patch, body);
    } else {
        for (const key of allowedSelfFields) {
            if (body[key] !== undefined) patch[key] = body[key];
        }
    }

    // Role change: sysadmin only, write audit
    if (patch.role && patch.role !== (await userRepo.findUserById(memberId) as any)?.role) {
        if (!isSysadmin) throw { statusCode: 403, message: 'ONLY SYSADMIN CAN CHANGE ROLES' };
        await writeAuditLog({
            actorId: String(currentUser._id),
            action: 'member.invite', // reuse closest action; would be 'role.change' in a real system
            targetType: 'User',
            targetId: memberId,
            organisationId: String(currentUser.organisationId),
            meta: { newRole: patch.role },
        });
    }

    const updated = await userRepo.updateUser(memberId, patch);
    return { statusCode: 200, message: 'MEMBER UPDATED', data: updated };
};

// ─── deactivate ───────────────────────────────────────────────────────────────
export const deactivate = async (memberId: string, currentUser: any) => {
    if (currentUser.role !== 'SYSADMIN') throw { statusCode: 403, message: 'SYSADMIN ONLY' };
    const updated = await userRepo.updateUser(memberId, { isActive: false } as any);
    if (!updated) throw { statusCode: 404, message: 'USER NOT FOUND' };
    return { statusCode: 200, message: 'MEMBER DEACTIVATED', data: updated };
};

// ─── orgChart ─────────────────────────────────────────────────────────────────
export const orgChart = async (currentUser: any) => {
    const users = await userRepo.findAllUsersByOrg(String(currentUser.organisationId)) as any[];

    // Build map
    const map = new Map<string, any>();
    for (const u of users) {
        const plain = u.toObject ? u.toObject() : u;
        map.set(String(plain._id), { ...plain, children: [] });
    }

    const roots: any[] = [];
    for (const u of users) {
        const reportingTo = u.reportingTo ? String(u.reportingTo?._id ?? u.reportingTo) : null;
        if (!reportingTo || !map.has(reportingTo)) {
            roots.push(map.get(String(u._id)));
        } else {
            map.get(reportingTo)?.children.push(map.get(String(u._id)));
        }
    }

    return { statusCode: 200, message: 'ORG CHART FETCHED', data: { tree: roots } };
};

export default { list, getById, update, deactivate, orgChart };
