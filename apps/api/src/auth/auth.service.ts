import { compare, hash } from 'bcrypt';
import { sign, verify } from 'jsonwebtoken';
import { SignOptions } from 'jsonwebtoken';
import userRepo from '../user/user.repo';
import { authResponses } from './auth.responses';
import { ILoginPayload } from './auth.types';
import { BlacklistedTokenModel } from './blacklisted-token.schema';

const getSecret = () => {
    const SECRET = process.env.VAULT_JWT_SECRET;
    if (!SECRET) throw new Error('VAULT_JWT_SECRET is not defined');
    return SECRET;
};

const getRefreshSecret = () =>
    process.env.VAULT_JWT_REFRESH_SECRET || getSecret();

// ─── login ────────────────────────────────────────────────────────────────────
export const login = async (credentials: ILoginPayload) => {
    const { email, password } = credentials;

    const user = await userRepo.findUserWithPassword({ email });
    if (!user) throw authResponses.INVALID_CREDENTIALS;

    const storedHash = (user as any).password;
    if (typeof storedHash !== 'string' || !storedHash) {
        throw authResponses.INVALID_CREDENTIALS;
    }

    const isPasswordValid = await compare(password, storedHash);
    if (!isPasswordValid) throw authResponses.INCORRECT_PASSWORD;

    if ((user as any).isActive === false) throw authResponses.ACCOUNT_INACTIVE;

    const roleValue =
        typeof user.role === 'object' && user.role !== null
            ? (user.role as any).name || (user.role as any)._id
            : user.role;

    const tokenPayload = { _id: user._id, email: user.email, role: roleValue };

    const SECRET = getSecret();
    const refreshSecret = getRefreshSecret();

    const tokenExpiry = process.env.ACCESS_TOKEN_EXPIRATION || '30m';
    const refreshExpiry = process.env.REFRESH_TOKEN_EXPIRATION || '7d';

    const token = sign(tokenPayload, SECRET, { expiresIn: tokenExpiry } as SignOptions);
    const refreshToken = sign(
        { _id: user._id, type: 'refresh' },
        refreshSecret,
        { expiresIn: refreshExpiry } as SignOptions,
    );

    const userResponse = {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: roleValue,
    };

    return {
        statusCode: 200,
        message: authResponses.LOGIN_SUCCESSFUL.message,
        data: { user: userResponse, token, refreshToken },
    };
};

// ─── me ───────────────────────────────────────────────────────────────────────
export const me = async (currentUser: any) => {
    const { _id } = currentUser;
    const user = await userRepo.findUserById(_id);
    if (!user) throw authResponses.USER_NOT_FOUND;
    return { statusCode: 200, message: 'USER FETCHED', data: user };
};

// ─── logout ───────────────────────────────────────────────────────────────────
export const logout = async (token: string) => {
    await BlacklistedTokenModel.create({ token });
    return { statusCode: 200, message: authResponses.LOGOUT_SUCCESSFUL.message, data: null };
};

// ─── refreshToken ─────────────────────────────────────────────────────────────
export const refreshToken = async (refreshTokenValue: string) => {
    let payload: any;
    try {
        payload = verify(refreshTokenValue, getRefreshSecret());
    } catch {
        throw authResponses.INVALID_OR_EXPIRED_REFRESH_TOKEN;
    }

    if (payload.type !== 'refresh') throw authResponses.INVALID_TOKEN_TYPE;

    const user = await userRepo.findUserById(payload._id);
    if (!user) throw authResponses.USER_NOT_FOUND;

    const roleValue =
        typeof (user as any).role === 'object'
            ? (user as any).role?.name
            : (user as any).role;

    const SECRET = getSecret();
    const refreshSecret = getRefreshSecret();

    const newToken = sign(
        { _id: (user as any)._id, email: (user as any).email, role: roleValue },
        SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRATION || '30m' } as SignOptions,
    );

    const newRefreshToken = sign(
        { _id: (user as any)._id, type: 'refresh' },
        refreshSecret,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRATION || '7d' } as SignOptions,
    );

    return {
        statusCode: 200,
        message: 'TOKEN REFRESHED',
        data: { token: newToken, refreshToken: newRefreshToken },
    };
};

export default { login, me, logout, refreshToken };
