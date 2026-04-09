'use client';

import { useState } from 'react';

interface ToggleProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    label?: string;
    description?: string;
}

export function Toggle({ checked, onChange, disabled, label, description }: ToggleProps) {
    const [focused, setFocused] = useState(false);

    return (
        <label
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1,
            }}
        >
            <div style={{ position: 'relative', width: 36, height: 20, flexShrink: 0 }}>
                <input
                    suppressHydrationWarning
                    type="checkbox"
                    className="vault-sr-only"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    disabled={disabled}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                />
                <div style={{
                    position: 'absolute', inset: 0,
                    background: checked ? 'var(--vault-success)' : 'var(--vault-tag-bg)',
                    borderRadius: 10,
                    transition: 'background 200ms',
                    boxShadow: focused ? '0 0 0 3px rgba(0,82,204,0.3)' : 'none',
                }} />
                <div style={{
                    position: 'absolute', top: 2, left: checked ? 18 : 2,
                    width: 16, height: 16, borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 200ms cubic-bezier(0.2, 0.8, 0.2, 1)',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                }} />
            </div>
            {(label || description) && (
                <div>
                    {label && <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: 'var(--vault-ink)' }}>{label}</p>}
                    {description && <p style={{ fontSize: 12, color: 'var(--vault-ink-muted)', margin: 0 }}>{description}</p>}
                </div>
            )}
        </label>
    );
}
