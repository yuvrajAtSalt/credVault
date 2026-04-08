'use client';

import { useAuth } from '@/components/auth/auth-provider';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { API_BASE_URL } from '@/lib/constants';

export function useAuthActions() {
    const { clearAuth, token } = useAuth();
    const router = useRouter();

    const logout = useCallback(async () => {
        try {
            await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            });
        } catch {
            // best-effort
        } finally {
            clearAuth();
            router.replace('/login');
        }
    }, [clearAuth, router, token]);

    return { logout };
}
