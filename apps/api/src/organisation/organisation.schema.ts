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
    },
    { timestamps: true },
);


export const OrganisationModel = model<IOrganisationSchema>('Organisation', organisationSchema);
