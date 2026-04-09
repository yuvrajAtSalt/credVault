import { Types } from 'mongoose';
import { ProjectModel } from './project.schema';
import { CredentialModel } from '../credential/credential.schema';
import { AuditLogModel } from '../audit/audit.schema';
import { writeAuditLog } from '../audit/audit.repo';
import { getRoleTier } from '../utils/hierarchy';
import { resolvePermissionsSync } from '../utils/permissions';
import { BASE_PERMISSIONS } from '../utils/constants';

export const handover = async (projectId: string, newManagerId: string, currentUser: any) => {
    const project = await ProjectModel.findById(projectId);
    if (!project) throw { statusCode: 404, message: 'PROJECT NOT FOUND' };

    const actorTier = getRoleTier(currentUser.role, resolvePermissionsSync(currentUser));
    const isCurrentCreator = String((project as any).createdBy) === String(currentUser._id);
    
    // Only sysadmin, C-suite, or current creator (manager) can handover
    if (actorTier > 1 && !isCurrentCreator) throw { statusCode: 403, message: 'FORBIDDEN' };

    // 1. Remove outgoing creator from members or change to observer
    await ProjectModel.updateOne(
        { _id: projectId, 'members.userId': currentUser._id },
        { $set: { 'members.$.memberType': 'observer' } }
    );

    // 2. Add new manager if not exists, else ensure contributor
    const isNewExists = project.members.some(m => String(m.userId) === newManagerId);
    if (!isNewExists) {
        await ProjectModel.updateOne(
            { _id: projectId },
            { $push: { members: { userId: newManagerId, addedBy: currentUser._id, addedAt: new Date(), memberType: 'contributor' } } }
        );
    }

    // 3. Update createdBy
    await ProjectModel.updateOne({ _id: projectId }, { $set: { createdBy: newManagerId } });

    await writeAuditLog({
        actorId: String(currentUser._id),
        action: 'project.handover',
        targetType: 'Project',
        targetId: projectId,
        organisationId: String(currentUser.organisationId),
        meta: { newManagerId },
    });

    return { statusCode: 200, message: 'PROJECT HANDOVER SUCCESSFUL' };
};

export const revokeResidualAccess = async (projectId: string, userId: string, currentUser: any) => {
    const project = await ProjectModel.findById(projectId);
    if (!project) throw { statusCode: 404, message: 'PROJECT NOT FOUND' };

    const actorTier = getRoleTier(currentUser.role, resolvePermissionsSync(currentUser));
    const isManager = String((project as any).createdBy) === String(currentUser._id);
    if (actorTier > 1 && !isManager) throw { statusCode: 403, message: 'FORBIDDEN' };

    const updated = await ProjectModel.findByIdAndUpdate(projectId, {
        $pull: { visibilityGrants: { grantedTo: userId } }
    }, { new: true });

    await writeAuditLog({
        actorId: String(currentUser._id),
        action: 'visibility.residual_revoked',
        targetType: 'User',
        targetId: userId,
        organisationId: String(currentUser.organisationId),
        meta: { projectId },
    });

    return { statusCode: 200, message: 'RESIDUAL ACCESS REVOKED', data: updated };
};

export const updateMember = async (projectId: string, userId: string, body: { memberType?: 'contributor' | 'observer'; projectRole?: string }, currentUser: any) => {
    const project = await ProjectModel.findById(projectId);
    if (!project) throw { statusCode: 404, message: 'PROJECT NOT FOUND' };

    const isPrivileged = ['SYSADMIN', 'MANAGER'].includes(currentUser.role) || String((project as any).createdBy) === String(currentUser._id);
    if (!isPrivileged) throw { statusCode: 403, message: 'FORBIDDEN' };

    const updateMap: any = {};
    if (body.memberType !== undefined) updateMap['members.$.memberType'] = body.memberType;
    if (body.projectRole !== undefined) updateMap['members.$.projectRole'] = body.projectRole === '' ? null : body.projectRole;

    const updated = await ProjectModel.findOneAndUpdate(
        { _id: projectId, 'members.userId': userId },
        { $set: updateMap },
        { new: true }
    );

    await writeAuditLog({
        actorId: String(currentUser._id),
        action: 'member.type_changed',
        targetType: 'User',
        targetId: userId,
        organisationId: String(currentUser.organisationId),
        meta: { projectId, updates: body },
    });

    return { statusCode: 200, message: 'MEMBER UPDATED', data: updated };
};

