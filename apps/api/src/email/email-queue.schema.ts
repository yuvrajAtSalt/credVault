import { model, Schema, Types } from 'mongoose';

export interface IEmailQueueDocument {
    _id: any;
    to: string;
    subject: string;
    html: string;
    text: string;
    status: 'pending' | 'sent' | 'failed';
    attempts: number;
    maxAttempts: number;
    lastAttemptAt?: Date;
    error?: string;
    createdAt: Date;
    updatedAt: Date;
}

const emailQueueSchema = new Schema<IEmailQueueDocument>(
    {
        to:          { type: String, required: true },
        subject:     { type: String, required: true },
        html:        { type: String, required: true },
        text:        { type: String, required: true },
        status:      { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
        attempts:    { type: Number, default: 0 },
        maxAttempts: { type: Number, default: 3 },
        lastAttemptAt: { type: Date },
        error:       { type: String },
    },
    { timestamps: true }
);

emailQueueSchema.index({ status: 1, createdAt: 1 });
// TTL — auto-delete sent emails after 7 days
emailQueueSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800, partialFilterExpression: { status: 'sent' } });
// In Mongoose, TTL indexes can't use partial expressions if we want them to delete only sent emails via index? Actually it works in newer Mongo versions.
// Alternatively, just auto delete all things after 7 days:
// emailQueueSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

export const EmailQueueModel = model<IEmailQueueDocument>('EmailQueue', emailQueueSchema);
