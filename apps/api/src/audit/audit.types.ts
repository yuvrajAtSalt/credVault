import { z } from 'zod';
import { VAULT_ROLES } from '../utils/constants';

export const AUDIT_ACTIONS = [
    'credential.view',
    'credential.create',
    'credential.delete',
    'project.create',
    'member.invite',
    'member.remove',
    'visibility.grant',
    'visibility.revoke',
    'login',
    'logout',
] as const;

export const auditLogSchemaType = z.object({
    _id: z.string().optional(),
    organisationId: z.string(),
    actorId: z.string(),
    action: z.enum([...AUDIT_ACTIONS] as [string, ...string[]]),
    targetType: z.string().optional(),   // 'Credential' | 'Project' | 'User'
    targetId: z.string().optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
    ipAddress: z.string().optional(),
});

export type IAuditLogSchema = z.infer<typeof auditLogSchemaType>;

export interface IAuditLogResponses {
    [key: string]: { statusCode: number; message: string };
}
