import { API_BASE_URL } from './constants';

type ApiResponse<T = unknown> = {
    data: T | null;
    error: { message: string; code?: string } | null;
};

/**
 * Thin fetch wrapper — attaches the vault_token from localStorage as
 * Authorization header so API calls work even if the httpOnly cookie
 * isn't sent cross-origin.
 */
async function apiFetch<T = unknown>(
    path: string,
    options: RequestInit = {},
): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${path}`;

    // Attach Bearer token if stored
    const token = typeof window !== 'undefined'
        ? localStorage.getItem('vault_token')
        : null;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const res = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
    });

    const json = await res.json();

    if (!res.ok) {
        // Handle unauthorized access by clearing auth and redirecting
        if (res.status === 401 && typeof window !== 'undefined') {
            localStorage.removeItem('vault_user');
            localStorage.removeItem('vault_token');
            document.cookie = 'vault_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
            window.location.href = '/login';
            return { data: null, error: { message: 'Session expired. Please login again.' } };
        }
        return { data: null, error: json.error ?? { message: 'An unexpected error occurred.' } };
    }

    return { data: json.data ?? null, error: null };
}

export const api = {
    get: <T = unknown>(path: string, options?: RequestInit) =>
        apiFetch<T>(path, { ...options, method: 'GET' }),

    post: <T = unknown>(path: string, body: unknown, options?: RequestInit) =>
        apiFetch<T>(path, {
            ...options,
            method: 'POST',
            body: JSON.stringify(body),
        }),

    put: <T = unknown>(path: string, body: unknown, options?: RequestInit) =>
        apiFetch<T>(path, {
            ...options,
            method: 'PUT',
            body: JSON.stringify(body),
        }),

    patch: <T = unknown>(path: string, body: unknown, options?: RequestInit) =>
        apiFetch<T>(path, {
            ...options,
            method: 'PATCH',
            body: JSON.stringify(body),
        }),

    delete: <T = unknown>(path: string, options?: RequestInit) =>
        apiFetch<T>(path, { ...options, method: 'DELETE' }),
};
