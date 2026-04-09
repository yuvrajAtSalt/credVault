import { model, Schema } from 'mongoose';

export interface IOrgSnapshotSchema {
    _id?: any;
    organisationId: any;
    label: string;
    snapshot: any;
    createdBy: any;
    createdAt?: Date;
}

const orgSnapshotSchema = new Schema<IOrgSnapshotSchema>(
    {
        organisationId: { type: Schema.Types.ObjectId as any, ref: 'Organisation', required: true },
        label:          { type: String, required: true },
        snapshot:       { type: Schema.Types.Mixed },
        createdBy:      { type: Schema.Types.ObjectId as any, ref: 'User', required: true },
    },
    { timestamps: { createdAt: true, updatedAt: false } },
);

orgSnapshotSchema.index({ organisationId: 1, createdAt: -1 });

export const OrgSnapshotModel = model<IOrgSnapshotSchema>('OrgSnapshot', orgSnapshotSchema);
