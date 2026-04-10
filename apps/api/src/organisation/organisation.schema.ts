import { model, Schema } from 'mongoose';
import { IOrganisationSchema } from './organisation.types';

const organisationSchema = new Schema<IOrganisationSchema>(
    {
        name: { type: String, required: true, trim: true },
        slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
        logoUrl: { type: String },
        hierarchy: {
            type: [String],
            default: ['ceo', 'coo', 'cfo', 'cmo', 'manager', 'devops', 'developer', 'qa'],
        },
        isDeleted: { type: Boolean, default: false },
        accessReviewPolicy: {
            enabled: { type: Boolean, default: false },
            frequencyDays: { type: Number, default: 90 },
            reminderDaysBeforeDue: { type: Number, default: 7 },
            autoRevokeOnMiss: { type: Boolean, default: false },
        },
        credentialSharingPolicy: {
            allowEnvFileExport: { type: Boolean, default: true },
            allowCopyToClipboard: { type: Boolean, default: true },
            allowBulkExport: { type: Boolean, default: false },
            requireExportJustification: { type: Boolean, default: false },
            maxExportsPerDayPerUser: { type: Number, default: 0 },
            allowedExportRoles: { type: [String], default: [] },
            watermarkExports: { type: Boolean, default: false },
        },
    },
    { timestamps: true },
);


export const OrganisationModel = model<IOrganisationSchema>('Organisation', organisationSchema);
