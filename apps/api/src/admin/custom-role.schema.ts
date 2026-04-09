import { model, Schema } from 'mongoose';

// ─── Interface ────────────────────────────────────────────────────────────────
export interface IPermissionSet {
    canSeeAllProjects: boolean;
    canCreateProject: boolean;
    canAddCredential: boolean;
    canManageTeam: boolean;
    canGrantVisibility: boolean;
    canSeeAllCredentials: boolean;
    canManageRoles: boolean;
    canManageMembers: boolean;
    canViewAuditLog: boolean;
    canManageOrgSettings: boolean;
    isGod: boolean;
}

export interface ICustomRoleDocument {
    _id: any;
    organisationId: any;
    name: string;
    slug: string;
    description?: string;
    color: string;
    badgeLabel: string;       // max 8 chars — shown in badges
    isBuiltIn: boolean;       // true for the 9 system roles (read-only)
    permissions: IPermissionSet;
    createdBy?: any;
    createdAt: Date;
    updatedAt: Date;
}

// ─── Permission sub-schema ────────────────────────────────────────────────────
const permissionSetSchema = new Schema<IPermissionSet>(
    {
        canSeeAllProjects:    { type: Boolean, default: false },
        canCreateProject:     { type: Boolean, default: false },
        canAddCredential:     { type: Boolean, default: false },
        canManageTeam:        { type: Boolean, default: false },
        canGrantVisibility:   { type: Boolean, default: false },
        canSeeAllCredentials: { type: Boolean, default: false },
        canManageRoles:       { type: Boolean, default: false },
        canManageMembers:     { type: Boolean, default: false },
        canViewAuditLog:      { type: Boolean, default: false },
        canManageOrgSettings: { type: Boolean, default: false },
        isGod:                { type: Boolean, default: false },
    },
    { _id: false },
);

// ─── Main schema ──────────────────────────────────────────────────────────────
const customRoleSchema = new Schema<ICustomRoleDocument>(
    {
        organisationId: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true },
        name:           { type: String, required: true, trim: true },
        slug:           { type: String, required: true, lowercase: true, trim: true },
        description:    { type: String },
        color:          { type: String, default: '#5E6C84' },
        badgeLabel:     { type: String, maxlength: 8, required: true },
        isBuiltIn:      { type: Boolean, default: false },
        permissions:    { type: permissionSetSchema, required: true },
        createdBy:      { type: Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
customRoleSchema.index({ organisationId: 1 });
customRoleSchema.index({ organisationId: 1, slug: 1 }, { unique: true });
customRoleSchema.index({ isBuiltIn: 1 });

export const CustomRoleModel = model<ICustomRoleDocument>('CustomRole', customRoleSchema);
