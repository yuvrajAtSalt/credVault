'use client';

import { useEffect, useCallback } from 'react';

type Options = {
    /** Only fire when no input/textarea/select is focused */
    ignoreWhenTyping?: boolean;
    ctrlOrMeta?: boolean;
};

export function useKeyboardShortcut(
    key: string,
    handler: (e: KeyboardEvent) => void,
    options: Options = {},
) {
    const { ignoreWhenTyping = true, ctrlOrMeta = false } = options;

    const cb = useCallback((e: KeyboardEvent) => {
        if (ignoreWhenTyping) {
            const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
            if (['input', 'textarea', 'select'].includes(tag)) return;
            if ((e.target as HTMLElement)?.isContentEditable) return;
        }
        if (ctrlOrMeta && !(e.ctrlKey || e.metaKey)) return;
        if (e.key === key) {
            e.preventDefault();
            handler(e);
        }
    }, [key, handler, ignoreWhenTyping, ctrlOrMeta]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        document.addEventListener('keydown', cb);
        return () => document.removeEventListener('keydown', cb);
    }, [cb]);
}
