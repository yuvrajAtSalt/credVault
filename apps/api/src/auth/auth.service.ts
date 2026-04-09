import { compare, hash } from 'bcrypt';
import { sign, verify } from 'jsonwebtoken';
import { SignOptions } from 'jsonwebtoken';
import { Types } from 'mongoose';
import userRepo from '../user/user.repo';
import orgRepo from '../organisation/organisation.repo';
import { writeAuditLog } from '../audit/audit.repo';
import { authResponses } from './auth.responses';
import { ILoginPayload } from './auth.types';
import { BlacklistedTokenModel } from './blacklisted-token.schema';
import { VAULT_ROLES, VaultRole, PRIVLEGED_ROLES } from '../utils/constants';

const getSecret = () => {
    const s = process.env.VAULT_JWT_SECRET;
    if (!s) throw new Error('VAULT_JWT_SECRET is not defined');
    return s;
};
const getRefreshSecret = () => process.env.VAULT_JWT_REFRESH_SECRET || getSecret();

// ─── register ─────────────────────────────────────────────────────────────────
// First-user flow only. Creates the Organisation + first SYSADMIN.
export const register = async (body: {
    orgName: string;
    name: string;
    email: string;
    password: string;
    slug?: string;
}) => {
    const { orgName, name, email, password } = body;

    // Only allowed when zero users exist
    const existingUser = await userRepo.findUserByEmail(email);
    if (existingUser) throw authResponses.EMAIL_ALREADY_EXISTS;

    const slug = (body.slug || orgName)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    const existingOrg = await orgRepo.findOrgBySlug(slug);
    if (existingOrg) throw { statusCode: 400, message: 'ORGANISATION SLUG ALREADY TAKEN' };

    // Create org
    const org = await orgRepo.insertOrg({ name: orgName, slug });

    // Create first SYSADMIN (password hashed by pre-save hook)
    const userId = new Types.ObjectId();
    const user = await userRepo.insertUser({
        _id: userId,
        organisationId: org._id,
        name,
        email,
        password,
        role: 'SYSADMIN',
        isActive: true,
        createdBy: userId,
        updatedBy: userId,
    } as any);

    const tokenPayload = { _id: user._id, email: user.email, role: 'SYSADMIN', organisationId: org._id };
    const token = sign(tokenPayload, getSecret(), { expiresIn: process.env.ACCESS_TOKEN_EXPIRATION || '30m' } as SignOptions);
    const refreshToken = sign({ _id: user._id, type: 'refresh' }, getRefreshSecret(), { expiresIn: '7d' } as SignOptions);

    await writeAuditLog({ actorId: String(user._id), action: 'login', organisationId: String(org._id), meta: { event: 'register' } });

    return {
        statusCode: 201,
        message: 'ORGANISATION AND ADMIN CREATED SUCCESSFULLY',
        data: {
            user: { _id: user._id, name: user.name, email: user.email, role: 'SYSADMIN', organisationId: org._id },
            token,
            refreshToken,
        },
    };
};

// ─── login ─────────────────────────────────────────────────────────────────────
export const login = async (credentials: ILoginPayload, ipAddress?: string) => {
    const { email, password } = credentials;

    const user = await userRepo.findUserByEmailWithPassword(email);
    if (!user) throw authResponses.INVALID_CREDENTIALS;
    if (!user.isActive) throw authResponses.ACCOUNT_INACTIVE;

    const isValid = await compare(password, user.password);
    if (!isValid) throw authResponses.INCORRECT_PASSWORD;

    await userRepo.updateLastLogin(String(user._id));

    const tokenPayload = { _id: user._id, email: user.email, role: user.role, organisationId: user.organisationId };
    const token = sign(tokenPayload, getSecret(), { expiresIn: process.env.ACCESS_TOKEN_EXPIRATION || '30m' } as SignOptions);
    const refreshToken = sign({ _id: user._id, type: 'refresh' }, getRefreshSecret(), { expiresIn: process.env.REFRESH_TOKEN_EXPIRATION || '7d' } as SignOptions);

    await writeAuditLog({ actorId: String(user._id), action: 'login', organisationId: String(user.organisationId), ipAddress });

    return {
        statusCode: 200,
        message: authResponses.LOGIN_SUCCESSFUL.message,
        data: {
            user: { _id: user._id, name: user.name, email: user.email, role: user.role, organisationId: user.organisationId, avatarUrl: user.avatarUrl },
            token,
            refreshToken,
        },
    };
};

// ─── me ──────────────────────────────────────────────────────────────────────
export const me = async (currentUser: any) => {
    const user = await userRepo.findUserById(String(currentUser._id));
    if (!user) throw authResponses.USER_NOT_FOUND;
    return { statusCode: 200, message: 'USER FETCHED', data: user };
};

