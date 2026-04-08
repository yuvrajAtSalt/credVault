import { hash } from 'bcrypt';
import { Types } from 'mongoose';
import userRepo from './user.repo';
import { IuserSchema, IuserUpdateSchema } from './user.types';
import { userResponses } from './user.responses';

// ─── createUser ───────────────────────────────────────────────────────────────
export const createUser = async (
    userData: Partial<IuserSchema>,
    createdBy?: string,
) => {
    const existing = await userRepo.findUserByEmail(userData.email!);
    if (existing) throw userResponses.USER_ALREADY_EXISTS;

    const hashedPassword = await hash(userData.password!, 10);

    const newUserId = new Types.ObjectId();
    const actorId = createdBy ? new Types.ObjectId(createdBy) : newUserId;

    const newUser = await userRepo.insertUser({
        ...userData,
        _id: newUserId,
        password: hashedPassword,
        role: userData.role ?? 'DEVELOPER',
        createdBy: actorId,
        updatedBy: actorId,
    });

    return {
        statusCode: 201,
        message: userResponses.USER_CREATED_SUCCESSFULLY.message,
        data: newUser,
    };
};

// ─── getAllUsers ───────────────────────────────────────────────────────────────
export const getAllUsers = async (organisationId?: string, search?: string) => {
    let users;
    if (organisationId) {
        users = await userRepo.findAllUsersByOrg(organisationId);
        if (search) {
            const q = search.toLowerCase();
            users = (users as any[]).filter(
                (u: any) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
            );
        }
    } else {
        users = await userRepo.findAllUsersByOrg('');
    }
    return {
        statusCode: 200,
        message: userResponses.USERS_FETCHED_SUCCESSFULLY.message,
        data: users,
    };
};

// ─── getUserById ──────────────────────────────────────────────────────────────
export const getUserById = async (userId: string) => {
    const user = await userRepo.findUserById(userId);
    if (!user) throw userResponses.USER_NOT_FOUND;
    return {
        statusCode: 200,
        message: userResponses.USER_FETCHED_SUCCESSFULLY.message,
        data: user,
    };
};

// ─── updateUser ───────────────────────────────────────────────────────────────
export const updateUser = async (userId: string, updates: IuserUpdateSchema) => {
    const user = await userRepo.findUserById(userId);
    if (!user) throw userResponses.USER_NOT_FOUND;

    const updated = await userRepo.updateUser(userId, updates);
    return {
        statusCode: 200,
        message: userResponses.USER_UPDATED_SUCCESSFULLY.message,
        data: updated,
    };
};

// ─── deleteUser (soft) ────────────────────────────────────────────────────────
export const deleteUser = async (userId: string, requesterId: string) => {
    const user = await userRepo.findUserById(userId);
    if (!user) throw userResponses.USER_NOT_FOUND;

    await userRepo.softDeleteUser(userId, requesterId);
    return {
        statusCode: 200,
        message: userResponses.USER_DELETED_SUCCESSFULLY.message,
        data: null,
    };
};

export default { createUser, getAllUsers, getUserById, updateUser, deleteUser };
