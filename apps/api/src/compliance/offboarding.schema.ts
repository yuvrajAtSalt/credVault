import { model, Schema, Types } from 'mongoose';

export interface IOffboardingStep {
    id: string;
    label: string;
    description: string;
    status: 'pending' | 'completed' | 'skipped';
    completedBy?: Types.ObjectId | null;
    completedAt?: Date | null;
    note?: string;
    meta?: any;
}

export interface ICredentialAuditItem {
    credentialId: Types.ObjectId;
    projectName: string;
    label: string;
    category: string;
    action: 'retain' | 'reassign' | 'delete' | 'pending';
    actionBy?: Types.ObjectId | null;
    assigneeId?: Types.ObjectId | null;
}

export interface IOffboardingChecklistDocument {
    organisationId: Types.ObjectId;
    userId: Types.ObjectId;
    initiatedBy: Types.ObjectId;
    targetDate: Date;
    status: 'in_progress' | 'completed';
    steps: IOffboardingStep[];
    credentialAudit: ICredentialAuditItem[];
    createdAt: Date;
    updatedAt: Date;
}

const offboardingStepSchema = new Schema<IOffboardingStep>({
    id:          { type: String, required: true },
    label:       { type: String, required: true },
    description: { type: String, required: true },
    status:      { type: String, enum: ['pending', 'completed', 'skipped'], default: 'pending' },
    completedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    completedAt: { type: Date, default: null },
    note:        { type: String },
    meta:        { type: Schema.Types.Mixed },
}, { _id: false });

const credentialAuditItemSchema = new Schema<ICredentialAuditItem>({
    credentialId: { type: Schema.Types.ObjectId, ref: 'Credential', required: true },
    projectName:  { type: String, required: true },
    label:        { type: String, required: true },
    category:     { type: String, required: true },
    action:       { type: String, enum: ['retain', 'reassign', 'delete', 'pending'], default: 'pending' },
    actionBy:     { type: Schema.Types.ObjectId, ref: 'User', default: null },
    assigneeId:   { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { _id: false });

const offboardingChecklistSchema = new Schema<IOffboardingChecklistDocument>(
    {
        organisationId: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true },
        userId:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
        initiatedBy:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
        targetDate:     { type: Date, required: true },
        status:         { type: String, enum: ['in_progress', 'completed'], default: 'in_progress' },
        steps:          { type: [offboardingStepSchema], default: [] },
        credentialAudit: { type: [credentialAuditItemSchema], default: [] },
    },
    { timestamps: true },
);

offboardingChecklistSchema.index({ organisationId: 1 });
offboardingChecklistSchema.index({ userId: 1 });
offboardingChecklistSchema.index({ status: 1 });

export const OffboardingChecklistModel = model<IOffboardingChecklistDocument>('OffboardingChecklist', offboardingChecklistSchema);
