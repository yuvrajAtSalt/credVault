import { Types } from 'mongoose';
import { hash } from 'bcrypt';
import { UserModel } from '../user/user.schema';
import { CustomRoleModel, IPermissionSet } from './custom-role.schema';
import userRepo from '../user/user.repo';
import { writeAuditLog } from '../audit/audit.repo';
import { VAULT_ROLES, BASE_PERMISSIONS, ALL_PERMISSIONS, VaultRole } from '../utils/constants';
import { resolvePermissionsSync, expireStalePermissions } from '../utils/permissions';
import { enqueueEmail } from '../utils/email/queue';
import { templates } from '../utils/email/templates';
import orgRepo from '../organisation/organisation.repo';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function passwordStrengthCheck(pw: string) {
    if (pw.length < 8)                     throw { statusCode: 400, message: 'PASSWORD TOO SHORT — MIN 8 CHARS' };
    if (!/[A-Z]/.test(pw))                throw { statusCode: 400, message: 'PASSWORD MUST CONTAIN AN UPPERCASE LETTER' };
    if (!/[0-9]/.test(pw))                throw { statusCode: 400, message: 'PASSWORD MUST CONTAIN A NUMBER' };
}

// Walk the reporting chain upward and return all ancestor IDs.
async function getAncestors(userId: string, organisationId: string): Promise<Set<string>> {
    const visited = new Set<string>();
    let current: any = await UserModel.findById(userId).lean();
    while (current?.reportingTo) {
        const parentId = String(current.reportingTo);
        if (visited.has(parentId)) break; // safety — already circular
        visited.add(parentId);
        current = await UserModel.findById(parentId).lean();
    }
    return visited;
}

// ─── USER MANAGEMENT ─────────────────────────────────────────────────────────

export const listUsers = async (
    currentUser: any,
    query: { search?: string; role?: string; team?: string; status?: string; page?: string; limit?: string },
) => {
    const orgId = String(currentUser.organisationId);
    const page  = Math.max(1, parseInt(query.page  || '1',  10));
    const limit = Math.min(100, parseInt(query.limit || '20', 10));
    const skip  = (page - 1) * limit;

    const filter: any = { organisationId: orgId, isDeleted: { $ne: true } };

    if (query.status === 'active')   filter.isActive = true;
    if (query.status === 'inactive') filter.isActive = false;
    if (query.role)   filter.role = query.role.toUpperCase();
    if (query.team)   filter.teamId = new Types.ObjectId(query.team);
    if (query.search) {
        filter.$or = [
            { name: { $regex: query.search, $options: 'i' } },
            { email: { $regex: query.search, $options: 'i' } },
        ];
    }

    const [users, total] = await Promise.all([
        UserModel.find(filter)
            .select('-password')
            .populate('customRoleId', 'name slug color badgeLabel permissions')
            .populate('teamId', 'name color')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        UserModel.countDocuments(filter),
    ]);

    // Attach effective permissions + special grants count to each user
    const enriched = users.map((u) => ({
        ...u,
        specialPermissionsCount: ((u as any).specialPermissions ?? []).filter((sp: any) => sp.isActive).length,
    }));

    return {
        statusCode: 200,
        message: 'USERS FETCHED',
        data: { users: enriched, total, page, limit, pages: Math.ceil(total / limit) },
    };
};

