import { Schema, model, Document, Types } from 'mongoose';

export interface IChangeWindow extends Document {
    organisationId: Types.ObjectId;
    name: string;
    description?: string;
    dayOfWeek: number[]; // 0-6
    startTime: string;   // HH:mm
    endTime: string;     // HH:mm
    timezone: string;
    isActive: boolean;
    excludedProjectIds: Types.ObjectId[];
}

const changeWindowSchema = new Schema<IChangeWindow>({
    organisationId: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },
    name:           { type: String, required: true },
    description:    { type: String },
    dayOfWeek:      { type: [Number], required: true },
    startTime:      { type: String, required: true },
    endTime:        { type: String, required: true },
    timezone:       { type: String, default: 'UTC' },
    isActive:       { type: Boolean, default: true },
    excludedProjectIds: [{ type: Schema.Types.ObjectId, ref: 'Project' }],
}, { timestamps: true });

export const ChangeWindowModel = model<IChangeWindow>('ChangeWindow', changeWindowSchema);
