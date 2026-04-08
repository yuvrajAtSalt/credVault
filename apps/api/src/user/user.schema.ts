import { model, Schema } from 'mongoose';
import { compare, hash } from 'bcrypt';
import { VAULT_ROLES } from '../utils/constants';

export interface IUserDocument {
    _id: any;
    organisationId: any;
    name: string;
    email: string;
    password: string;
    role: string;
    jobTitle?: string;
    department?: string;
    avatarUrl?: string;
    reportingTo?: any;
    isActive: boolean;
    invitedBy?: any;
    lastLoginAt?: Date;
    isDeleted: boolean;
    createdBy: any;
    updatedBy: any;
    createdAt: Date;
    updatedAt: Date;
    comparePassword(plain: string): Promise<boolean>;
    initials: string;
}

const userSchema = new Schema<IUserDocument>(
    {
        organisationId: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true },
        name:           { type: String, required: true, trim: true },
        email:          { type: String, required: true, unique: true, lowercase: true, trim: true },
        password:       { type: String, required: true },
        role:           { type: String, enum: VAULT_ROLES, required: true },
        jobTitle:       { type: String },
        department:     { type: String },
        avatarUrl:      { type: String },
        reportingTo:    { type: Schema.Types.ObjectId, ref: 'User', default: null },
        isActive:       { type: Boolean, default: true },
        invitedBy:      { type: Schema.Types.ObjectId, ref: 'User', default: null },
        lastLoginAt:    { type: Date },
        isDeleted:      { type: Boolean, default: false },
        createdBy:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
        updatedBy:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    },
    { timestamps: true },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
userSchema.index({ organisationId: 1 });
userSchema.index({ role: 1 });
userSchema.index({ reportingTo: 1 });


// ─── Pre-save: hash password on change (cost 12) ────────────────────────────
userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    this.password = await hash(this.password, 12);
});

// ─── Method: comparePassword ─────────────────────────────────────────────────
userSchema.methods.comparePassword = function (plain: string): Promise<boolean> {
    return compare(plain, this.password);
};

// ─── Virtual: initials ────────────────────────────────────────────────────────
userSchema.virtual('initials').get(function () {
    const parts = this.name.trim().split(' ');
    return parts.length >= 2
        ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
        : parts[0].slice(0, 2).toUpperCase();
});

export const UserModel = model<IUserDocument>('User', userSchema);