export const createUser = async (body: any, currentUser: any) => {
    const { name, email, secondaryEmails, password, role, customRoleId, jobTitle, department,
            teamId, reportingTo, isOrgRoot, forcePasswordChange } = body;

    // Validate exactly one of role / customRoleId
    if (!role && !customRoleId) throw { statusCode: 400, message: 'EITHER ROLE OR CUSTOM_ROLE_ID IS REQUIRED' };
    if (role && customRoleId)   throw { statusCode: 400, message: 'PROVIDE ONLY ONE OF ROLE OR CUSTOM_ROLE_ID' };

    // Validate built-in role enum
    if (role && !VAULT_ROLES.includes(role)) throw { statusCode: 400, message: 'INVALID ROLE' };

    // Validate custom role exists in org
    if (customRoleId) {
        const cr = await CustomRoleModel.findOne({ _id: customRoleId, organisationId: currentUser.organisationId }).lean();
        if (!cr) throw { statusCode: 404, message: 'CUSTOM ROLE NOT FOUND' };
    }

    passwordStrengthCheck(password);

    const existing = await userRepo.findUserByEmail(email);
    if (existing) throw { statusCode: 409, message: 'EMAIL ALREADY IN USE' };

    // Circular reporting chain check
    if (reportingTo) {
        const ancestors = await getAncestors(reportingTo, String(currentUser.organisationId));
        // The new user doesn't exist yet so no circular risk from below, but validate reportingTo exists
        const manager = await UserModel.findById(reportingTo).lean();
        if (!manager) throw { statusCode: 404, message: 'REPORTING_TO USER NOT FOUND' };
    }

    const newId = new Types.ObjectId();
    const actorId = new Types.ObjectId(currentUser._id);

    const user = await userRepo.insertUser({
        _id: newId,
        organisationId: currentUser.organisationId,
        name,
        email,
        secondaryEmails: secondaryEmails || [],
        password,          // hashed by pre-save hook
        role: customRoleId ? 'CUSTOM' : role,
        customRoleId: customRoleId ? new Types.ObjectId(customRoleId) : undefined,
        forcePasswordChange: forcePasswordChange !== false, // default true
        jobTitle,
        department,
        teamId: teamId ? new Types.ObjectId(teamId) : undefined,
        reportingTo: reportingTo ? new Types.ObjectId(reportingTo) : undefined,
        isOrgRoot: isOrgRoot || false,
        isActive: true,
        createdBy: actorId,
        updatedBy: actorId,
    } as any);

    // If isOrgRoot, clear previous root
    if (isOrgRoot) {
        await UserModel.updateMany(
            { organisationId: currentUser.organisationId, isOrgRoot: true, _id: { $ne: newId } },
            { isOrgRoot: false },
        );
    }

    await writeAuditLog({
        actorId: String(currentUser._id),
        action: 'user.created',
        targetType: 'User',
        targetId: String(newId),
        organisationId: String(currentUser.organisationId),
        meta: { email, role: customRoleId ? 'CUSTOM' : role },
    });

    const org = await orgRepo.findOrgById(String(currentUser.organisationId));
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3050';

    await enqueueEmail({
        to: email,
        subject: `Welcome to ${org?.name || 'VaultStack'}!`,
        ...(await templates.WelcomeNewUser({
            name,
            orgName: org?.name || 'VaultStack',
            loginUrl: `${appUrl}/login`,
            tempPassword: password,
            role: (customRoleId ? 'CUSTOM' : role) as string,
            email,
        })),
    });

    return {
        statusCode: 201,
        message: 'USER CREATED SUCCESSFULLY',
        data: {
            userId: user._id,
            email: user.email,
            role: user.role,
            tempPassword: password, // caller shows this once
        },
    };
};

export const updateUser = async (userId: string, body: any, currentUser: any) => {
    const user = await UserModel.findOne({ _id: userId, organisationId: currentUser.organisationId }).lean();
    if (!user) throw { statusCode: 404, message: 'USER NOT FOUND' };

    const allowed = ['name', 'email', 'secondaryEmails', 'role', 'customRoleId', 'jobTitle', 'department',
                     'teamId', 'reportingTo', 'isActive', 'forcePasswordChange', 'avatarUrl'];
    const patch: any = {};
    for (const key of allowed) {
        if (body[key] !== undefined) patch[key] = body[key];
    }

    if (patch.isOrgRoot) {
        await UserModel.updateMany(
            { organisationId: currentUser.organisationId, isOrgRoot: true, _id: { $ne: userId } },
            { isOrgRoot: false },
        );
    }

    const updated = await UserModel.findByIdAndUpdate(userId, patch, { new: true })
        .select('-password')
        .populate('customRoleId', 'name slug color badgeLabel permissions')
        .lean();

    await writeAuditLog({
        actorId: String(currentUser._id),
        action: 'user.updated',
        targetType: 'User',
        targetId: userId,
        organisationId: String(currentUser.organisationId),
        meta: { fields: Object.keys(patch) },
    });

    return { statusCode: 200, message: 'USER UPDATED', data: updated };
};

export const reactivateUser = async (userId: string, currentUser: any) => {
    const updated = await UserModel.findByIdAndUpdate(userId, { isActive: true }, { new: true }).select('-password').lean();
    if (!updated) throw { statusCode: 404, message: 'USER NOT FOUND' };

    await writeAuditLog({
        actorId: String(currentUser._id), action: 'user.reactivated',
        targetType: 'User', targetId: userId, organisationId: String(currentUser.organisationId),
    });
    return { statusCode: 200, message: 'USER REACTIVATED', data: updated };
};

