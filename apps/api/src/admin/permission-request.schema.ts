import { model, Schema } from 'mongoose';

// ─── Interface ────────────────────────────────────────────────────────────────
export interface IPermissionRequestDocument {
    _id: any;
    organisationId: any;
    requestedBy: any;               // ref: User
    type: 'permission' | 'credential_visibility';
    credentialId?: any | null;      // ref: Credential
    permission: string;             // which permission they need
    reason: string;                 // why they need it (required)
    projectId?: any | null;         // optional project scope
    status: 'pending' | 'approved' | 'rejected';
    reviewedBy?: any | null;        // ref: User (sysadmin)
    reviewNote?: string;
    reviewedAt?: Date | null;
    expiresAt?: Date | null;        // if approved, sysadmin can set an expiry
    reviewableBy: 'sysadmin' | 'manager';
    createdAt: Date;
    updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────
const permissionRequestSchema = new Schema<IPermissionRequestDocument>(
    {
        organisationId: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true },
        requestedBy:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
        type:           { type: String, enum: ['permission', 'credential_visibility'], default: 'permission' },
        credentialId:   { type: Schema.Types.ObjectId, ref: 'Credential', default: null },
        permission:     { type: String, required: true },
        reason:         { type: String, required: true },
        projectId:      { type: Schema.Types.ObjectId, ref: 'Project', default: null },
        status:         { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
        reviewedBy:     { type: Schema.Types.ObjectId, ref: 'User', default: null },
        reviewNote:     { type: String },
        reviewedAt:     { type: Date, default: null },
        expiresAt:      { type: Date, default: null },
        reviewableBy:   { type: String, enum: ['sysadmin', 'manager'], default: 'sysadmin' },
    },
    { timestamps: true },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
permissionRequestSchema.index({ organisationId: 1 });
permissionRequestSchema.index({ requestedBy: 1 });
permissionRequestSchema.index({ status: 1 });
permissionRequestSchema.index({ createdAt: -1 });

export const PermissionRequestModel = model<IPermissionRequestDocument>(
    'PermissionRequest',
    permissionRequestSchema,
);
