'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
    content: string;
    children: React.ReactNode;
    position?: 'top' | 'bottom' | 'left' | 'right';
    delay?: number;
}

export function Tooltip({ content, children, position = 'top', delay = 200 }: TooltipProps) {
    const [visible, setVisible] = useState(false);
    const [coords, setCoords]   = useState({ top: 0, left: 0 });
    const triggerRef            = useRef<HTMLDivElement>(null);
    const timerRef              = useRef<NodeJS.Timeout | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const show = () => {
        timerRef.current = setTimeout(() => {
            if (triggerRef.current) {
                const rect = triggerRef.current.getBoundingClientRect();
                let top = 0, left = 0;
                // Rough estimation (will refine visually via CSS transform)
                if (position === 'top') {
                    top = rect.top - 8;
                    left = rect.left + rect.width / 2;
                } else if (position === 'bottom') {
                    top = rect.bottom + 8;
                    left = rect.left + rect.width / 2;
                } else if (position === 'left') {
                    top = rect.top + rect.height / 2;
                    left = rect.left - 8;
                } else {
                    top = rect.top + rect.height / 2;
                    left = rect.right + 8;
                }
                setCoords({ top, left });
                setVisible(true);
            }
        }, delay);
    };

    const hide = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setVisible(false);
    };

    // Close on scroll or resize
    useEffect(() => {
        if (!visible) return;
        const handler = () => setVisible(false);
        window.addEventListener('scroll', handler, { passive: true });
        window.addEventListener('resize', handler, { passive: true });
        return () => {
            window.removeEventListener('scroll', handler);
            window.removeEventListener('resize', handler);
        };
    }, [visible]);

    const transformMap = {
        top: 'translate(-50%, -100%)',
        bottom: 'translate(-50%, 0)',
        left: 'translate(-100%, -50%)',
        right: 'translate(0, -50%)',
    };

    return (
        <>
            <div
                ref={triggerRef}
                onMouseEnter={show}
                onMouseLeave={hide}
                onFocus={show}
                onBlur={hide}
                style={{ display: 'inline-flex' }}
            >
                {children}
            </div>

            {mounted && visible && createPortal(
                <div style={{
                    position: 'fixed',
                    top: coords.top,
                    left: coords.left,
                    transform: transformMap[position],
                    zIndex: 220,
                    pointerEvents: 'none',
                    background: '#172B4D',
                    color: '#fff',
                    padding: '4px 8px',
                    borderRadius: 3,
                    fontSize: 11,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                    animation: 'vaultFadeIn 100ms ease-out',
                }}>
                    {content}
                </div>,
                document.body
            )}
        </>
    );
}