export const resetPassword = async (userId: string, body: { newPassword: string; forcePasswordChange?: boolean }, currentUser: any) => {
    passwordStrengthCheck(body.newPassword);
    const hashed = await hash(body.newPassword, 12);
    const updated = await UserModel.findByIdAndUpdate(
        userId,
        { password: hashed, forcePasswordChange: body.forcePasswordChange !== false },
        { new: true },
    ).select('-password').lean();
    if (!updated) throw { statusCode: 404, message: 'USER NOT FOUND' };

    await writeAuditLog({
        actorId: String(currentUser._id), action: 'user.updated',
        targetType: 'User', targetId: userId, organisationId: String(currentUser.organisationId),
        meta: { action: 'password_reset' },
    });
    return { statusCode: 200, message: 'PASSWORD RESET SUCCESSFULLY', data: null };
};

// ─── CUSTOM ROLES ─────────────────────────────────────────────────────────────

function makeSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export const listRoles = async (currentUser: any) => {
    const roles = await CustomRoleModel.find({ organisationId: currentUser.organisationId })
        .sort({ isBuiltIn: -1, name: 1 })
        .lean();

    // Attach member count to each role
    const enriched = await Promise.all(roles.map(async (r) => {
        const filter: any = { organisationId: currentUser.organisationId, isDeleted: { $ne: true } };
        if (r.isBuiltIn) filter.role = r.slug.toUpperCase();
        else             filter.customRoleId = r._id;
        const memberCount = await UserModel.countDocuments(filter);
        return { ...r, memberCount };
    }));

    return { statusCode: 200, message: 'ROLES FETCHED', data: enriched };
};

export const createRole = async (body: any, currentUser: any) => {
    const { name, description, color, badgeLabel, permissions } = body;
    const slug = makeSlug(name);

    const existing = await CustomRoleModel.findOne({ organisationId: currentUser.organisationId, slug }).lean();
    if (existing) throw { statusCode: 409, message: 'A ROLE WITH THIS NAME ALREADY EXISTS' };

    const role = await CustomRoleModel.create({
        organisationId: currentUser.organisationId,
        name, slug, description,
        color: color || '#5E6C84',
        badgeLabel: (badgeLabel || name).slice(0, 8),
        isBuiltIn: false,
        permissions,
        createdBy: currentUser._id,
    });

    await writeAuditLog({
        actorId: String(currentUser._id), action: 'role.created',
        targetType: 'CustomRole', targetId: String(role._id),
        organisationId: String(currentUser.organisationId),
        meta: { name },
    });

    return { statusCode: 201, message: 'ROLE CREATED', data: role };
};

export const updateRole = async (roleId: string, body: any, currentUser: any) => {
    const role = await CustomRoleModel.findOne({ _id: roleId, organisationId: currentUser.organisationId }).lean();
    if (!role) throw { statusCode: 404, message: 'ROLE NOT FOUND' };
    if (role.isBuiltIn) throw { statusCode: 403, message: 'BUILT-IN ROLES CANNOT BE MODIFIED' };

    const patch: any = {};
    for (const key of ['name', 'description', 'color', 'badgeLabel', 'permissions']) {
        if (body[key] !== undefined) patch[key] = body[key];
    }
    if (patch.name) patch.slug = makeSlug(patch.name);

    const updated = await CustomRoleModel.findByIdAndUpdate(roleId, patch, { new: true }).lean();

    await writeAuditLog({
        actorId: String(currentUser._id), action: 'role.updated',
        targetType: 'CustomRole', targetId: roleId,
        organisationId: String(currentUser.organisationId),
        meta: { fields: Object.keys(patch) },
    });

    return { statusCode: 200, message: 'ROLE UPDATED', data: updated };
};

export const deleteRole = async (roleId: string, currentUser: any) => {
    const role = await CustomRoleModel.findOne({ _id: roleId, organisationId: currentUser.organisationId }).lean();
    if (!role) throw { statusCode: 404, message: 'ROLE NOT FOUND' };
    if (role.isBuiltIn) throw { statusCode: 403, message: 'BUILT-IN ROLES CANNOT BE DELETED' };

    const memberCount = await UserModel.countDocuments({ customRoleId: roleId, isDeleted: { $ne: true } });
    if (memberCount > 0) throw { statusCode: 409, message: 'REASSIGN ALL MEMBERS BEFORE DELETING THIS ROLE' };

    await CustomRoleModel.findByIdAndDelete(roleId);

    await writeAuditLog({
        actorId: String(currentUser._id), action: 'role.deleted',
        targetType: 'CustomRole', targetId: roleId,
        organisationId: String(currentUser.organisationId),
        meta: { name: role.name },
    });

    return { statusCode: 200, message: 'ROLE DELETED', data: null };
};

