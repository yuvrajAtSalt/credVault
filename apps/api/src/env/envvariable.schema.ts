import { model, Schema } from 'mongoose';
import { VAULT_ROLES } from '../utils/constants';

export interface IEnvVariableSchema {
    _id?: any;
    projectId: any;
    environmentId: any;
    organisationId: any;
    key: string;
    value: string;             // AES-256-GCM encrypted
    isSecret: boolean;
    group: string;
    inheritedFromEnvId?: any;
    isOverridden: boolean;
    addedBy: any;
    addedByRole: string;
    lastEditedBy?: any;
    lastEditedAt?: Date;
    isDeleted: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

const envVariableSchema = new Schema<IEnvVariableSchema>(
    {
        projectId:          { type: Schema.Types.ObjectId as any, ref: 'Project', required: true },
        environmentId:      { type: Schema.Types.ObjectId as any, ref: 'Environment', required: true },
        organisationId:     { type: Schema.Types.ObjectId as any, ref: 'Organisation', required: true },
        key:                { type: String, required: true, trim: true, match: /^[A-Z][A-Z0-9_]*$/ },
        value:              { type: String, required: true },
        isSecret:           { type: Boolean, default: true },
        group:              { type: String, default: 'General', trim: true },
        inheritedFromEnvId: { type: Schema.Types.ObjectId as any, ref: 'Environment' },
        isOverridden:       { type: Boolean, default: false },
        addedBy:            { type: Schema.Types.ObjectId as any, ref: 'User', required: true },
        addedByRole:        { type: String, enum: VAULT_ROLES, required: true },
        lastEditedBy:       { type: Schema.Types.ObjectId as any, ref: 'User' },
        lastEditedAt:       { type: Date },
        isDeleted:          { type: Boolean, default: false },
    },
    { timestamps: true },
);

envVariableSchema.index({ environmentId: 1 });
envVariableSchema.index({ projectId: 1 });
envVariableSchema.index({ key: 1 });
envVariableSchema.index({ isDeleted: 1 });
// One value per key per environment
envVariableSchema.index({ environmentId: 1, key: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });

export const EnvVariableModel = model<IEnvVariableSchema>('EnvVariable', envVariableSchema);
