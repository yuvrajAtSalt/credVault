import { model, Schema } from 'mongoose';

export interface ITeamSchema {
    _id?: any;
    organisationId: any;
    name: string;
    slug: string;
    description?: string;
    color: string;
    icon?: string;
    leadId?: any;
    parentTeamId?: any;
    createdBy: any;
    createdAt?: Date;
    updatedAt?: Date;
}

const teamSchema = new Schema<ITeamSchema>(
    {
        organisationId: { type: Schema.Types.ObjectId as any, ref: 'Organisation', required: true },
        name:           { type: String, required: true, trim: true },
        slug:           { type: String, required: true, lowercase: true, trim: true },
        description:    { type: String },
        color:          { type: String, default: '#0052CC' },
        icon:           { type: String },
        leadId:         { type: Schema.Types.ObjectId as any, ref: 'User', default: null },
        parentTeamId:   { type: Schema.Types.ObjectId as any, ref: 'Team', default: null },
        createdBy:      { type: Schema.Types.ObjectId as any, ref: 'User', required: true },
    },
    { timestamps: true },
);

teamSchema.index({ organisationId: 1 });
teamSchema.index({ leadId: 1 });
teamSchema.index({ parentTeamId: 1 });
teamSchema.index({ organisationId: 1, slug: 1 }, { unique: true });

export const TeamModel = model<ITeamSchema>('Team', teamSchema);
