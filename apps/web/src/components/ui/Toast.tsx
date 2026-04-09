'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface Toast {
    id: string;
    message: string;
    variant: ToastVariant;
}

interface ToastContextValue {
    toast: {
        success: (msg: string) => void;
        error:   (msg: string) => void;
        info:    (msg: string) => void;
        warning: (msg: string) => void;
    };
}

const ToastContext = createContext<ToastContextValue>({
    toast: { success: () => {}, error: () => {}, info: () => {}, warning: () => {} },
});

const COLORS: Record<ToastVariant, { bg: string; border: string; icon: string }> = {
    success: { bg: '#0f2a1e', border: 'var(--vault-success)',  icon: '✓' },
    error:   { bg: '#2a0f0f', border: 'var(--vault-danger)',   icon: '✕' },
    info:    { bg: '#0f1e2a', border: 'var(--vault-primary)',  icon: 'ℹ' },
    warning: { bg: '#2a1e0f', border: '#f59e0b',               icon: '⚠' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, variant: ToastVariant) => {
        const id = Math.random().toString(36).slice(2);
        setToasts((prev) => [...prev, { id, message, variant }]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
    }, []);

    const toast = {
        success: (msg: string) => addToast(msg, 'success'),
        error:   (msg: string) => addToast(msg, 'error'),
        info:    (msg: string) => addToast(msg, 'info'),
        warning: (msg: string) => addToast(msg, 'warning'),
    };

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}

            {/* ── Toast Stack ──────────────────────────────────────────── */}
            <div style={{
                position: 'fixed',
                bottom: '24px',
                right: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                zIndex: 9999,
                pointerEvents: 'none',
            }}>
                {toasts.map((t) => {
                    const c = COLORS[t.variant];
                    return (
                        <div
                            key={t.id}
                            style={{
                                background: c.bg,
                                border: `1px solid ${c.border}`,
                                borderLeft: `3px solid ${c.border}`,
                                borderRadius: 'var(--vault-radius)',
                                padding: '10px 14px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                minWidth: '260px',
                                maxWidth: '380px',
                                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                                animation: 'toastIn 180ms ease',
                                pointerEvents: 'all',
                            }}
                        >
                            <span style={{ color: c.border, fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>
                                {c.icon}
                            </span>
                            <span style={{ color: 'var(--vault-ink)', fontSize: '13px', lineHeight: 1.4 }}>
                                {t.message}
                            </span>
                        </div>
                    );
                })}
            </div>

            <style>{`
                @keyframes toastIn {
                    from { opacity: 0; transform: translateX(20px); }
                    to   { opacity: 1; transform: translateX(0);    }
                }
            `}</style>
        </ToastContext.Provider>
    );
}

export const useToast = () => useContext(ToastContext);