export const addCustomCategory = async (projectId: string, body: { name: string; icon?: string; slug: string }, currentUser: any) => {
    const project = await ProjectModel.findById(projectId);
    if (!project) throw { statusCode: 404, message: 'PROJECT NOT FOUND' };

    const isManager = String((project as any).createdBy) === String(currentUser._id);
    const perms = BASE_PERMISSIONS[currentUser.role as keyof typeof BASE_PERMISSIONS];
    if (!isManager && !perms.isGod) throw { statusCode: 403, message: 'FORBIDDEN' };

    const updated = await ProjectModel.findByIdAndUpdate(
        projectId,
        { $push: { credentialCategories: body } },
        { new: true }
    );

    await writeAuditLog({
        actorId: String(currentUser._id),
        action: 'credential.category_added',
        targetType: 'Project',
        targetId: projectId,
        organisationId: String(currentUser.organisationId),
        meta: body,
    });

    return { statusCode: 200, message: 'CATEGORY ADDED', data: updated };
};

export const reactivate = async (projectId: string, currentUser: any) => {
    const actorTier = getRoleTier(currentUser.role, resolvePermissionsSync(currentUser));
    if (actorTier > 1) throw { statusCode: 403, message: 'Only Sysadmin or C-Suite can reactivate' };

    const updated = await ProjectModel.findByIdAndUpdate(projectId, { status: 'active' }, { new: true });
    if (!updated) throw { statusCode: 404, message: 'PROJECT NOT FOUND' };

    await writeAuditLog({
        actorId: String(currentUser._id),
        action: 'project.reactivated',
        targetType: 'Project',
        targetId: projectId,
        organisationId: String(currentUser.organisationId),
    });

    return { statusCode: 200, message: 'PROJECT REACTIVATED', data: updated };
};

export const getCredentialHistory = async (projectId: string, credId: string, currentUser: any) => {
    const cred = await CredentialModel.findById(credId);
    if (!cred || String(cred.projectId) !== projectId) throw { statusCode: 404, message: 'CREDENTIAL NOT FOUND' };

    // Find all audits where targetType = 'Credential' and targetId = credId
    const history = await AuditLogModel.find({ targetType: 'Credential', targetId: credId })
        .populate('actorId', 'name email avatarUrl role')
        .sort({ createdAt: -1 })
        .lean();

    return { statusCode: 200, message: 'HISTORY FETCHED', data: history };
};

export const getMemberProjects = async (userId: string, currentUser: any) => {
    // Sysadmins and C-Suite, or the user themselves
    const actorTier = getRoleTier(currentUser.role, resolvePermissionsSync(currentUser));
    if (actorTier > 1 && String(currentUser._id) !== userId) throw { statusCode: 403, message: 'FORBIDDEN' };

    // Find projects where user is active member OR has visibility grant
    const projects = await ProjectModel.find({
        $or: [
            { 'members.userId': userId },
            { 'visibilityGrants.grantedTo': userId }
        ]
    }).lean();

    const formatted = projects.map(p => {
        const isActive = p.members.some((m: any) => String(m.userId) === userId);
        const hasGrant = p.visibilityGrants.some((g: any) => String(g.grantedTo) === userId);
        
        return {
            _id: p._id,
            name: p.name,
            color: p.color,
            status: p.status,
            membershipStatus: isActive ? 'active' : (hasGrant ? 'removed_residual' : 'removed_clean'),
            projectRole: isActive ? p.members.find((m: any) => String(m.userId) === userId)?.projectRole : null,
            memberType: isActive ? p.members.find((m: any) => String(m.userId) === userId)?.memberType : null,
        };
    });

    return { statusCode: 200, message: 'MEMBER PROJECTS FETCHED', data: formatted };
};

export default {
    handover, revokeResidualAccess, updateMember, addCustomCategory, reactivate, getCredentialHistory, getMemberProjects
};
