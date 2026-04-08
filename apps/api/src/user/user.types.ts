import { z } from 'zod';

// ─── Zod schema (single source of truth) ─────────────────────────────────────
export const userSchemaType = z.object({
    _id: z.string().optional(),
    name: z.string(),
    email: z.string().email(),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    role: z.string().optional(),       // VaultStack role (e.g. SYSADMIN, MANAGER, DEVELOPER…)
    isActive: z.boolean().default(true).optional(),
    createdBy: z.string().trim().min(1).optional(),
    updatedBy: z.string().trim().min(1).optional(),
    isDeleted: z.boolean().optional(),
});

export type IuserSchema = z.infer<typeof userSchemaType>;

// ─── Create / update schemas ──────────────────────────────────────────────────
export const createUserSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    role: z.string().optional(),
});

export type ICreateUserSchema = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
    name: z.string().min(1).optional(),
    isActive: z.boolean().optional(),
});

export type IuserUpdateSchema = z.infer<typeof updateUserSchema>;

// ─── Responses interface ──────────────────────────────────────────────────────
export interface IUserResponses {
    [key: string]: {
        statusCode: number;
        message: string;
    };
}
