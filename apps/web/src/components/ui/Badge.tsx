'use client';

import { VaultRole, ROLE_COLORS, ROLE_LABELS } from '@/lib/constants';

type GenericVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'blue';

interface BadgeProps {
    role?: VaultRole;
    variant?: GenericVariant;
    children?: React.ReactNode;
    className?: string;
}

const variantClass: Record<GenericVariant, string> = {
    success: 'vault-badge vault-badge--green',
    warning: 'vault-badge vault-badge--yellow',
    danger:  'vault-badge vault-badge--red',
    info:    'vault-badge vault-badge--blue',
    neutral: 'vault-badge vault-badge--grey',
    blue:    'vault-badge vault-badge--blue',
};

export function Badge({ role, variant = 'neutral', children, className }: BadgeProps) {
    if (role) {
        const roleClass = ROLE_COLORS[role] ?? 'vault-role--qa';
        return (
            <span className={`vault-role-badge ${roleClass} ${className ?? ''}`}>
                {ROLE_LABELS[role] ?? role}
            </span>
        );
    }
    return (
        <span className={`${variantClass[variant]} ${className ?? ''}`}>
            {children}
        </span>
    );
}
