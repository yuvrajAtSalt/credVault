import { Types } from 'mongoose';
import { userModel } from './user.schema';
import { IuserSchema, IuserUpdateSchema } from './user.types';

export type UserInsertPayload = Record<string, unknown> & {
    password: string;
    role: string;
    createdBy: Types.ObjectId;
    updatedBy: Types.ObjectId;
    _id?: Types.ObjectId;
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export const findUser = (query: Partial<IuserSchema>) => {
    if (!query.email) return null;
    return userModel.findOne({ email: query.email }).select('-password').exec();
};

export const findUserWithPassword = (query: Partial<IuserSchema>) => {
    if (!query.email) return null;
    return userModel.findOne({ email: query.email }).exec();
};

export const findAllUsers = () =>
    userModel.find({ isDeleted: { $ne: true } }).select('-password').exec();

export const findUserById = (userId: string) =>
    userModel.findById(userId).select('-password').exec();

export const findOne = (query: any) =>
    userModel.findOne(query).select('-password').exec();

// ─── Mutations ────────────────────────────────────────────────────────────────

export const insertOne = async (newUser: UserInsertPayload) => {
    const User = new userModel(newUser);
    await User.save();
    return User;
};

export const findByIdAndUpdate = (userId: string, updates: IuserUpdateSchema) =>
    userModel.findByIdAndUpdate(userId, updates, { new: true });

export const softDelete = (userId: string, deletedBy: string) =>
    userModel.findByIdAndUpdate(
        userId,
        { isDeleted: true, updatedBy: new Types.ObjectId(deletedBy) },
        { new: true },
    );

export const count = (query: Partial<IuserSchema> = {}) =>
    userModel.countDocuments(query as any);

// ─── Default export (barrel) ────────────────────────────────────────────────-─
export default {
    findUser,
    findUserWithPassword,
    findAllUsers,
    findUserById,
    findOne,
    insertOne,
    findByIdAndUpdate,
    softDelete,
    count,
};
