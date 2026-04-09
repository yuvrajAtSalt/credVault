import { model, Schema, Types } from 'mongoose';

export interface IAccessReviewMember {
    userId: Types.ObjectId;
    name: string;
    role: string;
    addedAt: Date;
    visibilityScope: string;
    decision: 'approved' | 'removed' | 'pending';
    decidedBy?: Types.ObjectId | null;
    decidedAt?: Date | null;
    note?: string;
}

export interface IAccessReviewDocument {
    organisationId: Types.ObjectId;
    projectId: Types.ObjectId;
    initiatedBy: Types.ObjectId;
    status: 'pending' | 'in_progress' | 'completed' | 'overdue';
    dueDate: Date;
    completedAt?: Date | null;
    reviewPeriodDays: number;
    membersToReview: IAccessReviewMember[];
    createdAt: Date;
    updatedAt: Date;
}

const accessReviewMemberSchema = new Schema<IAccessReviewMember>({
    userId:          { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name:            { type: String, required: true },
    role:            { type: String, required: true },
    addedAt:         { type: Date, required: true },
    visibilityScope: { type: String, required: true },
    decision:        { type: String, enum: ['approved', 'removed', 'pending'], default: 'pending' },
    decidedBy:       { type: Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt:       { type: Date, default: null },
    note:            { type: String },
}, { _id: false });

const accessReviewSchema = new Schema<IAccessReviewDocument>(
    {
        organisationId:   { type: Schema.Types.ObjectId, ref: 'Organisation', required: true },
        projectId:        { type: Schema.Types.ObjectId, ref: 'Project', required: true },
        initiatedBy:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
        status:           { type: String, enum: ['pending', 'in_progress', 'completed', 'overdue'], default: 'pending' },
        dueDate:          { type: Date, required: true },
        completedAt:      { type: Date, default: null },
        reviewPeriodDays: { type: Number, required: true },
        membersToReview:  { type: [accessReviewMemberSchema], default: [] },
    },
    { timestamps: true },
);

accessReviewSchema.index({ organisationId: 1 });
accessReviewSchema.index({ projectId: 1 });
accessReviewSchema.index({ status: 1 });
accessReviewSchema.index({ dueDate: 1 });

export const AccessReviewModel = model<IAccessReviewDocument>('AccessReview', accessReviewSchema);
