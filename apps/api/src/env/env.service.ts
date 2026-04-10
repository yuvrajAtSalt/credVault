import { Types } from 'mongoose';
import { EnvironmentModel } from './environment.schema';
import { EnvVariableModel } from './envvariable.schema';
import { writeAuditLog } from '../audit/audit.repo';
import { encrypt, decrypt } from '../utils/crypto';
import { BASE_PERMISSIONS } from '../utils/constants';
import type { VaultRole } from '../utils/constants';

const KEY_REGEX = /^[A-Z][A-Z0-9_]*$/;

// ─── Visibility scope helper (mirrors credential.service) ────────────────────
function canSeeAll(currentUser: any): boolean {
    const perms = BASE_PERMISSIONS[currentUser.role as VaultRole];
    return perms.isGod || perms.canSeeAllCredentials;
}

// Helper to check archived
function assertNotArchived(project: any) {
    if (project.status === 'archived') {
        throw { statusCode: 403, message: 'This project is archived. No changes are permitted.', code: 'PROJECT_ARCHIVED' };
    }
}

// ─── Environments ─────────────────────────────────────────────────────────────

export const listEnvironments = async (projectId: string) => {
    const envs = await EnvironmentModel.find({ projectId }).sort({ createdAt: 1 }).lean();
    // Attach variableCount per environment
    const withCounts = await Promise.all(
        envs.map(async (env) => {
            const count = await EnvVariableModel.countDocuments({ environmentId: env._id, isDeleted: false });
            return { ...env, variableCount: count };
        }),
    );
    return { statusCode: 200, message: 'ENVIRONMENTS FETCHED', data: withCounts };
};

export const createEnvironment = async (
    projectId: string,
    body: { name: string; description?: string; color?: string; isBaseEnvironment?: boolean; cloneFromEnvId?: string },
    currentUser: any,
) => {
    const slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const existing = await EnvironmentModel.findOne({ projectId, slug });
    if (existing) throw { statusCode: 409, message: 'ENVIRONMENT WITH THIS NAME ALREADY EXISTS' };

    const env = await EnvironmentModel.create({
        projectId,
        organisationId: currentUser.organisationId,
        name: body.name,
        slug,
        description: body.description,
        color: body.color ?? '#0052CC',
        isBaseEnvironment: body.isBaseEnvironment ?? false,
        createdBy: currentUser._id,
    });

    await writeAuditLog({
        actorId: String(currentUser._id),
        action: 'environment.create',
        targetType: 'Environment',
        targetId: String(env._id),
        organisationId: String(currentUser.organisationId),
        meta: { name: body.name, projectId },
    });

    // Clone variables from another environment if requested
    if (body.cloneFromEnvId) {
        const sourceVars = await EnvVariableModel.find({
            environmentId: body.cloneFromEnvId,
            isDeleted: false,
        }).lean();

        if (sourceVars.length > 0) {
            await EnvVariableModel.insertMany(
                sourceVars.map((v) => ({
                    projectId,
                    environmentId: env._id,
                    organisationId: currentUser.organisationId,
                    key: v.key,
                    value: v.value, // already encrypted
                    isSecret: v.isSecret,
                    group: v.group,
                    inheritedFromEnvId: body.cloneFromEnvId,
                    isOverridden: false,
                    addedBy: currentUser._id,
                    addedByRole: currentUser.role,
                })),
            );

            await writeAuditLog({
                actorId: String(currentUser._id),
                action: 'environment.clone',
                targetType: 'Environment',
                targetId: String(env._id),
                organisationId: String(currentUser.organisationId),
                meta: { clonedFrom: body.cloneFromEnvId, varCount: sourceVars.length },
            });
        }
    }

    return { statusCode: 201, message: 'ENVIRONMENT CREATED', data: env };
};

