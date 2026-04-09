'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

const SWATCHES = [
    '#FF5630', '#FFAB00', '#36B37E', '#00B8D9', '#0052CC', '#6554C0',
    '#BF2600', '#FF8B00', '#006644', '#008DA6', '#0747A6', '#403294',
    '#FF8F73', '#FFE380', '#79F2C0', '#79E2F2', '#B3D4FF', '#C0B6F2',
    '#172B4D', '#5E6C84', '#97A0AF', '#DFE1E6', '#EBECF0', '#F4F5F7',
];

interface ColorPickerProps {
    color: string;
    onChange: (color: string) => void;
    disabled?: boolean;
}

export function ColorPicker({ color, onChange, disabled }: ColorPickerProps) {
    const [open, setOpen] = useState(false);
    const triggerRef      = useRef<HTMLButtonElement>(null);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    const handleOpen = () => {
        if (disabled) return;
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom + window.scrollY + 8,
                left: rect.left + window.scrollX,
            });
        }
        setOpen(true);
    };

    useEffect(() => {
        if (!open) return;
        const scrollHandler = () => setOpen(false);
        window.addEventListener('scroll', scrollHandler, { passive: true });
        return () => window.removeEventListener('scroll', scrollHandler);
    }, [open]);

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={handleOpen}
                disabled={disabled}
                aria-label="Pick color"
                title="Pick color"
                style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: color || 'var(--vault-surface)',
                    border: '2px solid var(--vault-bg)',
                    boxShadow: '0 0 0 1px var(--vault-border-strong)',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.6 : 1,
                    transition: 'transform 100ms',
                }}
                onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.transform = 'scale(1.1)'; }}
                onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.transform = 'scale(1)'; }}
            />

            {mounted && open && createPortal(
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 300 }} onClick={() => setOpen(false)} />
                    <div
                        className="vault-animate-in"
                        style={{
                            position: 'absolute',
                            top: coords.top, left: coords.left,
                            width: 216,
                            background: 'var(--vault-bg)',
                            border: '1px solid var(--vault-border)',
                            borderRadius: 'var(--vault-radius-md)',
                            boxShadow: 'var(--vault-shadow-overlay)',
                            zIndex: 301,
                            padding: 12,
                            display: 'grid',
                            gridTemplateColumns: 'repeat(6, 1fr)',
                            gap: 6,
                        }}
                    >
                        {SWATCHES.map((swatch) => (
                            <button
                                key={swatch}
                                type="button"
                                onClick={() => { onChange(swatch); setOpen(false); }}
                                aria-label={`Select color ${swatch}`}
                                style={{
                                    width: 24, height: 24, borderRadius: 4,
                                    background: swatch, border: 'none', cursor: 'pointer',
                                    boxShadow: color === swatch ? '0 0 0 2px var(--vault-bg), 0 0 0 4px var(--vault-primary)' : 'inset 0 0 0 1px rgba(0,0,0,0.1)',
                                }}
                            />
                        ))}
                    </div>
                </>,
                document.body
            )}
        </>
    );
}
