'use client';

import { useMemo } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { BASE_PERMISSIONS, VaultRole } from '@/lib/constants';
import { api } from '@/lib/api';
import useSWR from 'swr';

// SWR fetcher using the existing api helper
const fetcher = (url: string) => api.get<any>(url).then((r) => r.data);

export function usePermissions() {
    const { user } = useAuth();

    // Fetch resolved effective permissions from the API (includes special grants/expiry)
    const { data: permData } = useSWR(
        user ? '/api/v1/auth/me/permissions' : null,
        fetcher,
        { refreshInterval: 60_000, revalidateOnFocus: false },
    );

    const perms = useMemo(() => {
        // Use server-resolved permissions if available, else fall back to static BASE_PERMISSIONS
        if (permData?.effectivePermissions) return permData.effectivePermissions as Record<string, boolean>;
        const role = user?.role as VaultRole;
        return role ? (BASE_PERMISSIONS[role] as Record<string, boolean>) : null;
    }, [permData, user]);

    const bool = (key: string) => perms?.[key] ?? false;

    return {
        role:                  user?.role as VaultRole | null,
        forcePasswordChange:   permData?.forcePasswordChange ?? false,
        effectivePermissions:  perms,
        // ── Project ──────────────────────────────────────────────────────────
        isGod:                () => bool('isGod'),
        canSeeAllProjects:    () => bool('canSeeAllProjects'),
        canCreateProject:     () => bool('canCreateProject'),
        // ── Credential ───────────────────────────────────────────────────────
        canAddCredential:     () => bool('canAddCredential'),
        canGrantVisibility:   () => bool('canGrantVisibility'),
        canSeeAllCredentials: () => bool('canSeeAllCredentials'),
        // ── Team ─────────────────────────────────────────────────────────────
        canManageTeam:        () => bool('canManageTeam'),
        // ── Admin ─────────────────────────────────────────────────────────────
        canManageRoles:       () => bool('canManageRoles'),
        canManageMembers:     () => bool('canManageMembers'),
        canViewAuditLog:      () => bool('canViewAuditLog'),
        canManageOrgSettings: () => bool('canManageOrgSettings'),
    };
}
