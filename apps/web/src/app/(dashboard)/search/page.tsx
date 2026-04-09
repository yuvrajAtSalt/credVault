'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import Link from 'next/link';

function SearchContent() {
    const searchParams = useSearchParams();
    const queryParam = searchParams.get('q') || '';
    
    const [query, setQuery] = useState(queryParam);
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('all'); // all, project, credential, user, etc.

    useEffect(() => {
        if (queryParam) {
            setQuery(queryParam);
            performSearch(queryParam);
        }
    }, [queryParam]);

    const performSearch = async (q: string) => {
        if (!q || q.length < 2) return;
        setLoading(true);
        try {
            const { data } = await api.get<any[]>(`/api/v1/search?q=${encodeURIComponent(q)}`);
            setResults(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        // optionally update url
        window.history.pushState(null, '', `?q=${encodeURIComponent(query)}`);
        performSearch(query);
    };

    const filtered = filter === 'all' ? results : results.filter(r => r.type === filter);

    return (
        <div style={{ padding: '32px' }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#172B4D', marginBottom: 24 }}>Search VaultStack</h1>
            
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
                <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search projects, credentials, teams, users..."
                    style={{ flex: 1, padding: '12px 16px', fontSize: 16, border: '1px solid #DFE1E6', borderRadius: 4 }}
                />
                <button type="submit" className="vault-btn vault-btn--primary">Search</button>
            </form>

            <div style={{ display: 'flex', gap: 32 }}>
                <div style={{ width: 220, flexShrink: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#6B778C', textTransform: 'uppercase', marginBottom: 16 }}>
                        Filter by type
                    </div>
                    {[
                        { id: 'all', label: 'All Results' },
                        { id: 'project', label: 'Projects' },
                        { id: 'credential', label: 'Credentials' },
                        { id: 'env', label: 'Env Variables' },
                        { id: 'user', label: 'Users' },
                        { id: 'team', label: 'Teams' }
                    ].map(f => (
                        <button
                            key={f.id}
                            onClick={() => setFilter(f.id)}
                            style={{
                                display: 'flex', width: '100%', padding: '8px 12px',
                                background: filter === f.id ? '#EBECF0' : 'transparent',
                                border: 'none', borderRadius: 4, cursor: 'pointer',
                                textAlign: 'left', fontWeight: filter === f.id ? 600 : 400,
                                color: filter === f.id ? '#172B4D' : '#42526E',
                                marginBottom: 4,
                            }}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                <div style={{ flex: 1 }}>
                    {loading && <p>Searching...</p>}
                    {!loading && query && results.length === 0 && (
                        <div style={{ padding: '40px', textAlign: 'center', background: '#F4F5F7', borderRadius: 8 }}>
                            <p style={{ fontSize: 16, color: '#172B4D', fontWeight: 500 }}>No results found</p>
                            <p style={{ fontSize: 14, color: '#6B778C' }}>We couldn't find anything matching "{query}". Try different keywords.</p>
                        </div>
                    )}

                    {!loading && filtered.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {filtered.map(res => (
                                <Link
                                    key={`${res.type}-${res.id}`}
                                    href={res.url}
                                    style={{
                                        display: 'block', padding: '16px', background: '#fff',
                                        border: '1px solid #DFE1E6', borderRadius: 8,
                                        textDecoration: 'none', transition: 'border 0.2s',
                                    }}
                                    onMouseOver={e => e.currentTarget.style.borderColor = '#0052CC'}
                                    onMouseOut={e => e.currentTarget.style.borderColor = '#DFE1E6'}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: 16, color: '#0052CC', fontWeight: 500 }}>{res.title}</h3>
                                            <p style={{ margin: '4px 0 0', fontSize: 14, color: '#5E6C84' }}>{res.subtitle}</p>
                                        </div>
                                        <span style={{ fontSize: 12, padding: '2px 8px', background: '#EBECF0', color: '#42526E', borderRadius: 12, textTransform: 'capitalize' }}>
                                            {res.type}
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function SearchPage() {
    return (
        <Suspense fallback={<div style={{ padding: 32 }}>Loading search...</div>}>
            <SearchContent />
        </Suspense>
    );
}
