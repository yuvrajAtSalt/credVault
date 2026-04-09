import { Types } from 'mongoose';
import credentialRepo from './credential.repo';
import projectRepo from '../project/project.repo';
import { writeAuditLog } from '../audit/audit.repo';
import { BASE_PERMISSIONS } from '../utils/constants';
import { encrypt, decrypt } from '../utils/crypto';
import type { VaultRole } from '../utils/constants';

// ─── Visibility helper ────────────────────────────────────────────────────────

type VisibilityScope = 'all' | 'own' | 'none';

function resolveScope(project: any, currentUser: any): VisibilityScope {
    const role = currentUser.role as VaultRole;
    const perms = BASE_PERMISSIONS[role];

    // God (sysadmin)
    if (perms.isGod) return 'all';
    // Executives (CEO/COO/CFO) — see all credentials
    if (perms.canSeeAllCredentials) return 'all';

    // Check if project manager or creator
    const isManager = role === 'MANAGER';
    const isCreator = String(project?.createdBy?._id ?? project?.createdBy) === String(currentUser._id);
    if (isManager && isCreator) return 'all';

    // Check explicit visibility grant on project
    const grant = (project?.visibilityGrants ?? []).find(
        (g: any) => String(g.grantedTo) === String(currentUser._id),
    );
    if (grant?.scope === 'all') return 'all';

    return 'own';
}

// ─── list ─────────────────────────────────────────────────────────────────────
export const list = async (projectId: string, currentUser: any) => {
    const project = await projectRepo.findById(projectId);
    if (!project) throw { statusCode: 404, message: 'PROJECT NOT FOUND' };

    // Access check: must be a member or global viewer
    const perms = BASE_PERMISSIONS[currentUser.role as VaultRole];
    if (!perms.isGod && !perms.canSeeAllCredentials) {
        const isMember = await projectRepo.isMember(projectId, String(currentUser._id));
        if (!isMember) throw { statusCode: 403, message: 'FORBIDDEN' };
    }

    const scope = resolveScope(project, currentUser);

    const [allCreds, ownCreds] = await Promise.all([
        credentialRepo.findByProject(projectId),
        scope === 'own' ? credentialRepo.findOwnByProject(projectId, String(currentUser._id)) : null,
    ]);

    const visibleCreds = scope === 'all' ? allCreds : ownCreds!;
    const hiddenCount = scope === 'own' ? allCreds.length - visibleCreds.length : 0;

    // Mask values in list response
    const masked = visibleCreds.map((c: any) => ({
        ...c,
        value: '[MASKED]',
    }));

    await writeAuditLog({
        actorId: String(currentUser._id),
        action: 'credential.view',
        targetType: 'Project',
        targetId: projectId,
        organisationId: String(currentUser.organisationId),
        meta: { count: visibleCreds.length },
    });

    return { statusCode: 200, message: 'CREDENTIALS FETCHED', data: { credentials: masked, hiddenCount } };
};

// ─── reveal ───────────────────────────────────────────────────────────────────
export const reveal = async (projectId: string, credId: string, currentUser: any) => {
    const cred = await credentialRepo.findById(credId);
    if (!cred || cred.projectId.toString() !== projectId) throw { statusCode: 404, message: 'CREDENTIAL NOT FOUND' };

    const project = await projectRepo.findById(projectId);
    const scope = resolveScope(project, currentUser);

    const isOwner = String((cred.addedBy as any)?._id ?? cred.addedBy) === String(currentUser._id);
    if (scope !== 'all' && !isOwner) throw { statusCode: 403, message: 'FORBIDDEN' };

    await writeAuditLog({
        actorId: String(currentUser._id),
        action: 'credential.view',
        targetType: 'Credential',
        targetId: credId,
        organisationId: String(currentUser.organisationId),
        meta: { label: (cred as any).label },
    });

    // Decrypt the value before returning
    let plainValue: string;
    try {
        plainValue = decrypt((cred as any).value);
    } catch {
        // Fallback: return raw value if not encrypted (migration period)
        plainValue = (cred as any).value;
    }

    return { statusCode: 200, message: 'CREDENTIAL REVEALED', data: { value: plainValue } };
};

// ─── create ───────────────────────────────────────────────────────────────────
export const create = async (
    projectId: string,
    body: { category: string; label: string; value: string; isSecret?: boolean; environment?: string },
    currentUser: any,
) => {
    const project = await projectRepo.findById(projectId);
    if (!project) throw { statusCode: 404, message: 'PROJECT NOT FOUND' };

    const perms = BASE_PERMISSIONS[currentUser.role as VaultRole];
    if (!perms.isGod && !perms.canSeeAllCredentials) {
        const isMember = await projectRepo.isMember(projectId, String(currentUser._id));
        if (!isMember) throw { statusCode: 403, message: 'NOT A PROJECT MEMBER' };
    }

    const cred = await credentialRepo.create({
        projectId,
        organisationId: String(currentUser.organisationId),
        category: body.category,
        label: body.label,
        value: encrypt(body.value),  // AES-256-GCM encrypted at rest
        isSecret: body.isSecret ?? true,
        environment: body.environment ?? 'all',
        addedBy: String(currentUser._id),
        addedByRole: currentUser.role,
    });

    await writeAuditLog({
        actorId: String(currentUser._id),
        action: 'credential.create',
        targetType: 'Credential',
        targetId: String(cred._id),
        organisationId: String(currentUser.organisationId),
        meta: { label: body.label, category: body.category, projectId },
    });

    return { statusCode: 201, message: 'CREDENTIAL CREATED', data: cred };
};

