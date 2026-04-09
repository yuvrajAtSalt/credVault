import { model, Schema } from 'mongoose';
import { compare, hash } from 'bcrypt';
import { VAULT_ROLES } from '../utils/constants';

export interface ISpecialPermission {
    permission: string;
    value: boolean;          // true = grant, false = explicit revoke
    grantedBy: any;
    reason: string;
    grantedAt: Date;
    expiresAt?: Date | null;
    isActive: boolean;
}

export interface IUserDocument {
    _id: any;
    organisationId: any;
    name: string;
    email: string;
    password: string;
    role: string;
    customRoleId?: any;                  // ref: CustomRole (Phase 09)
    specialPermissions: ISpecialPermission[]; // individual grants/revocations
    forcePasswordChange: boolean;        // true → redirect to /change-password on login
    jobTitle?: string;
    department?: string;
    avatarUrl?: string;
    reportingTo?: any;
    teamId?: any;
    isOrgRoot: boolean;
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

const specialPermissionSchema = new Schema<ISpecialPermission>({
    permission: { type: String, required: true },
    value:      { type: Boolean, required: true },
    grantedBy:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason:     { type: String, required: true },
    grantedAt:  { type: Date, default: () => new Date() },
    expiresAt:  { type: Date, default: null },
    isActive:   { type: Boolean, default: true },
}, { _id: true });

const userSchema = new Schema<IUserDocument>(
    {
        organisationId:      { type: Schema.Types.ObjectId, ref: 'Organisation', required: true },
        name:                { type: String, required: true, trim: true },
        email:               { type: String, required: true, unique: true, lowercase: true, trim: true },
        password:            { type: String, required: true },
        role:                { type: String, enum: [...VAULT_ROLES, 'CUSTOM'], required: true },
        customRoleId:        { type: Schema.Types.ObjectId as any, ref: 'CustomRole', default: null },
        specialPermissions:  { type: [specialPermissionSchema], default: [] },
        forcePasswordChange: { type: Boolean, default: false },
        jobTitle:            { type: String },
        department:          { type: String },
        avatarUrl:           { type: String },
        reportingTo:         { type: Schema.Types.ObjectId, ref: 'User', default: null },
        teamId:              { type: Schema.Types.ObjectId as any, ref: 'Team', default: null },
        isOrgRoot:           { type: Boolean, default: false },
        isActive:            { type: Boolean, default: true },
        invitedBy:           { type: Schema.Types.ObjectId, ref: 'User', default: null },
        lastLoginAt:         { type: Date },
        isDeleted:           { type: Boolean, default: false },
        createdBy:           { type: Schema.Types.ObjectId, ref: 'User', required: true },
        updatedBy:           { type: Schema.Types.ObjectId, ref: 'User', required: true },
    },
    { timestamps: true },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
userSchema.index({ organisationId: 1 });
userSchema.index({ role: 1 });
userSchema.index({ reportingTo: 1 });
userSchema.index({ teamId: 1 });
userSchema.index({ organisationId: 1, isOrgRoot: 1 });


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
