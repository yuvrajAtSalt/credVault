'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { staticCommands, CommandItem } from '@/lib/commands';
import { useAuth } from '@/components/auth/auth-provider';
import { usePermissions } from '@/hooks/usePermissions';
import { api } from '@/lib/api';

export function CommandPalette() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Recent commands logic
    const [recentIds, setRecentIds] = useState<string[]>([]);
    
    const router = useRouter();
    const { user } = useAuth();
    const { effectivePermissions: permissions } = usePermissions();
    const inputRef = useRef<HTMLInputElement>(null);

    // Load recent commands
    useEffect(() => {
        const stored = localStorage.getItem('vault_recent_commands');
        if (stored) {
            try {
                setRecentIds(JSON.parse(stored));
            } catch (e) {}
        }
    }, []);

    const addToRecent = (id: string) => {
        const ids = [id, ...recentIds.filter(x => x !== id)].slice(0, 5);
        setRecentIds(ids);
        localStorage.setItem('vault_recent_commands', JSON.stringify(ids));
    };

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen(v => !v);
            }
            if (e.key === 'Escape') {
                setOpen(false);
            }
        };
        
        const customOpen = () => setOpen(true);

        document.addEventListener('keydown', down);
        window.addEventListener('open-command-palette', customOpen);
        
        return () => {
            document.removeEventListener('keydown', down);
            window.removeEventListener('open-command-palette', customOpen);
        };
    }, []);

    useEffect(() => {
        if (open) {
            inputRef.current?.focus();
            setQuery('');
        }
    }, [open]);

    // Live backend search for dynamic stuff
    useEffect(() => {
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setLoading(true);
            const { data } = await api.get<any[]>(`/api/v1/search?q=${encodeURIComponent(query)}`);
            setSearchResults(data || []);
            setLoading(false);
        }, 300); // 300ms debounce

        return () => clearTimeout(timer);
    }, [query]);

    if (!open) return null;

    // Filter static commands
    const availableStatic = staticCommands.filter(cmd => {
        if (cmd.requireRole && !cmd.requireRole.includes((user as any)?.role)) return false;
        if (cmd.permissionKey && !(permissions as any)[cmd.permissionKey]) return false;
        
        if (!query) return true;
        return cmd.label.toLowerCase().includes(query.toLowerCase());
    });

    const recentStatic = query ? [] : availableStatic.filter(c => recentIds.includes(c.id));
    const allStaticDisplay = query ? availableStatic : availableStatic;

    const execute = (cmd: CommandItem | any) => {
        // cmd is static
        if (cmd.action) cmd.action();
        if (cmd.route) {
            router.push(cmd.route);
        }
        
        // it's a dynamic backend result (has url)
        if (cmd.url) {
            router.push(cmd.url);
        }

        if (cmd.id) addToRecent(cmd.id);
        
        setOpen(false);
    };

    return (
        <>
            <div 
                style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)',backdropFilter: 'blur(2px)' }} 
                onClick={() => setOpen(false)} 
            />
            <div style={{
                position: 'fixed', top: '15%', left: '50%', transform: 'translateX(-50%)',
                width: '100%', maxWidth: 640, background: '#fff', borderRadius: 8, zIndex: 101,
                boxShadow: '0 20px 40px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column',
                maxHeight: '70vh'
            }}>
                <div style={{ padding: 16, borderBottom: '1px solid #DFE1E6', display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: 20, marginRight: 12, color: '#6B778C' }}>🔍</span>
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Type a command or search (Cmd+K)..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        style={{
                            flex: 1, border: 'none', background: 'transparent', outline: 'none',
                            fontSize: 18, color: '#172B4D'
                        }}
                    />
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
                    {query.length === 0 && recentStatic.length > 0 && (
                        <div style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, color: '#5E6C84', textTransform: 'uppercase' }}>
                            Recent
                        </div>
                    )}
                    {query.length === 0 && recentStatic.map(c => (
                        <CommandRow key={c.id} item={c} onClick={() => execute(c)} />
                    ))}

                    <div style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, color: '#5E6C84', textTransform: 'uppercase' }}>
                        Actions
                    </div>
                    {allStaticDisplay.map(c => (
                        <CommandRow key={c.id} item={c} onClick={() => execute(c)} />
                    ))}

                    {query.length >= 2 && (
                        <>
                            <div style={{ padding: '8px 16px', fontSize: 12, fontWeight: 600, color: '#5E6C84', textTransform: 'uppercase', marginTop: 12 }}>
                                Vault Search Results {loading && <span style={{fontWeight:'normal'}}>(Loading...)</span>}
                            </div>
                            {searchResults.length === 0 && !loading && (
                                <div style={{ padding: '16px', color: '#6B778C', textAlign: 'center' }}>No results found for "{query}".</div>
                            )}
                            {searchResults.map(res => (
                                <CommandRow 
                                    key={res.id} 
                                    item={{
                                        id: res.id,
                                        label: res.title,
                                        icon: res.type === 'project' ? '📁' : res.type === 'user' ? '👥' : res.type === 'credential' ? '🔑' : '🌱',
                                        route: res.url,
                                    }} 
                                    subtitle={res.subtitle}
                                    onClick={() => execute(res)} 
                                />
                            ))}
                        </>
                    )}
                </div>
            </div>
        </>
    );
}

function CommandRow({ item, onClick, subtitle }: { item: any, onClick: () => void, subtitle?: string }) {
    return (
        <div
            onClick={onClick}
            style={{
                padding: '12px 24px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                transition: 'background 0.1s', borderBottom: '1px solid #f4f5f7'
            }}
            onMouseOver={e => e.currentTarget.style.background = '#F4F5F7'}
            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
        >
            {item.icon && <span style={{ marginRight: 16, fontSize: 18 }}>{item.icon}</span>}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 15, color: '#172B4D', fontWeight: 500 }}>{item.label}</span>
                {subtitle && <span style={{ fontSize: 12, color: '#6B778C' }}>{subtitle}</span>}
            </div>
        </div>
    );
}