export const updateEnvironment = async (envId: string, body: { name?: string; description?: string; color?: string; isBaseEnvironment?: boolean }) => {
    const patch: Record<string, any> = {};
    if (body.name !== undefined) {
        patch.name = body.name;
        patch.slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
    if (body.description !== undefined) patch.description = body.description;
    if (body.color       !== undefined) patch.color       = body.color;
    if (body.isBaseEnvironment !== undefined) patch.isBaseEnvironment = body.isBaseEnvironment;

    const env = await EnvironmentModel.findByIdAndUpdate(envId, { $set: patch }, { new: true }).lean();
    if (!env) throw { statusCode: 404, message: 'ENVIRONMENT NOT FOUND' };
    
    // Assert project is not archived (we assume caller checks project context or we just check if needed - let's fetch project)
    const projectRepo = (await import('../project/project.repo')).default;
    const project = await projectRepo.findById(env.projectId as string);
    if (project) assertNotArchived(project);

    return { statusCode: 200, message: 'ENVIRONMENT UPDATED', data: env };
};

export const deleteEnvironment = async (envId: string, projectId: string, currentUser: any) => {
    const env = await EnvironmentModel.findOneAndDelete({ _id: envId, projectId });
    if (!env) throw { statusCode: 404, message: 'ENVIRONMENT NOT FOUND' };

    const projectRepo = (await import('../project/project.repo')).default;
    const project = await projectRepo.findById(projectId);
    if (project) assertNotArchived(project);

    // Hard-delete all variables in this environment
    await EnvVariableModel.deleteMany({ environmentId: envId });

    await writeAuditLog({
        actorId: String(currentUser._id),
        action: 'environment.delete',
        targetType: 'Environment',
        targetId: envId,
        organisationId: String(currentUser.organisationId),
        meta: { name: env.name, projectId },
    });

    return { statusCode: 200, message: 'ENVIRONMENT DELETED', data: null };
};

// ─── Variables ────────────────────────────────────────────────────────────────

export const listVariables = async (projectId: string, envId: string, currentUser: any) => {
    const env = await EnvironmentModel.findOne({ _id: envId, projectId }).lean();
    if (!env) throw { statusCode: 404, message: 'ENVIRONMENT NOT FOUND' };

    const seeAll = canSeeAll(currentUser);
    const filter: Record<string, any> = { environmentId: envId, isDeleted: false };
    if (!seeAll) filter.addedBy = new Types.ObjectId(String(currentUser._id));

    const allVars = await EnvVariableModel.find({ environmentId: envId, isDeleted: false })
        .populate('addedBy', 'name email role')
        .lean();
    const visibleVars = seeAll
        ? allVars
        : allVars.filter((v) => String((v.addedBy as any)?._id ?? v.addedBy) === String(currentUser._id));

    const hiddenCount = allVars.length - visibleVars.length;

    // Group by group field
    const groupMap = new Map<string, typeof visibleVars>();
    for (const v of visibleVars) {
        const g = v.group || 'General';
        if (!groupMap.has(g)) groupMap.set(g, []);
        groupMap.get(g)!.push({ ...v, value: '[ENCRYPTED]' });
    }

    const groups = Array.from(groupMap.entries()).map(([name, variables]) => ({ name, variables }));

    return { statusCode: 200, message: 'VARIABLES FETCHED', data: { environment: env, groups, hiddenCount } };
};

export const revealVariable = async (projectId: string, envId: string, varId: string, currentUser: any, reason?: string) => {
    const v = await EnvVariableModel.findOne({ _id: varId, environmentId: envId, isDeleted: false }).lean();
    if (!v) throw { statusCode: 404, message: 'VARIABLE NOT FOUND' };

    const seeAll = canSeeAll(currentUser);
    const isOwner = String((v.addedBy as any)?._id ?? v.addedBy) === String(currentUser._id);
    if (!seeAll && !isOwner) throw { statusCode: 403, message: 'FORBIDDEN' };

    // Phase 10: Log reason for critical
    if (v.sensitivityLevel === 'critical') {
        if (!reason && !isOwner) throw { statusCode: 400, message: 'Reason required to reveal critical environment variables' };
        if (reason) {
            // Need to just log it to AuditLog as EnvVariable doesn't have revealReasons array yet
            await writeAuditLog({
                actorId: String(currentUser._id),
                action: 'envvar.reveal',
                targetType: 'EnvVariable',
                targetId: varId,
                organisationId: String(currentUser.organisationId),
                meta: { key: v.key, envId, reason, critical: true },
            });
        }
    } else {
        await writeAuditLog({
            actorId: String(currentUser._id),
            action: 'envvar.reveal',
            targetType: 'EnvVariable',
            targetId: varId,
            organisationId: String(currentUser.organisationId),
            meta: { key: v.key, envId },
        });
    }

    let plain: string;
    try { plain = decrypt(v.value); } catch { plain = v.value; }

    return { statusCode: 200, message: 'VARIABLE REVEALED', data: { key: v.key, value: plain } };
};

export const createVariable = async (
    projectId: string,
    envId: string,
    body: { key: string; value: string; isSecret?: boolean; group?: string; expiresAt?: string; sensitivityLevel?: string },
    currentUser: any,
) => {
    const projectRepo = (await import('../project/project.repo')).default;
    const project = await projectRepo.findById(projectId);
    if (project) assertNotArchived(project);

    // Phase 10: only Managers, DevOps, Sysadmin can add 'critical' credentials
    if (body.sensitivityLevel === 'critical') {
        const role = currentUser.role as VaultRole;
        if (!['MANAGER', 'DEVOPS', 'SYSADMIN'].includes(role)) {
            throw { statusCode: 403, message: 'Only Managers, DevOps, or Sysadmins can add critical variables' };
        }
    }

    if (!KEY_REGEX.test(body.key)) throw { statusCode: 400, message: 'KEY must match ^[A-Z][A-Z0-9_]*$' };

    const exists = await EnvVariableModel.findOne({ environmentId: envId, key: body.key, isDeleted: false });
    if (exists) throw { statusCode: 409, message: `KEY "${body.key}" already exists in this environment` };

    const v = await EnvVariableModel.create({
        projectId,
        environmentId: envId,
        organisationId: currentUser.organisationId,
        key: body.key,
        value: encrypt(body.value),
        isSecret: body.isSecret ?? true,
        group: body.group ?? 'General',
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
        sensitivityLevel: body.sensitivityLevel ?? 'normal',
        addedBy: currentUser._id,
        addedByRole: currentUser.role,
    });

    await writeAuditLog({
        actorId: String(currentUser._id),
        action: 'envvar.create',
        targetType: 'EnvVariable',
        targetId: String(v._id),
        organisationId: String(currentUser.organisationId),
        meta: { key: body.key, envId, projectId },
    });

    return { statusCode: 201, message: 'VARIABLE CREATED', data: v };
};

export const updateVariable = async (
    varId: string,
    envId: string,
    body: { value?: string; isSecret?: boolean; group?: string; expiresAt?: string; sensitivityLevel?: string },
    currentUser: any,
) => {
    const v = await EnvVariableModel.findOne({ _id: varId, environmentId: envId, isDeleted: false });
    if (!v) throw { statusCode: 404, message: 'VARIABLE NOT FOUND' };

    const projectRepo = (await import('../project/project.repo')).default;
    const project = await projectRepo.findById(String(v.projectId));
    if (project) {
        assertNotArchived(project);
        const isProjectManager = currentUser.role === 'MANAGER' && (project as any).members.some((m: any) => String(m.userId) === String(currentUser._id));
        const isSysadmin = currentUser.role === 'SYSADMIN';
        const isOwner = String(v.addedBy) === String(currentUser._id);
        if (!isOwner && !isProjectManager && !isSysadmin) throw { statusCode: 403, message: 'FORBIDDEN' };
    }

    if (body.value    !== undefined) v.value    = encrypt(body.value);
    if (body.isSecret !== undefined) v.isSecret = body.isSecret;
    if (body.group    !== undefined) v.group    = body.group;
    if (body.expiresAt!== undefined) v.expiresAt= body.expiresAt ? new Date(body.expiresAt) : undefined;
    if (body.sensitivityLevel !== undefined) v.sensitivityLevel = body.sensitivityLevel;
    v.lastEditedBy = new Types.ObjectId(String(currentUser._id)) as any;
    v.lastEditedAt = new Date();
    await v.save();

    await writeAuditLog({
        actorId: String(currentUser._id),
        action: 'envvar.edit',
        targetType: 'EnvVariable',
        targetId: varId,
        organisationId: String(currentUser.organisationId),
        meta: { key: v.key, envId },
    });

    return { statusCode: 200, message: 'VARIABLE UPDATED', data: v };
};

export const deleteVariable = async (varId: string, envId: string, currentUser: any) => {
    const v = await EnvVariableModel.findOne({ _id: varId, environmentId: envId, isDeleted: false });
    if (!v) throw { statusCode: 404, message: 'VARIABLE NOT FOUND' };

    const projectRepo = (await import('../project/project.repo')).default;
    const project = await projectRepo.findById(String(v.projectId));
    if (project) {
        assertNotArchived(project);
        const isProjectManager = currentUser.role === 'MANAGER' && (project as any).members.some((m: any) => String(m.userId) === String(currentUser._id));
        const isSysadmin = currentUser.role === 'SYSADMIN';
        const isOwner = String(v.addedBy) === String(currentUser._id);
        if (!isOwner && !isProjectManager && !isSysadmin) throw { statusCode: 403, message: 'FORBIDDEN' };
    }

    v.isDeleted = true;
    await v.save();

    await writeAuditLog({
        actorId: String(currentUser._id),
        action: 'envvar.delete',
        targetType: 'EnvVariable',
        targetId: varId,
        organisationId: String(currentUser.organisationId),
        meta: { key: v.key, envId },
    });

    return { statusCode: 200, message: 'VARIABLE DELETED', data: null };
};

export const bulkUpsert = async (
    projectId: string,
    envId: string,
    body: { variables: { key: string; value: string; isSecret?: boolean; group?: string }[]; overwriteExisting: boolean },
    currentUser: any,
) => {
    let inserted = 0; let updated = 0; let skipped = 0;
    const errors: string[] = [];

    for (const item of body.variables) {
        if (!KEY_REGEX.test(item.key)) { errors.push(`${item.key}: invalid key format`); continue; }

        const existing = await EnvVariableModel.findOne({ environmentId: envId, key: item.key, isDeleted: false });
        if (existing) {
            if (!body.overwriteExisting) { skipped++; continue; }
            existing.value = encrypt(item.value);
            if (item.isSecret !== undefined) existing.isSecret = item.isSecret;
            if (item.group)    existing.group = item.group;
            existing.lastEditedBy = new Types.ObjectId(String(currentUser._id)) as any;
            existing.lastEditedAt = new Date();
            await existing.save();
            updated++;
        } else {
            await EnvVariableModel.create({
                projectId, environmentId: envId,
                organisationId: currentUser.organisationId,
                key: item.key, value: encrypt(item.value),
                isSecret: item.isSecret ?? true,
                group: item.group ?? 'General',
                addedBy: currentUser._id,
                addedByRole: currentUser.role,
            });
            inserted++;
        }
    }

    return { statusCode: 200, message: 'BULK UPSERT COMPLETE', data: { inserted, updated, skipped, errors } };
};

// ─── Export ───────────────────────────────────────────────────────────────────

// ─── Export ───────────────────────────────────────────────────────────────────

export const exportEnvironment = async (projectId: string, envId: string, format: string, currentUser: any, reason?: string) => {
    const { OrganisationModel } = await import('../organisation/organisation.schema');
    const { AuditLogModel } = await import('../audit/audit.schema');

    const org = await OrganisationModel.findById(currentUser.organisationId).lean() as any;
    const policy = org?.credentialSharingPolicy;

    if (policy) {
        // 1. Format check
        if (format === 'dotenv' && policy.allowEnvFileExport === false) {
            throw { statusCode: 403, message: 'Exporting as .env is disabled by your organisation policy.' };
        }

        // 2. Role check
        if (policy.allowedExportRoles?.length > 0 && !policy.allowedExportRoles.includes(currentUser.role)) {
            throw { statusCode: 403, message: 'Your role is not authorised to export credentials.' };
        }

        // 3. Justification check
        if (policy.requireExportJustification && !reason) {
            throw { statusCode: 400, message: 'A justification/reason is required for this export per organisation policy.' };
        }

        // 4. Daily limit check
        if (policy.maxExportsPerDayPerUser > 0) {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            
            const exportCount = await AuditLogModel.countDocuments({
                actorId: currentUser._id,
                action: 'envvar.export',
                createdAt: { $gte: startOfDay }
            });

            if (exportCount >= policy.maxExportsPerDayPerUser) {
                throw { statusCode: 429, message: `Daily export limit reached (${policy.maxExportsPerDayPerUser}). Please contact an administrator.` };
            }
        }
    }

    const env = await EnvironmentModel.findOne({ _id: envId, projectId }).lean();
    if (!env) throw { statusCode: 404, message: 'ENVIRONMENT NOT FOUND' };

    const vars = await EnvVariableModel.find({ environmentId: envId, isDeleted: false }).lean();
    const decoded = vars.map((v) => {
        if (v.sensitivityLevel === 'critical') {
            return { key: v.key, value: '[REDACTED — critical credential]', group: v.group };
        }
        let val: string;
        try { val = decrypt(v.value); } catch { val = v.value; }
        return { key: v.key, value: val, group: v.group };
    });

    // Group by group
    const byGroup = new Map<string, typeof decoded>();
    for (const d of decoded) {
        if (!byGroup.has(d.group)) byGroup.set(d.group, []);
        byGroup.get(d.group)!.push(d);
    }

    const timestamp = new Date().toISOString();
    let content: string;
    let contentType: string;

    if (format === 'json') {
        const obj: Record<string, string> = {};
        decoded.forEach((d) => { obj[d.key] = d.value; });
        content    = JSON.stringify(obj, null, 2);
        contentType = 'application/json';
    } else if (format === 'yaml') {
        content     = decoded.map((d) => `${d.key}: "${d.value.replace(/"/g, '\\"')}"`).join('\n');
        contentType = 'text/yaml';
    } else {
        // dotenv
        const lines: string[] = [
            `# Generated by VaultStack — ${env.name}`,
            `# Generated at: ${timestamp}`,
            policy?.watermarkExports ? `# Authorised for: ${currentUser.name} (${currentUser.email})` : '',
            policy?.watermarkExports ? `# Reason: ${reason || 'N/A'}` : '',
            `# Do not commit this file to version control.`,
            '',
        ].filter(l => l !== '');
        
        for (const [group, items] of byGroup) {
            lines.push(`# ${group}`);
            items.forEach((i) => lines.push(`${i.key}=${i.value}`));
            lines.push('');
        }
        content     = lines.join('\n');
        contentType = 'text/plain';
    }

    await writeAuditLog({
        actorId: String(currentUser._id),
        action: 'envvar.export',
        organisationId: String(currentUser.organisationId),
        meta: { format, envName: env.name, keyCount: decoded.length, projectId, reason },
    });

    return { content, contentType, filename: `${(env as any).slug}.${format === 'dotenv' ? 'env' : format}` };
};

// ─── Compare ──────────────────────────────────────────────────────────────────

export const compareEnvironments = async (projectId: string, envAId: string, envBId: string) => {
    const [aVars, bVars] = await Promise.all([
        EnvVariableModel.find({ environmentId: envAId, isDeleted: false }).lean(),
        EnvVariableModel.find({ environmentId: envBId, isDeleted: false }).lean(),
    ]);

    const aKeys   = new Set(aVars.map((v) => v.key));
    const bKeys   = new Set(bVars.map((v) => v.key));
    const bValMap = new Map(bVars.map((v) => [v.key, v.value]));

    const onlyInA:    string[] = [];
    const onlyInB:    string[] = [];
    const inBoth:     string[] = [];
    const mismatched: string[] = [];

    for (const key of aKeys) {
        if (!bKeys.has(key)) { onlyInA.push(key); }
        else {
            inBoth.push(key);
            // Compare encrypted values — different encrypted blobs = different plaintext
            // (same plaintext can produce different ciphertext due to random IV, so we decrypt to compare)
            const aVal = aVars.find((v) => v.key === key)!.value;
            const bVal = bValMap.get(key)!;
            try {
                if (decrypt(aVal) !== decrypt(bVal)) mismatched.push(key);
            } catch {
                if (aVal !== bVal) mismatched.push(key);
            }
        }
    }
    for (const key of bKeys) { if (!aKeys.has(key)) onlyInB.push(key); }

    return { statusCode: 200, message: 'COMPARE COMPLETE', data: { onlyInA, onlyInB, inBoth, mismatched } };
};

export default { listEnvironments, createEnvironment, updateEnvironment, deleteEnvironment, listVariables, revealVariable, createVariable, updateVariable, deleteVariable, bulkUpsert, exportEnvironment, compareEnvironments };