// ─── logout ──────────────────────────────────────────────────────────────────
export const logout = async (token: string, currentUser?: any) => {
    await BlacklistedTokenModel.create({ token });
    if (currentUser?._id) {
        await writeAuditLog({ actorId: String(currentUser._id), action: 'logout', organisationId: String(currentUser.organisationId) });
    }
    return { statusCode: 200, message: authResponses.LOGOUT_SUCCESSFUL.message, data: null };
};

// ─── refreshToken ─────────────────────────────────────────────────────────────
export const refreshToken = async (refreshTokenValue: string) => {
    let payload: any;
    try { payload = verify(refreshTokenValue, getRefreshSecret()); }
    catch { throw authResponses.INVALID_OR_EXPIRED_REFRESH_TOKEN; }

    if (payload.type !== 'refresh') throw authResponses.INVALID_TOKEN_TYPE;

    const user = await userRepo.findUserById(payload._id);
    if (!user) throw authResponses.USER_NOT_FOUND;

    const newToken = sign(
        { _id: (user as any)._id, email: (user as any).email, role: (user as any).role, organisationId: (user as any).organisationId },
        getSecret(),
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRATION || '30m' } as SignOptions,
    );
    const newRefresh = sign({ _id: (user as any)._id, type: 'refresh' }, getRefreshSecret(), { expiresIn: '7d' } as SignOptions);

    return { statusCode: 200, message: 'TOKEN REFRESHED', data: { token: newToken, refreshToken: newRefresh } };
};

// ─── invite ───────────────────────────────────────────────────────────────────
export const invite = async (body: { name: string; email: string; role: VaultRole; reportingTo?: string }, inviter: any) => {
    const { name, email, role, reportingTo } = body;

    if (!VAULT_ROLES.includes(role)) throw { statusCode: 400, message: 'INVALID ROLE' };

    const existing = await userRepo.findUserByEmail(email);
    if (existing) throw authResponses.EMAIL_ALREADY_EXISTS;

    const tempPassword = Math.random().toString(36).slice(-10) + 'Aa1!';
    const inviterId = new Types.ObjectId(inviter._id);
    const newUserId = new Types.ObjectId();

    const user = await userRepo.insertUser({
        _id: newUserId,
        organisationId: inviter.organisationId,
        name,
        email,
        password: tempPassword,   // hashed by pre-save hook
        role,
        reportingTo: reportingTo ? new Types.ObjectId(reportingTo) : undefined,
        isActive: false,          // must set password on first login (Phase 04)
        invitedBy: inviterId,
        createdBy: inviterId,
        updatedBy: inviterId,
    } as any);

    // Invite token — used to verify the invite link (Phase 04 sends email)
    const inviteToken = sign(
        { _id: user._id, email: user.email, type: 'invite' },
        getSecret(),
        { expiresIn: '7d' } as SignOptions,
    );

    await writeAuditLog({
        actorId: String(inviter._id),
        action: 'member.invite',
        targetType: 'User',
        targetId: String(user._id),
        organisationId: String(inviter.organisationId),
        meta: { email, role },
    });

    return {
        statusCode: 201,
        message: 'INVITE SENT SUCCESSFULLY',
        data: { userId: user._id, email: user.email, role: user.role, inviteToken },
    };
};

// ─── changePassword ──────────────────────────────────────────────────────────
export const changePassword = async (userId: string, body: { currentPassword: string; newPassword: string }) => {
    const { currentPassword, newPassword } = body;

    const { UserModel } = await import('../user/user.schema');
    const fullUser = await UserModel.findById(userId).select('+password').lean();
    if (!fullUser) throw authResponses.USER_NOT_FOUND;

    const isValid = await compare(currentPassword, (fullUser as any).password);
    if (!isValid) throw { statusCode: 400, message: 'CURRENT PASSWORD IS INCORRECT' };

    const hashed = await hash(newPassword, 12);
    await UserModel.findByIdAndUpdate(userId, { password: hashed });

    return { statusCode: 200, message: 'PASSWORD CHANGED SUCCESSFULLY', data: null };
};

// ─── mePermissions ────────────────────────────────────────────────────────────
export const mePermissions = async (currentUser: any) => {
    const { UserModel } = await import('../user/user.schema');
    const user = await UserModel.findById(currentUser._id)
        .populate('customRoleId', 'name slug color badgeLabel permissions')
        .lean();
    if (!user) throw authResponses.USER_NOT_FOUND;

    const { resolvePermissionsSync } = await import('../utils/permissions');
    const effective = resolvePermissionsSync(user);

    return { statusCode: 200, message: 'PERMISSIONS FETCHED', data: { effectivePermissions: effective, forcePasswordChange: (user as any).forcePasswordChange } };
};

export default { register, login, me, mePermissions, logout, refreshToken, invite, changePassword };
