import { z } from 'zod';
import { VAULT_ROLES } from '../utils/constants';

// ─── Project sub-document types ───────────────────────────────────────────────
const memberSchema = z.object({
    userId: z.string(),
    addedBy: z.string(),
    addedAt: z.date().optional(),
});

const visibilityGrantSchema = z.object({
    grantedTo: z.string(),
    grantedBy: z.string(),
    scope: z.enum(['all', 'own']),
    grantedAt: z.date().optional(),
});

export const projectSchemaType = z.object({
    _id: z.string().optional(),
    organisationId: z.string(),
    name: z.string().min(1),
    description: z.string().optional(),
    color: z.string().default('#0052CC'),
    tags: z.array(z.string()).default([]),
    status: z.enum(['active', 'archived', 'planning']).default('active'),
    createdBy: z.string(),
    members: z.array(memberSchema).default([]),
    visibilityGrants: z.array(visibilityGrantSchema).default([]),
    isDeleted: z.boolean().optional(),
});

export type IProjectSchema = z.infer<typeof projectSchemaType>;

export const createProjectSchema = z.object({
    name: z.string().min(1, 'Project name is required'),
    description: z.string().optional(),
    color: z.string().optional(),
    tags: z.array(z.string()).optional(),
    status: z.enum(['active', 'archived', 'planning']).optional(),
});

export type ICreateProjectSchema = z.infer<typeof createProjectSchema>;

export interface IProjectResponses {
    [key: string]: { statusCode: number; message: string };
}
