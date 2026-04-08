import { model, Schema } from 'mongoose';
import { IuserSchema } from './user.types';
import { BaseSchema } from '../utils/base.schema';

export const userSchema = new BaseSchema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        required: true,
        enum: ['SYSADMIN', 'CEO', 'COO', 'CFO', 'CMO', 'MANAGER', 'DEVOPS', 'DEVELOPER', 'QA'],
    },
    isActive: {
        type: Boolean,
        default: true,
    },
});

userSchema.index({ email: 1 });

export const userModel = model<IuserSchema>('User', userSchema);
