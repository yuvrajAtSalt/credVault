import { model, Schema, Types } from 'mongoose';

export const NOTIFICATION_TYPES = [
    // Project
    'project.member_added', 'project.member_removed', 'project.archived', 'project.handover',
    // Credentials
    'credential.expiring_soon', 'credential.access_request', 'credential.access_granted', 'credential.access_rejected',
    // Permissions
    'permission.granted', 'permission.revoked', 'permission.expiring_soon',
    'permission_request.received', 'permission_request.approved', 'permission_request.rejected',
    // Team / org
    'team.assigned', 'team.lead_appointed', 'member.reporting_changed',
    // Account
    'account.password_reset', 'account.role_changed',
] as const;

export type NotificationType = typeof NOTIFICATION_TYPES[number];

export interface INotificationDocument {
    _id: any;
    organisationId: Types.ObjectId;
    userId: Types.ObjectId;
    type: NotificationType;
    title: string;
    body?: string;
    url: string;
    isRead: boolean;
    readAt?: Date | null;
    actorId?: Types.ObjectId | null;
    meta?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

const notificationSchema = new Schema<INotificationDocument>(
    {
        organisationId: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true },
        userId:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
        type:           { type: String, enum: NOTIFICATION_TYPES, required: true },
        title:          { type: String, required: true },
        body:           { type: String },
        url:            { type: String, required: true },
        isRead:         { type: Boolean, default: false },
        readAt:         { type: Date, default: null },
        actorId:        { type: Schema.Types.ObjectId, ref: 'User', default: null },
        meta:           { type: Schema.Types.Mixed },
    },
    { timestamps: true },
);

// Indexes for fast querying
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
// TTL — auto-delete after 90 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7_776_000 });

export const NotificationModel = model<INotificationDocument>('Notification', notificationSchema);
