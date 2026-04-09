'use client';

interface SkeletonProps {
    variant?: 'text' | 'card' | 'avatar' | 'row';
    lines?: number;
    width?: string | number;
    height?: string | number;
    style?: React.CSSProperties;
}

const PULSE_STYLE: React.CSSProperties = {
    background: 'linear-gradient(90deg, var(--vault-surface-2) 25%, var(--vault-border) 50%, var(--vault-surface-2) 75%)',
    backgroundSize: '200% 100%',
    animation: 'skeletonPulse 1.4s ease infinite',
    borderRadius: 4,
};

export function Skeleton({ variant = 'text', lines = 1, width, height, style }: SkeletonProps) {
    if (variant === 'avatar') {
        return (
            <div style={{
                ...PULSE_STYLE,
                width: width ?? 36,
                height: height ?? 36,
                borderRadius: '50%',
                flexShrink: 0,
                ...style,
            }} />
        );
    }

    if (variant === 'card') {
        return (
            <div style={{
                ...PULSE_STYLE,
                width: width ?? '100%',
                height: height ?? 140,
                borderRadius: 8,
                ...style,
            }} />
        );
    }

    if (variant === 'row') {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 0',
                ...style,
            }}>
                <div style={{ ...PULSE_STYLE, width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ ...PULSE_STYLE, height: 12, width: '60%' }} />
                    <div style={{ ...PULSE_STYLE, height: 10, width: '40%' }} />
                </div>
            </div>
        );
    }

    // text variant — multiple lines
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: width ?? '100%', ...style }}>
            {Array.from({ length: lines }).map((_, i) => (
                <div
                    key={i}
                    style={{
                        ...PULSE_STYLE,
                        height: height ?? 12,
                        width: i === lines - 1 && lines > 1 ? '70%' : '100%',
                    }}
                />
            ))}
        </div>
    );
}

export function SkeletonCardGrid({ count = 3 }: { count?: number }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {Array.from({ length: count }).map((_, i) => (
                <Skeleton key={i} variant="card" />
            ))}
        </div>
    );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* Header */}
            <div style={{ display: 'flex', gap: 16, padding: '10px 16px', borderBottom: '1px solid var(--vault-border)' }}>
                {Array.from({ length: cols }).map((_, i) => (
                    <div key={i} style={{ ...PULSE_STYLE, height: 11, flex: i === 0 ? 2 : 1 }} />
                ))}
            </div>
            {/* Rows */}
            {Array.from({ length: rows }).map((_, r) => (
                <div key={r} style={{ display: 'flex', gap: 16, padding: '12px 16px', borderBottom: '1px solid var(--vault-border)', alignItems: 'center' }}>
                    {Array.from({ length: cols }).map((_, c) => (
                        <div key={c} style={{ ...PULSE_STYLE, height: 12, flex: c === 0 ? 2 : 1 }} />
                    ))}
                </div>
            ))}
        </div>
    );
}