// ─── SPECIAL PERMISSIONS ─────────────────────────────────────────────────────

export const getUserPermissions = async (userId: string, currentUser: any) => {
    const user = await UserModel.findOne({ _id: userId, organisationId: currentUser.organisationId })
        .select('-password')
        .populate('customRoleId', 'name slug color badgeLabel permissions')
        .lean() as any;
    if (!user) throw { statusCode: 404, message: 'USER NOT FOUND' };

    await expireStalePermissions(await UserModel.findById(userId));

    const effective = resolvePermissionsSync(user);

    // Role-only permissions (without special grants applied)
    const roleOnly = user.role === 'CUSTOM' && user.customRoleId?.permissions
        ? { ...user.customRoleId.permissions }
        : { ...BASE_PERMISSIONS[user.role as VaultRole] };

    const now = new Date();
    const specialPermissions = (user.specialPermissions ?? []).map((sp: any) => ({
        ...sp,
        isExpired: sp.expiresAt ? new Date(sp.expiresAt) <= now : false,
    }));

    return {
        statusCode: 200,
        message: 'PERMISSIONS FETCHED',
        data: { effectivePermissions: effective, rolePermissions: roleOnly, specialPermissions },
    };
};

export const grantPermission = async (userId: string, body: any, currentUser: any) => {
    const { permission, value, reason, expiresAt } = body;

    if (!ALL_PERMISSIONS.includes(permission)) throw { statusCode: 400, message: 'INVALID PERMISSION KEY' };

    const user = await UserModel.findOne({ _id: userId, organisationId: currentUser.organisationId });
    if (!user) throw { statusCode: 404, message: 'USER NOT FOUND' };

    // Upsert: if grant for this permission exists, update; otherwise push
    const existing = user.specialPermissions.find((sp) => sp.permission === permission);
    if (existing) {
        existing.value     = value;
        existing.reason    = reason;
        existing.grantedBy = currentUser._id;
        existing.grantedAt = new Date();
        existing.expiresAt = expiresAt || null;
        existing.isActive  = true;
    } else {
        user.specialPermissions.push({
            permission, value, reason,
            grantedBy: currentUser._id,
            grantedAt: new Date(),
            expiresAt: expiresAt || null,
            isActive: true,
        });
    }
    await user.save();

    await writeAuditLog({
        actorId: String(currentUser._id),
        action: value ? 'permission.granted' : 'permission.revoked',
        targetType: 'User', targetId: userId,
        organisationId: String(currentUser.organisationId),
        meta: { permission, value, reason, expiresAt },
    });

    if (value) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3050';
        await enqueueEmail({
            to: user.email,
            subject: `New Permission Granted: ${permission}`,
            ...(await templates.PermissionGranted({
                recipientName: user.name,
                permission,
                grantedBy: currentUser.name || 'An administrator',
                reason,
                expiresAt,
                dashboardUrl: `${appUrl}/settings/profile`,
                email: user.email,
            })),
        });
    }

    return { statusCode: 200, message: `PERMISSION ${value ? 'GRANTED' : 'REVOKED'}`, data: null };
};

export const revokePermission = async (userId: string, permissionName: string, currentUser: any) => {
    const user = await UserModel.findOne({ _id: userId, organisationId: currentUser.organisationId });
    if (!user) throw { statusCode: 404, message: 'USER NOT FOUND' };

    const sp = user.specialPermissions.find((s) => s.permission === permissionName);
    if (!sp) throw { statusCode: 404, message: 'PERMISSION GRANT NOT FOUND' };

    sp.isActive = false;
    await user.save();

    await writeAuditLog({
        actorId: String(currentUser._id), action: 'permission.revoked',
        targetType: 'User', targetId: userId,
        organisationId: String(currentUser.organisationId),
        meta: { permission: permissionName },
    });

    return { statusCode: 200, message: 'PERMISSION REVOKED', data: null };
};

export const getPendingRequestsCount = async (currentUser: any) => {
    const { PermissionRequestModel } = await import('./permission-request.schema');
    const count = await PermissionRequestModel.countDocuments({
        organisationId: currentUser.organisationId,
        status: 'pending',
    });
    return { statusCode: 200, message: 'COUNT FETCHED', data: { count } };
};

export default {
    listUsers, createUser, updateUser, reactivateUser, resetPassword,
    listRoles, createRole, updateRole, deleteRole,
    getUserPermissions, grantPermission, revokePermission, getPendingRequestsCount,
};
