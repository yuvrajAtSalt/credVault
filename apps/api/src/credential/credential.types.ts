import { z } from 'zod';
import { VAULT_ROLES } from '../utils/constants';

export const CREDENTIAL_CATEGORIES = ['github', 'storage', 'database', 'smtp', 'deploy', 'custom'] as const;
export const CREDENTIAL_ENVIRONMENTS = ['staging', 'production', 'development', 'all'] as const;

export const credentialSchemaType = z.object({
    _id: z.string().optional(),
    projectId: z.string(),
    organisationId: z.string(),
    category: z.enum([...CREDENTIAL_CATEGORIES] as [string, ...string[]]),
    label: z.string().min(1),
    value: z.string().min(1),       // AES-256 encrypted at rest (Phase 03)
    isSecret: z.boolean().default(true),
    environment: z.enum([...CREDENTIAL_ENVIRONMENTS] as [string, ...string[]]).default('all'),
    expiresAt: z.date().optional().nullable(),
    rotationReminderDays: z.number().default(30),
    sensitivityLevel: z.enum(['normal', 'sensitive', 'critical']).default('normal'),
    revealReasons: z.array(z.object({
        userId: z.string(),
        reason: z.string(),
        at: z.date().optional(),
    })).default([]),
    addedBy: z.string(),
    addedByRole: z.enum([...VAULT_ROLES] as [string, ...string[]]),
    lastEditedBy: z.string().optional(),
    lastEditedAt: z.date().optional(),
    isDeleted: z.boolean().default(false),
});

export type ICredentialSchema = z.infer<typeof credentialSchemaType>;

export const createCredentialSchema = z.object({
    projectId: z.string().min(1, 'Project ID is required'),
    category: z.enum([...CREDENTIAL_CATEGORIES] as [string, ...string[]]),
    label: z.string().min(1, 'Label is required'),
    value: z.string().min(1, 'Value is required'),
    isSecret: z.boolean().optional(),
    environment: z.enum([...CREDENTIAL_ENVIRONMENTS] as [string, ...string[]]).optional(),
    expiresAt: z.string().datetime().optional().nullable(),
    rotationReminderDays: z.number().optional(),
    sensitivityLevel: z.enum(['normal', 'sensitive', 'critical']).optional(),
});

export type ICreateCredentialSchema = z.infer<typeof createCredentialSchema>;

export interface ICredentialResponses {
    [key: string]: { statusCode: number; message: string };
}
