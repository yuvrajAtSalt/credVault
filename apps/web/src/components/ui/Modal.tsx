'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { Button } from './Button';

type ModalWidth = 'sm' | 'md' | 'lg';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    footer?: ReactNode;
    width?: ModalWidth;
}

const widthMap: Record<ModalWidth, number> = { sm: 400, md: 520, lg: 680 };

export function Modal({ isOpen, onClose, title, children, footer, width = 'md' }: ModalProps) {
    const dialogRef = useRef<HTMLDivElement>(null);

    // Close on Escape & Body scroll lock
    useEffect(() => {
        if (!isOpen) return;
        
        // Lock body scroll
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        
        return () => {
            window.removeEventListener('keydown', handler);
            // Restore body scroll
            document.body.style.overflow = originalOverflow;
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="vault-overlay"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
        >
            <div
                ref={dialogRef}
                className="vault-animate-in"
                style={{
                    background: 'var(--vault-bg)',
                    borderRadius: 'var(--vault-radius-lg)',
                    boxShadow: 'var(--vault-shadow-overlay)',
                    width: '100%',
                    maxWidth: widthMap[width],
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }}
            >
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--vault-border)',
                }}>
                    <h2 id="modal-title" style={{ fontSize: 16, fontWeight: 600, color: 'var(--vault-ink)', margin: 0 }}>
                        {title}
                    </h2>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--vault-ink-muted)', fontSize: 20, lineHeight: 1,
                            padding: '2px 6px', borderRadius: 4,
                        }}
                    >
                        ×
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div style={{
                        padding: '12px 20px',
                        borderTop: '1px solid var(--vault-border)',
                        display: 'flex', justifyContent: 'flex-end', gap: 8,
                    }}>
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
