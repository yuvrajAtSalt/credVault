import { z } from 'zod';

export const organisationSchemaType = z.object({
    _id: z.string().optional(),
    name: z.string().min(1),
    slug: z.string().min(1).toLowerCase(),
    logoUrl: z.string().optional(),
    hierarchy: z.array(z.string()).default([
        'ceo', 'coo', 'cfo', 'cmo', 'manager', 'devops', 'developer', 'qa',
    ]),
    createdBy: z.string().optional(),
    updatedBy: z.string().optional(),
    isDeleted: z.boolean().optional(),
});

export type IOrganisationSchema = z.infer<typeof organisationSchemaType>;

export const createOrgSchema = z.object({
    name: z.string().min(1, 'Organisation name is required'),
    slug: z.string().min(2, 'Slug must be at least 2 characters')
        .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
    logoUrl: z.string().url().optional(),
});

export type ICreateOrgSchema = z.infer<typeof createOrgSchema>;

export interface IOrganisationResponses {
    [key: string]: { statusCode: number; message: string };
}
