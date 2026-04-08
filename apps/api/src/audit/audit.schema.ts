import { model, Schema } from 'mongoose';
import { IAuditLogSchema, AUDIT_ACTIONS } from './audit.types';

const auditLogSchema = new Schema<IAuditLogSchema>(
    {
        organisationId: { type: Schema.Types.ObjectId as any, ref: 'Organisation' },
        actorId:        { type: Schema.Types.ObjectId as any, ref: 'User', required: true },
        action:         { type: String, enum: AUDIT_ACTIONS, required: true },
        targetType:     { type: String },
        targetId:       { type: Schema.Types.ObjectId as any },
        meta:           { type: Schema.Types.Mixed },
        ipAddress:      { type: String },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },  // audit logs are immutable
    },
);

auditLogSchema.index({ organisationId: 1 });
auditLogSchema.index({ actorId: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ createdAt: -1 });

export const AuditLogModel = model<IAuditLogSchema>('AuditLog', auditLogSchema);
