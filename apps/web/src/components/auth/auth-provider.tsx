'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
    _id: string;
    name: string;
    email: string;
    role: string;
}

interface AuthContextValue {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    setAuth: (user: User, token: string) => void;
    clearAuth: () => void;
}

const AuthContext = createContext<AuthContextValue>({
    user: null,
    token: null,
    isLoading: true,
    setAuth: () => {},
    clearAuth: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Hydrate from localStorage on mount
        try {
            const stored = localStorage.getItem('vault_user');
            const storedToken = localStorage.getItem('vault_token');
            if (stored && storedToken) {
                setUser(JSON.parse(stored));
                setToken(storedToken);

                // Ensure cookie is synced for middleware visibility
                const secure = window.location.protocol === 'https:' ? '; Secure' : '';
                // Check if cookie exists, if not set it (or just always set it to refresh expiry)
                if (!document.cookie.includes('vault_token=')) {
                    document.cookie = `vault_token=${storedToken}; path=/; max-age=604800; SameSite=Lax${secure}`;
                }
            }
        } catch {
            // ignore parse errors
        } finally {
            setIsLoading(false);
        }
    }, []);

    const setAuth = (newUser: User, newToken: string) => {
        setUser(newUser);
        setToken(newToken);
        localStorage.setItem('vault_user', JSON.stringify(newUser));
        localStorage.setItem('vault_token', newToken);

        // Explicitly set cookie for middleware visibility during client-side navigation
        // path=/ ensures it's available across the whole app
        // SameSite=Lax is standard for auth cookies
        const secure = window.location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `vault_token=${newToken}; path=/; max-age=604800; SameSite=Lax${secure}`;
    };

    const clearAuth = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('vault_user');
        localStorage.removeItem('vault_token');
        document.cookie = 'vault_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    };

    return (
        <AuthContext.Provider value={{ user, token, isLoading, setAuth, clearAuth }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
