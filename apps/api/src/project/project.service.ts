import { Types } from 'mongoose';
import projectRepo from './project.repo';
import userRepo from '../user/user.repo';
import credentialRepo from '../credential/credential.repo';
import { writeAuditLog } from '../audit/audit.repo';
import { EXECUTIVE_ROLES, ADMIN_ROLES } from '../utils/constants';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GLOBAL_VIEWER_ROLES = [...EXECUTIVE_ROLES, ...ADMIN_ROLES];

function canSeeAllProjects(role: string) {
    return GLOBAL_VIEWER_ROLES.includes(role as any);
}

// ─── list ─────────────────────────────────────────────────────────────────────
export const list = async (currentUser: any) => {
    const { _id, role, organisationId } = currentUser;
    const projects = canSeeAllProjects(role)
        ? await projectRepo.findAllByOrg(String(organisationId))
        : await projectRepo.findByMember(String(organisationId), String(_id));

    // Attach credential count per project
    const enriched = await Promise.all(
        (projects as any[]).map(async (p) => ({
            ...p,
            credentialCount: await credentialRepo.countByProject(String(p._id)),
        })),
    );

    return { statusCode: 200, message: 'PROJECTS FETCHED', data: enriched };
};

// ─── create ───────────────────────────────────────────────────────────────────
export const create = async (
    body: { name: string; description?: string; color?: string; tags?: string[]; status?: 'active' | 'archived' | 'planning' },
    currentUser: any,
) => {
    const { _id, organisationId } = currentUser;
    const userId = new Types.ObjectId(String(_id));

    const project = await projectRepo.create({
        organisationId: String(organisationId),
        name: body.name,
        description: body.description,
        color: body.color || '#0052CC',
        tags: body.tags || [],
        status: body.status || 'active',
        createdBy: String(_id),
        members: [{ userId, addedBy: userId, addedAt: new Date() }],
    }) as any;

    await writeAuditLog({
        actorId: String(_id),
        action: 'project.create',
        targetType: 'Project',
        targetId: String(project._id),
        organisationId: String(organisationId),
        meta: { name: body.name },
    });

    return { statusCode: 201, message: 'PROJECT CREATED', data: project };
};

// ─── getById ──────────────────────────────────────────────────────────────────
export const getById = async (projectId: string, currentUser: any) => {
    const project = await projectRepo.findById(projectId);
    if (!project) throw { statusCode: 404, message: 'PROJECT NOT FOUND' };

    // Access check: global viewers or members
    if (!canSeeAllProjects(currentUser.role)) {
        const isMember = await projectRepo.isMember(projectId, String(currentUser._id));
        if (!isMember) throw { statusCode: 403, message: 'FORBIDDEN' };
    }

    return { statusCode: 200, message: 'PROJECT FETCHED', data: project };
};

// ─── update ───────────────────────────────────────────────────────────────────
export const update = async (
    projectId: string,
    body: Partial<{ name: string; description: string; color: string; tags: string[]; status: 'active' | 'archived' | 'planning' }>,
    currentUser: any,
) => {
    const project = await projectRepo.findById(projectId);
    if (!project) throw { statusCode: 404, message: 'PROJECT NOT FOUND' };

    const isCreator = String((project as any).createdBy?._id || project.createdBy) === String(currentUser._id);
    const isPrivileged = ['SYSADMIN', 'MANAGER'].includes(currentUser.role);
    if (!isCreator && !isPrivileged) throw { statusCode: 403, message: 'FORBIDDEN' };

    const updated = await projectRepo.update(projectId, body);
    return { statusCode: 200, message: 'PROJECT UPDATED', data: updated };
};

// ─── archive ──────────────────────────────────────────────────────────────────
export const archive = async (projectId: string, currentUser: any) => {
    if (currentUser.role !== 'SYSADMIN') throw { statusCode: 403, message: 'SYSADMIN ONLY' };
    const updated = await projectRepo.archive(projectId);
    if (!updated) throw { statusCode: 404, message: 'PROJECT NOT FOUND' };
    return { statusCode: 200, message: 'PROJECT ARCHIVED', data: updated };
};

// ─── addMember ────────────────────────────────────────────────────────────────
export const addMember = async (projectId: string, body: { userId: string }, currentUser: any) => {
    const project = await projectRepo.findById(projectId);
    if (!project) throw { statusCode: 404, message: 'PROJECT NOT FOUND' };

    const isPrivileged = ['SYSADMIN', 'MANAGER'].includes(currentUser.role);
    const isCreator = String((project as any).createdBy?._id || project.createdBy) === String(currentUser._id);
    if (!isPrivileged && !isCreator) throw { statusCode: 403, message: 'FORBIDDEN' };

    const targetUser = await userRepo.findUserById(body.userId);
    if (!targetUser) throw { statusCode: 404, message: 'USER NOT FOUND' };

    const alreadyMember = (project.members as any[]).some(
        (m: any) => String(m.userId?._id || m.userId) === body.userId,
    );
    if (alreadyMember) throw { statusCode: 409, message: 'USER ALREADY A MEMBER' };

    const updated = await projectRepo.addMember(projectId, body.userId, String(currentUser._id));

    await writeAuditLog({
        actorId: String(currentUser._id),
        action: 'member.invite',
        targetType: 'User',
        targetId: body.userId,
        organisationId: String(currentUser.organisationId),
        meta: { projectId, projectName: (project as any).name },
    });

    return { statusCode: 200, message: 'MEMBER ADDED', data: updated };
};

// ─── removeMember ─────────────────────────────────────────────────────────────
export const removeMember = async (projectId: string, userId: string, currentUser: any) => {
    const project = await projectRepo.findById(projectId);
    if (!project) throw { statusCode: 404, message: 'PROJECT NOT FOUND' };

    const isPrivileged = ['SYSADMIN', 'MANAGER'].includes(currentUser.role);
    const isCreator = String((project as any).createdBy?._id || project.createdBy) === String(currentUser._id);
    if (!isPrivileged && !isCreator) throw { statusCode: 403, message: 'FORBIDDEN' };

    const updated = await projectRepo.removeMember(projectId, userId);

    await writeAuditLog({
        actorId: String(currentUser._id),
        action: 'member.remove',
        targetType: 'User',
        targetId: userId,
        organisationId: String(currentUser.organisationId),
        meta: { projectId },
    });

    return { statusCode: 200, message: 'MEMBER REMOVED', data: updated };
};

export default { list, create, getById, update, archive, addMember, removeMember };
