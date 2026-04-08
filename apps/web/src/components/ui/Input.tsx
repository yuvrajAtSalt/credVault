'use client';

import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, hint, id, style, ...rest }, ref) => {
        const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {label && (
                    <label htmlFor={inputId} style={{ fontSize: 13, fontWeight: 600, color: 'var(--vault-ink)' }}>
                        {label}
                    </label>
                )}
                <input
                    id={inputId}
                    ref={ref}
                    className="vault-input"
                    style={{
                        borderColor: error ? 'var(--vault-danger)' : undefined,
                        ...style,
                    }}
                    {...rest}
                />
                {error && <p style={{ fontSize: 12, color: 'var(--vault-danger)', margin: 0 }}>{error}</p>}
                {hint && !error && <p style={{ fontSize: 12, color: 'var(--vault-ink-muted)', margin: 0 }}>{hint}</p>}
            </div>
        );
    },
);
Input.displayName = 'Input';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
    options: { value: string; label: string }[];
}

export function Select({ label, error, options, id, ...rest }: SelectProps) {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {label && (
                <label htmlFor={selectId} style={{ fontSize: 13, fontWeight: 600, color: 'var(--vault-ink)' }}>
                    {label}
                </label>
            )}
            <select
                id={selectId}
                className="vault-input"
                style={{ borderColor: error ? 'var(--vault-danger)' : undefined, cursor: 'pointer' }}
                {...rest}
            >
                {options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>
            {error && <p style={{ fontSize: 12, color: 'var(--vault-danger)', margin: 0 }}>{error}</p>}
        </div>
    );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
}

export function Textarea({ label, error, id, ...rest }: TextareaProps) {
    const taId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {label && (
                <label htmlFor={taId} style={{ fontSize: 13, fontWeight: 600, color: 'var(--vault-ink)' }}>
                    {label}
                </label>
            )}
            <textarea
                id={taId}
                className="vault-input"
                rows={3}
                style={{ resize: 'vertical', borderColor: error ? 'var(--vault-danger)' : undefined }}
                {...rest}
            />
            {error && <p style={{ fontSize: 12, color: 'var(--vault-danger)', margin: 0 }}>{error}</p>}
        </div>
    );
}