// ─── update ───────────────────────────────────────────────────────────────────
export const update = async (
    projectId: string,
    credId: string,
    body: Partial<{ label: string; value: string; isSecret: boolean; environment: string }>,
    currentUser: any,
) => {
    const cred = await credentialRepo.findById(credId);
    if (!cred || cred.projectId.toString() !== projectId) throw { statusCode: 404, message: 'CREDENTIAL NOT FOUND' };

    const isOwner = String((cred.addedBy as any)?._id ?? cred.addedBy) === String(currentUser._id);
    const isPrivileged = ['SYSADMIN', 'MANAGER'].includes(currentUser.role);
    if (!isOwner && !isPrivileged) throw { statusCode: 403, message: 'FORBIDDEN' };

    const patch: Record<string, any> = {
        ...body,
        lastEditedBy: new Types.ObjectId(String(currentUser._id)),
        lastEditedAt: new Date(),
    };
    if (body.value) patch.value = encrypt(body.value); // Re-encrypt updated value

    const updated = await credentialRepo.update(credId, patch);

    return { statusCode: 200, message: 'CREDENTIAL UPDATED', data: updated };
};

// ─── softDelete ───────────────────────────────────────────────────────────────
export const softDelete = async (projectId: string, credId: string, currentUser: any) => {
    const cred = await credentialRepo.findById(credId);
    if (!cred || cred.projectId.toString() !== projectId) throw { statusCode: 404, message: 'CREDENTIAL NOT FOUND' };

    const isOwner = String((cred.addedBy as any)?._id ?? cred.addedBy) === String(currentUser._id);
    const isPrivileged = ['SYSADMIN', 'MANAGER'].includes(currentUser.role);
    if (!isOwner && !isPrivileged) throw { statusCode: 403, message: 'FORBIDDEN' };

    await credentialRepo.softDelete(credId);

    await writeAuditLog({
        actorId: String(currentUser._id),
        action: 'credential.delete',
        targetType: 'Credential',
        targetId: credId,
        organisationId: String(currentUser.organisationId),
        meta: { label: (cred as any).label, projectId },
    });

    return { statusCode: 200, message: 'CREDENTIAL DELETED', data: null };
};

// ─── listGrants ───────────────────────────────────────────────────────────────
export const listGrants = async (projectId: string, currentUser: any) => {
    const project = await projectRepo.findById(projectId) as any;
    if (!project) throw { statusCode: 404, message: 'PROJECT NOT FOUND' };

    const perms = BASE_PERMISSIONS[currentUser.role as VaultRole];
    const isPrivileged = perms.isGod || perms.canGrantVisibility || perms.canSeeAllCredentials;
    if (!isPrivileged) throw { statusCode: 403, message: 'FORBIDDEN' };

    return { statusCode: 200, message: 'GRANTS FETCHED', data: project.visibilityGrants ?? [] };
};

// ─── upsertGrant ────────────────────────────────────────────────────────────
export const upsertGrant = async (
    projectId: string,
    body: { userId: string; scope: 'all' | 'own' },
    currentUser: any,
) => {
    const project = await projectRepo.findById(projectId) as any;
    if (!project) throw { statusCode: 404, message: 'PROJECT NOT FOUND' };

    const perms = BASE_PERMISSIONS[currentUser.role as VaultRole];
    const isPrivileged = perms.isGod || perms.canGrantVisibility || perms.canSeeAllCredentials;
    if (!isPrivileged) throw { statusCode: 403, message: 'FORBIDDEN' };

    const { ProjectModel } = await import('../project/project.schema');
    const existingIdx = (project.visibilityGrants ?? []).findIndex(
        (g: any) => String(g.grantedTo) === body.userId,
    );

    let updated;
    if (existingIdx >= 0) {
        updated = await ProjectModel.findByIdAndUpdate(
            projectId,
            { $set: { [`visibilityGrants.${existingIdx}.scope`]: body.scope } },
            { new: true },
        ).lean();
    } else {
        updated = await ProjectModel.findByIdAndUpdate(
            projectId,
            {
                $push: {
                    visibilityGrants: {
                        grantedTo: new Types.ObjectId(body.userId),
                        grantedBy: new Types.ObjectId(String(currentUser._id)),
                        scope: body.scope,
                        grantedAt: new Date(),
                    },
                },
            },
            { new: true },
        ).lean();
    }

    await writeAuditLog({
        actorId: String(currentUser._id),
        action: body.scope === 'all' ? 'visibility.grant' : 'visibility.revoke',
        targetType: 'User',
        targetId: body.userId,
        organisationId: String(currentUser.organisationId),
        meta: { projectId, scope: body.scope },
    });

    return { statusCode: 200, message: 'GRANT UPDATED', data: updated };
};

export default { list, reveal, create, update, softDelete, listGrants, upsertGrant };
