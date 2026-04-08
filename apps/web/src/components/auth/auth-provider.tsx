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
    };

    const clearAuth = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('vault_user');
        localStorage.removeItem('vault_token');
    };

    return (
        <AuthContext.Provider value={{ user, token, isLoading, setAuth, clearAuth }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
