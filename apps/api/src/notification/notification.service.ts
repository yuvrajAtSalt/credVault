import { Types } from 'mongoose';
import { NotificationModel, NotificationType } from './notification.schema';
import { UserModel } from '../user/user.schema';
import { pushToUser } from '../sse/sse';

// ─── Preference mapping ────────────────────────────────────────────────────────
// Maps each notification type to the user's preference key that controls it
const PREF_MAP: Partial<Record<NotificationType, string>> = {
    'project.member_added':        'projectInvitations',
    'project.member_removed':      'projectRemovals',
    'credential.expiring_soon':    'credentialExpiry',
    'permission_request.received': 'permissionRequests',
    'permission_request.approved': 'permissionRequests',
    'permission_request.rejected': 'permissionRequests',
    'permission.granted':          'permissionRequests',
    'permission.revoked':          'permissionRequests',
    'account.role_changed':        'roleChanges',
    'member.reporting_changed':    'reportingChanges',
    'team.assigned':               'roleChanges',
    'team.lead_appointed':         'roleChanges',
};

// ─── createNotification ────────────────────────────────────────────────────────
export async function createNotification(params: {
    organisationId: string;
    userId: string | string[];
    type: NotificationType;
    title: string;
    body?: string;
    url: string;
    actorId?: string;
    meta?: Record<string, unknown>;
}): Promise<void> {
    const userIds = Array.isArray(params.userId) ? params.userId : [params.userId];
    const prefKey = PREF_MAP[params.type];

    const docs = [];

    for (const uid of userIds) {
        // Check user's notification preference before inserting
        if (prefKey) {
            try {
                const user = await UserModel.findById(uid).select('notificationPreferences').lean();
                const prefs = (user as any)?.notificationPreferences;
                if (prefs && prefs[prefKey] === false) continue; // opted out
            } catch {
                // If preference check fails, still send the notification
            }
        }

        docs.push({
            organisationId: new Types.ObjectId(params.organisationId),
            userId:         new Types.ObjectId(uid),
            type:           params.type,
            title:          params.title,
            body:           params.body,
            url:            params.url,
            actorId:        params.actorId ? new Types.ObjectId(params.actorId) : null,
            meta:           params.meta,
        });
    }

    if (docs.length > 0) {
        const inserted = await NotificationModel.insertMany(docs);
        // Push SSE event to users
        inserted.forEach((doc) => {
            pushToUser(String(doc.userId), {
                type: 'new_notification',
                data: doc
            });
        });
    }
}

// ─── buildNotificationUrl ──────────────────────────────────────────────────────
export function buildNotificationUrl(type: NotificationType, meta: Record<string, unknown>): string {
    switch (type) {
        case 'project.member_added':
        case 'project.member_removed':
        case 'project.archived':
        case 'project.handover':
        case 'credential.expiring_soon':
        case 'credential.access_request':
        case 'credential.access_granted':
        case 'credential.access_rejected':
            return meta.projectId ? `/projects/${meta.projectId}` : '/projects';
        case 'permission.granted':
        case 'permission.revoked':
        case 'permission.expiring_soon':
        case 'permission_request.received':
        case 'permission_request.approved':
        case 'permission_request.rejected':
            return '/settings/permissions/requests';
        case 'team.assigned':
        case 'team.lead_appointed':
        case 'member.reporting_changed':
            return '/team';
        case 'account.password_reset':
            return '/settings/profile';
        case 'account.role_changed':
            return '/settings/profile';
        default:
            return '/dashboard';
    }
}

// ─── listNotifications ─────────────────────────────────────────────────────────
export async function listNotifications(userId: string, opts: { read?: boolean; page?: number; limit?: number } = {}) {
    const filter: any = { userId };
    if (opts.read === false) filter.isRead = false;

    const page  = opts.page ?? 1;
    const limit = opts.limit ?? 20;
    const skip  = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
        NotificationModel.find(filter)
            .populate('actorId', 'name avatarUrl')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        NotificationModel.countDocuments(filter),
        NotificationModel.countDocuments({ userId, isRead: false }),
    ]);

    return { notifications, total, pages: Math.ceil(total / limit), unreadCount };
}

// ─── markRead ─────────────────────────────────────────────────────────────────
export async function markRead(userId: string, ids?: string[], all?: boolean) {
    const filter: any = { userId };
    if (!all && ids?.length) filter._id = { $in: ids.map((id) => new Types.ObjectId(id)) };
    await NotificationModel.updateMany(filter, { isRead: true, readAt: new Date() });
}

// ─── deleteNotification ───────────────────────────────────────────────────────
export async function deleteNotification(userId: string, notifId: string) {
    await NotificationModel.deleteOne({ _id: notifId, userId });
}

// ─── getUnreadCount ───────────────────────────────────────────────────────────
export async function getUnreadCount(userId: string): Promise<number> {
    return NotificationModel.countDocuments({ userId, isRead: false });
}

export default { createNotification, buildNotificationUrl, listNotifications, markRead, deleteNotification, getUnreadCount };
