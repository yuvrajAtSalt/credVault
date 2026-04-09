import { model, Schema } from 'mongoose';

export interface IEnvironmentSchema {
    _id?: any;
    projectId: any;
    organisationId: any;
    name: string;
    slug: string;
    description?: string;
    color?: string;
    isBaseEnvironment: boolean;
    createdBy: any;
    createdAt?: Date;
    updatedAt?: Date;
}

const environmentSchema = new Schema<IEnvironmentSchema>(
    {
        projectId:         { type: Schema.Types.ObjectId as any, ref: 'Project', required: true },
        organisationId:    { type: Schema.Types.ObjectId as any, ref: 'Organisation', required: true },
        name:              { type: String, required: true, trim: true },
        slug:              { type: String, required: true, lowercase: true, trim: true },
        description:       { type: String },
        color:             { type: String, default: '#0052CC' },
        isBaseEnvironment: { type: Boolean, default: false },
        createdBy:         { type: Schema.Types.ObjectId as any, ref: 'User', required: true },
    },
    { timestamps: true },
);

environmentSchema.index({ projectId: 1 });
environmentSchema.index({ organisationId: 1 });
environmentSchema.index({ projectId: 1, slug: 1 }, { unique: true });

export const EnvironmentModel = model<IEnvironmentSchema>('Environment', environmentSchema);
