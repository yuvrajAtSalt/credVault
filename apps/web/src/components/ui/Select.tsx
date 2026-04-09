'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface SelectOption {
    label: string;
    value: string;
    color?: string; // used for badges
    icon?: string;
}

interface SelectProps {
    value: string;
    options: SelectOption[];
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    style?: React.CSSProperties;
    renderOption?: (opt: SelectOption) => React.ReactNode;
}

export function Select({ value, options, onChange, placeholder = 'Select…', disabled, style, renderOption }: SelectProps) {
    const [open, setOpen] = useState(false);
    const triggerRef      = useRef<HTMLButtonElement>(null);
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    const selectedOpt = options.find((o) => o.value === value);

    const handleOpen = () => {
        if (disabled) return;
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom + window.scrollY + 4,
                left: rect.left + window.scrollX,
                width: rect.width,
            });
        }
        setOpen(true);
    };

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
                // We'll close it, but if they clicked the portal itself, we need a special check.
                // We can just rely on a backdrop overlay for simplicity.
            }
        };
        document.addEventListener('mousedown', handler);
        // Also close on scroll
        const scrollHandler = () => setOpen(false);
        window.addEventListener('scroll', scrollHandler, { passive: true });
        
        return () => {
             document.removeEventListener('mousedown', handler);
             window.removeEventListener('scroll', scrollHandler);
        };
    }, [open]);

    // Render helper
    const defaultRender = (opt: SelectOption) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {opt.color && (
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: opt.color }} />
            )}
            {opt.icon && <span>{opt.icon}</span>}
            {opt.label}
        </span>
    );

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                suppressHydrationWarning
                onClick={() => setOpen((prev) => !prev)}
                disabled={disabled}
                className="vault-input"
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    background: disabled ? 'var(--vault-surface)' : 'var(--vault-bg)',
                    color: selectedOpt ? 'var(--vault-ink)' : 'var(--vault-ink-subtle)',
                    textAlign: 'left',
                    ...style,
                }}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedOpt ? (renderOption ? renderOption(selectedOpt) : defaultRender(selectedOpt)) : placeholder}
                </span>
                <span style={{ fontSize: 10, color: 'var(--vault-ink-muted)', marginLeft: 8 }}>▼</span>
            </button>

            {mounted && open && createPortal(
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 300 }} onClick={() => setOpen(false)} />
                    <div
                        className="vault-animate-in"
                        style={{
                            position: 'absolute',
                            top: coords.top, left: coords.left, width: coords.width,
                            maxHeight: 240, overflowY: 'auto',
                            background: 'var(--vault-bg)',
                            border: '1px solid var(--vault-border)',
                            borderRadius: 'var(--vault-radius-sm)',
                            boxShadow: 'var(--vault-shadow-overlay)',
                            zIndex: 301,
                            padding: '4px 0',
                        }}
                    >
                        {options.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => { onChange(opt.value); setOpen(false); }}
                                style={{
                                    display: 'flex', alignItems: 'center', width: '100%',
                                    padding: '8px 12px', border: 'none', background: 'none',
                                    cursor: 'pointer', fontSize: 13, color: 'var(--vault-ink)',
                                    textAlign: 'left',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--vault-primary-light)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                            >
                                {renderOption ? renderOption(opt) : defaultRender(opt)}
                                {value === opt.value && (
                                    <span style={{ marginLeft: 'auto', color: 'var(--vault-primary)' }}>✓</span>
                                )}
                            </button>
                        ))}
                    </div>
                </>,
                document.body
            )}
        </>
    );
}
