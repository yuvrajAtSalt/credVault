import { Types } from 'mongoose';
import { UserModel, IUserDocument } from './user.schema';

// ─── Reads ────────────────────────────────────────────────────────────────────
export const findUserByEmail = (email: string) =>
    UserModel.findOne({ email: email.toLowerCase(), isDeleted: { $ne: true } }).exec();

export const findUserByEmailWithPassword = (email: string) =>
    UserModel.findOne({ email: email.toLowerCase() }).exec();

export const findUserById = (id: string) =>
    UserModel.findById(id).select('-password').exec();

export const findUserByIdWithPassword = (id: string) =>
    UserModel.findById(id).exec();

export const findAllUsersByOrg = (organisationId: string) =>
    UserModel.find({ organisationId, isDeleted: { $ne: true } }).select('-password').exec();

export const findUserByIdInOrg = (id: string, organisationId: string) =>
    UserModel.findOne({ _id: id, organisationId, isDeleted: { $ne: true } }).select('-password').exec();

export const countUsersByOrg = (organisationId: string) =>
    UserModel.countDocuments({ organisationId, isDeleted: { $ne: true } });

// ─── Writes ───────────────────────────────────────────────────────────────────
export const insertUser = async (data: Partial<IUserDocument>) => {
    const user = new UserModel(data);
    await user.save();
    return user;
};

export const updateLastLogin = (id: string) =>
    UserModel.findByIdAndUpdate(id, { lastLoginAt: new Date() }, { new: true });

export const updateUser = (id: string, updates: Partial<IUserDocument>) =>
    UserModel.findByIdAndUpdate(id, updates, { new: true }).select('-password').exec();

export const softDeleteUser = (id: string, deletedBy: string) =>
    UserModel.findByIdAndUpdate(
        id,
        { isDeleted: true, updatedBy: new Types.ObjectId(deletedBy) },
        { new: true },
    );

// ─── Barrel ───────────────────────────────────────────────────────────────────
export default {
    findUserByEmail,
    findUserByEmailWithPassword,
    findUserById,
    findUserByIdWithPassword,
    findAllUsersByOrg,
    findUserByIdInOrg,
    countUsersByOrg,
    insertUser,
    updateLastLogin,
    updateUser,
    softDeleteUser,
};
