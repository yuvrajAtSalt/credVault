'use client';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
    name: string;
    src?: string;
    size?: AvatarSize;
    className?: string;
}

const sizeMap: Record<AvatarSize, number> = { sm: 24, md: 32, lg: 40, xl: 56 };
const fontMap: Record<AvatarSize, number> = { sm: 9,  md: 12, lg: 14, xl: 18 };

function getInitials(name: string) {
    const parts = name.trim().split(' ');
    return parts.length >= 2
        ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
        : name.slice(0, 2).toUpperCase();
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
    const px = sizeMap[size];
    const fs = fontMap[size];

    if (src) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={src}
                alt={name}
                width={px}
                height={px}
                className={className}
                style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            />
        );
    }

    return (
        <div
            className={className}
            title={name}
            style={{
                width: px, height: px, borderRadius: '50%',
                background: 'var(--vault-primary-light)',
                color: 'var(--vault-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: fs, fontWeight: 700, flexShrink: 0, userSelect: 'none',
            }}
        >
            {getInitials(name)}
        </div>
    );
}
