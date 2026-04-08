// ─── Date helpers ─────────────────────────────────────────────────────────────

/**
 * Returns a human-readable relative time string (e.g. "3 days ago").
 * Lightweight replacement for date-fns/formatDistanceToNow — no extra deps.
 */
export function formatDistanceToNow(dateInput: string | Date): string {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return 'Unknown';

    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60)    return 'Just now';
    if (seconds < 3600)  return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`;
    if (seconds < 31536000) return `${Math.floor(seconds / 2592000)}mo ago`;
    return `${Math.floor(seconds / 31536000)}y ago`;
}

// ─── String helpers ───────────────────────────────────────────────────────────

/** Returns uppercase initials from a full name (max 2 chars). */
export function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
}

/** Truncates a string to maxLength and appends ellipsis. */
export function truncate(str: string, maxLength: number): string {
    return str.length > maxLength ? str.slice(0, maxLength - 1) + '…' : str;
}

// ─── Class builder ────────────────────────────────────────────────────────────

/** Joins class names, filtering falsy values. */
export function cx(...classes: (string | undefined | false | null)[]): string {
    return classes.filter(Boolean).join(' ');
}
