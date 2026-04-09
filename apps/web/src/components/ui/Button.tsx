'use client';

import { ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
    loading?: boolean;
    icon?: ReactNode;
    children?: ReactNode;
}

const variantClass: Record<Variant, string> = {
    primary:   'vault-btn vault-btn--primary',
    secondary: 'vault-btn vault-btn--secondary',
    ghost:     'vault-btn vault-btn--secondary',
    danger:    'vault-btn vault-btn--danger',
};

const sizeStyle: Record<Size, React.CSSProperties> = {
    sm: { padding: '4px 10px', fontSize: 12 },
    md: { padding: '6px 14px', fontSize: 13 },
    lg: { padding: '10px 20px', fontSize: 14 },
};

export function Button({
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    children,
    disabled,
    style,
    ...rest
}: ButtonProps) {
    return (
        <button
            suppressHydrationWarning
            className={variantClass[variant]}
            disabled={disabled || loading}
            style={{ ...sizeStyle[size], opacity: (disabled || loading) ? 0.6 : 1, ...style }}
            {...rest}
        >
            {loading ? (
                <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
            ) : icon ? (
                <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>
            ) : null}
            {children}
        </button>
    );
}
