import { AuditLogModel } from './audit.schema';

export interface AuditQuery {
    organisationId: string;
    action?: string;
    actorId?: string;
    targetType?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
}

export const queryAuditLogs = async (q: AuditQuery) => {
    const { organisationId, action, actorId, targetType, from, to, page = 1, limit = 50 } = q;

    const filter: Record<string, any> = { organisationId };
    if (action)     filter.action     = action;
    if (actorId)    filter.actorId    = actorId;
    if (targetType) filter.targetType = targetType;
    if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = new Date(from);
        if (to)   filter.createdAt.$lte = new Date(to);
    }

    const skip  = (page - 1) * limit;
    const total = await AuditLogModel.countDocuments(filter);
    const logs  = await AuditLogModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('actorId', 'name email role avatarUrl')
        .lean()
        .exec();

    return { total, page, limit, pages: Math.ceil(total / limit), logs };
};
