import { AuditLogModel } from './audit.schema';
import { IAuditLogSchema, AUDIT_ACTIONS } from './audit.types';

export type AuditEntry = {
    organisationId?: string;
    actorId: string;
    action: (typeof AUDIT_ACTIONS)[number];
    targetType?: string;
    targetId?: string;
    meta?: Record<string, unknown>;
    ipAddress?: string;
};

export const writeAuditLog = async (entry: AuditEntry) => {
    await AuditLogModel.create(entry);
};

export const findAuditLogs = (orgId: string, limit = 100) =>
    AuditLogModel.find({ organisationId: orgId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('actorId', 'name email role')
        .exec();

export default { writeAuditLog, findAuditLogs };
