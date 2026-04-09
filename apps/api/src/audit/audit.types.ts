import { z } from 'zod';
import { VAULT_ROLES } from '../utils/constants';

export const AUDIT_ACTIONS = [
    'credential.view',
    'credential.create',
    'credential.update',
    'credential.delete',
    'project.create',
    'project.update',
    'project.delete',
    'member.invite',
    'member.update',
    'member.remove',
    'member.deactivate',
    'visibility.grant',
    'visibility.revoke',
    'login',
    'logout',
    'envvar.create',
    'envvar.edit',
    'envvar.delete',
    'envvar.reveal',
    'envvar.export',
    'environment.create',
    'environment.delete',
    'environment.clone',
    'team.create',
    'team.update',
    'team.delete',
    'team.lead_changed',
    'member.reporting_changed',
    'member.team_assigned',
    'org.snapshot_saved',
    // ─── Phase 09 ────────────────────────────────────────────────────────────
    'user.created',
    'user.updated',
    'user.deactivated',
    'user.reactivated',
    'role.created',
    'role.updated',
    'role.deleted',
    'permission.granted',
    'permission.revoked',
    'permission.expired',
    'permission_request.submitted',
    'permission_request.approved',
    'permission_request.rejected',
    // ─── Phase 10 ────────────────────────────────────────────────────────────
    'member.type_changed',
    'project.archived',
    'project.reactivated',
    'project.handover',
    'credential.expiry_set',
    'credential.reveal_critical',
    'credential.category_added',
    'visibility.residual_revoked',
    'bulk.team_assign',
    'bulk.role_change',
    'bulk.deactivate',
    'account.password_reset_self',
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
