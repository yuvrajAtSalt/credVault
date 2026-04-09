import { model, Schema } from 'mongoose';
import { ICredentialSchema, CREDENTIAL_CATEGORIES, CREDENTIAL_ENVIRONMENTS } from './credential.types';
import { VAULT_ROLES } from '../utils/constants';

const revealReasonSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        reason: { type: String, required: true },
        at:     { type: Date, default: Date.now },
    },
    { _id: false },
);

const credentialSchema = new Schema<ICredentialSchema>(
    {
        projectId:            { type: Schema.Types.ObjectId as any, ref: 'Project', required: true },
        organisationId:       { type: Schema.Types.ObjectId as any, ref: 'Organisation', required: true },
        category:             { type: String, enum: CREDENTIAL_CATEGORIES, required: true },
        label:                { type: String, required: true, trim: true },
        value:                { type: String, required: true },     // AES-256 encrypted (Phase 03)
        isSecret:             { type: Boolean, default: true },
        environment:          { type: String, enum: CREDENTIAL_ENVIRONMENTS, default: 'all' },
        expiresAt:            { type: Date },
        rotationReminderDays: { type: Number, default: 30 },
        sensitivityLevel:     { type: String, enum: ['normal', 'sensitive', 'critical'], default: 'normal' },
        revealReasons:        { type: [revealReasonSchema], default: [] },
        addedBy:              { type: Schema.Types.ObjectId as any, ref: 'User', required: true },
        addedByRole:          { type: String, enum: VAULT_ROLES, required: true },
        lastEditedBy:         { type: Schema.Types.ObjectId as any, ref: 'User' },
        lastEditedAt:         { type: Date },
        isDeleted:            { type: Boolean, default: false },
    },
    { timestamps: true },
);

credentialSchema.index({ projectId: 1 });
credentialSchema.index({ organisationId: 1 });
credentialSchema.index({ category: 1 });
credentialSchema.index({ addedBy: 1 });
credentialSchema.index({ isDeleted: 1 });

export const CredentialModel = model<ICredentialSchema>('Credential', credentialSchema);
