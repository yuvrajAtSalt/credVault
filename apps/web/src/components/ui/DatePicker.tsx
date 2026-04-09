'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface DatePickerProps {
    value?: Date | null;
    onChange: (date: Date | null) => void;
    minDate?: Date;
    maxDate?: Date;
    disabled?: boolean;
    placeholder?: string;
    style?: React.CSSProperties;
    clearable?: boolean;
}

export function DatePicker({ value, onChange, minDate, maxDate, disabled, placeholder = 'Select date…', style, clearable = true }: DatePickerProps) {
    const [open, setOpen] = useState(false);
    const triggerRef      = useRef<HTMLButtonElement>(null);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const [mounted, setMounted] = useState(false);

    // Current view month/year
    const [viewDate, setViewDate] = useState(() => value ? new Date(value) : new Date());

    useEffect(() => setMounted(true), []);

    // Sync viewDate when value changes externally
    useEffect(() => {
        if (value && !open) setViewDate(new Date(value));
    }, [value, open]);

    const handleOpen = () => {
        if (disabled) return;
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom + window.scrollY + 4,
                left: rect.left + window.scrollX,
            });
        }
        setOpen(true);
    };

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
                // Click away handled by backdrop
            }
        };
        const scrollHandler = () => setOpen(false);
        document.addEventListener('mousedown', handler);
        window.addEventListener('scroll', scrollHandler, { passive: true });
        return () => {
            document.removeEventListener('mousedown', handler);
            window.removeEventListener('scroll', scrollHandler);
        };
    }, [open]);

    // Calendar logic
    const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const monthEnd = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
    const startOffset = monthStart.getDay() || 7; // 1 (Mon) to 7 (Sun) if we want Monday start. Let's stick to Sun (0)
    const displayStartOffset = monthStart.getDay(); // Sunday based
    
    const days = [];
    // Previous month padding
    for (let i = 0; i < displayStartOffset; i++) {
        days.push(null);
    }
    // Current month days
    for (let i = 1; i <= monthEnd.getDate(); i++) {
        days.push(new Date(viewDate.getFullYear(), viewDate.getMonth(), i));
    }

    const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));

    const isSameDate = (d1?: Date | null, d2?: Date | null) => {
        if (!d1 || !d2) return false;
        return d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
    };

    const isOutOfRange = (d: Date) => {
        const reset = new Date(d);
        reset.setHours(0, 0, 0, 0);
        if (minDate) {
            const m = new Date(minDate); m.setHours(0,0,0,0);
            if (reset < m) return true;
        }
        if (maxDate) {
            const m = new Date(maxDate); m.setHours(0,0,0,0);
            if (reset > m) return true;
        }
        return false;
    };

    const displayVal = value ? value.toLocaleDateString('en-GB') : '';

    return (
        <>
            <div style={{ position: 'relative', ...style }}>
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
                        color: value ? 'var(--vault-ink)' : 'var(--vault-ink-subtle)',
                        textAlign: 'left',
                        paddingRight: clearable && value && !disabled ? 32 : 10,
                    }}
                >
                    {displayVal || placeholder}
                    {!value && <span style={{ fontSize: 13, color: 'var(--vault-ink-muted)' }}>📅</span>}
                </button>
                {clearable && value && !disabled && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onChange(null); }}
                        style={{
                            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--vault-ink-muted)', fontSize: 13, padding: 2,
                        }}
                    >
                        ✕
                    </button>
                )}
            </div>

            {mounted && open && createPortal(
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 300 }} onClick={() => setOpen(false)} />
                    <div
                        className="vault-animate-in"
                        style={{
                            position: 'absolute',
                            top: coords.top, left: coords.left,
                            width: 260,
                            background: 'var(--vault-bg)',
                            border: '1px solid var(--vault-border)',
                            borderRadius: 'var(--vault-radius-md)',
                            boxShadow: 'var(--vault-shadow-overlay)',
                            zIndex: 301,
                            padding: 16,
                            userSelect: 'none',
                        }}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <button type="button" onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4, color: 'var(--vault-ink-muted)' }}>◀</button>
                            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--vault-ink)' }}>
                                {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                            </span>
                            <button type="button" onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4, color: 'var(--vault-ink-muted)' }}>▶</button>
                        </div>

                        {/* Weekdays */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 8 }}>
                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                                <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--vault-ink-subtle)' }}>{d}</div>
                            ))}
                        </div>

                        {/* Days grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                            {days.map((d, i) => {
                                if (!d) return <div key={`empty-${i}`} />;
                                const selected = isSameDate(d, value);
                                const today = isSameDate(d, new Date());
                                const outOfRange = isOutOfRange(d);
                                
                                return (
                                    <button
                                        key={d.toISOString()}
                                        type="button"
                                        disabled={outOfRange}
                                        onClick={() => { onChange(d); setOpen(false); }}
                                        style={{
                                            width: '100%', aspectRatio: '1/1',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 12, borderRadius: 3, border: 'none',
                                            background: selected ? 'var(--vault-primary)' : 'transparent',
                                            color: selected ? '#fff' : outOfRange ? 'var(--vault-ink-subtle)' : 'var(--vault-ink)',
                                            fontWeight: selected || today ? 700 : 400,
                                            cursor: outOfRange ? 'not-allowed' : 'pointer',
                                            textDecoration: today && !selected ? 'underline' : 'none',
                                            opacity: outOfRange ? 0.3 : 1,
                                        }}
                                        onMouseEnter={(e) => { if (!selected && !outOfRange) e.currentTarget.style.background = 'var(--vault-surface)'; }}
                                        onMouseLeave={(e) => { if (!selected && !outOfRange) e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        {d.getDate()}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </>,
                document.body
            )}
        </>
    );
}
