'use client';

import { useState, useEffect } from 'react';

function format(date: Date): string {
    const now   = new Date();
    const diff  = now.getTime() - date.getTime();
    const secs  = Math.floor(diff / 1000);
    const mins  = Math.floor(secs / 60);
    const hours = Math.floor(mins / 60);
    const days  = Math.floor(hours / 24);

    if (secs < 60)         return 'Just now';
    if (mins < 60)         return `${mins}m ago`;
    if (hours < 24)        return `${hours}h ago`;
    if (days < 7)          return `${days}d ago`;

    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function useRelativeTime(dateInput: string | Date | null | undefined): string {
    const date = dateInput ? new Date(dateInput) : null;
    const [text, setText] = useState(() => (date ? format(date) : ''));

    useEffect(() => {
        if (!date) return;
        setText(format(date));
        const id = setInterval(() => setText(format(date!)), 60_000);
        return () => clearInterval(id);
    }, [dateInput]); // eslint-disable-line react-hooks/exhaustive-deps

    return text;
}
