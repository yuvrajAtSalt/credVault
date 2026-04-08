import { model, Schema } from 'mongoose';
import { IProjectSchema } from './project.types';

const memberSubSchema = new Schema(
    {
        userId:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
        addedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        addedAt: { type: Date, default: Date.now },
    },
    { _id: false },
);

const visibilityGrantSubSchema = new Schema(
    {
        grantedTo: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        grantedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        scope:     { type: String, enum: ['all', 'own'], required: true },
        grantedAt: { type: Date, default: Date.now },
    },
    { _id: false },
);

const projectSchema = new Schema<IProjectSchema>(
    {
        organisationId:   { type: Schema.Types.ObjectId as any, ref: 'Organisation', required: true },
        name:             { type: String, required: true, trim: true },
        description:      { type: String },
        color:            { type: String, default: '#0052CC' },
        tags:             { type: [String], default: [] },
        status:           { type: String, enum: ['active', 'archived', 'planning'], default: 'active' },
        createdBy:        { type: Schema.Types.ObjectId as any, ref: 'User', required: true },
        members:          { type: [memberSubSchema], default: [] },
        visibilityGrants: { type: [visibilityGrantSubSchema], default: [] },
        isDeleted:        { type: Boolean, default: false },
    },
    { timestamps: true },
);

projectSchema.index({ organisationId: 1 });
projectSchema.index({ 'members.userId': 1 });
projectSchema.index({ status: 1 });

export const ProjectModel = model<IProjectSchema>('Project', projectSchema);
