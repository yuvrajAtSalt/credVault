import { Schema, model, Document, Types } from 'mongoose';

export interface IApprovalRequestDocument extends Document {
    organisationId: Types.ObjectId;
    projectId: Types.ObjectId;
    credentialId: Types.ObjectId;
    requesterId: Types.ObjectId;
    reason: string;
    status: 'pending' | 'approved' | 'rejected' | 'expired';
    approverId?: Types.ObjectId;
    decisionAt?: Date;
    decisionNote?: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const approvalRequestSchema = new Schema<IApprovalRequestDocument>(
    {
        organisationId: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true },
        projectId:      { type: Schema.Types.ObjectId, ref: 'Project', required: true },
        credentialId:   { type: Schema.Types.ObjectId, ref: 'Credential', required: true },
        requesterId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
        reason:         { type: String, required: true },
        status:         { type: String, enum: ['pending', 'approved', 'rejected', 'expired'], default: 'pending' },
        approverId:     { type: Schema.Types.ObjectId, ref: 'User' },
        decisionAt:     { type: Date },
        decisionNote:   { type: String },
        expiresAt:      { type: Date, required: true },
    },
    { timestamps: true }
);

approvalRequestSchema.index({ credentialId: 1, status: 1 });
approvalRequestSchema.index({ requesterId: 1 });

export const ApprovalRequestModel = model<IApprovalRequestDocument>('ApprovalRequest', approvalRequestSchema);
