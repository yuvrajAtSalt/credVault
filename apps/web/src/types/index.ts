import { VaultRole } from '@/lib/constants';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
    _id: string;
    name: string;
    email: string;
    role: VaultRole;
    organisationId: string;
    avatarUrl?: string;
}

export interface LoginResponse {
    user: AuthUser;
    token: string;
    refreshToken: string;
}

// ─── Organisation ─────────────────────────────────────────────────────────────

export interface Organisation {
    _id: string;
    name: string;
    slug: string;
    logoUrl?: string;
    hierarchy: string[];
    createdAt: string;
    updatedAt: string;
}

// ─── User (Team Member) ───────────────────────────────────────────────────────

export interface User {
    _id: string;
    organisationId: string;
    name: string;
    email: string;
    role: VaultRole;
    jobTitle?: string;
    department?: string;
    avatarUrl?: string;
    reportingTo?: string | null;
    isActive: boolean;
    invitedBy?: string | null;
    lastLoginAt?: string | null;
    createdAt: string;
    updatedAt: string;
}

// ─── Project ─────────────────────────────────────────────────────────────────

export type ProjectStatus = 'active' | 'archived' | 'planning';

export interface ProjectMember {
    userId: string;
    addedBy: string;
    addedAt: string;
}

export interface VisibilityGrant {
    grantedTo: string;
    grantedBy: string;
    scope: 'all' | 'own';
    grantedAt: string;
}

export interface Project {
    _id: string;
    organisationId: string;
    name: string;
    description?: string;
    color: string;
    tags: string[];
    status: ProjectStatus;
    createdBy: string;
    members: ProjectMember[];
    visibilityGrants: VisibilityGrant[];
    isDeleted: boolean;
    createdAt: string;
    updatedAt: string;
}

// ─── Credential ───────────────────────────────────────────────────────────────

export type CredentialCategory =
    | 'github'
    | 'storage'
    | 'database'
    | 'smtp'
    | 'deploy'
    | 'custom';

export type CredentialEnvironment =
    | 'staging'
    | 'production'
    | 'development'
    | 'all';

export interface Credential {
    _id: string;
    projectId: string;
    organisationId: string;
    category: CredentialCategory;
    label: string;
    value: string;
    isSecret: boolean;
    environment: CredentialEnvironment;
    addedBy: string;
    addedByRole: VaultRole;
    lastEditedBy?: string;
    lastEditedAt?: string;
    isDeleted: boolean;
    createdAt: string;
    updatedAt: string;
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export type AuditAction =
    | 'credential.view'
    | 'credential.create'
    | 'credential.delete'
    | 'project.create'
    | 'member.invite'
    | 'member.remove'
    | 'visibility.grant'
    | 'visibility.revoke'
    | 'login'
    | 'logout';

export interface AuditLog {
    _id: string;
    organisationId: string;
    actorId: string;
    action: AuditAction;
    targetType?: string;
    targetId?: string;
    meta?: Record<string, unknown>;
    ipAddress?: string;
    createdAt: string;
}

// ─── API generic wrapper ──────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
}
