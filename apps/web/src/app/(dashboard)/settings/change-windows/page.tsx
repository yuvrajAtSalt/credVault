'use client';

import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '@/lib/constants';
import { useAuth } from '@/components/auth/auth-provider';
import { useToast } from '@/components/ui/Toast';
import { usePermissions } from '@/hooks/usePermissions';

interface ChangeWindow {
    _id: string;
    name: string;
    description: string;
    dayOfWeek: number[];
    startTime: string;
    endTime: string;
    timezone: string;
    isActive: boolean;
    excludedProjectIds: string[];
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function ChangeWindowsPage() {
    const { token } = useAuth();
    const { toast } = useToast();
    const perms = usePermissions();
    const [windows, setWindows] = useState<ChangeWindow[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [projects, setProjects] = useState<any[]>([]);

    const [form, setForm] = useState({
        name: '',
        description: '',
        dayOfWeek: [] as number[],
        startTime: '09:00',
        endTime: '17:00',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        isActive: true,
        excludedProjectIds: [] as string[]
    });

    const fetchWindows = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/compliance/change-windows`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const json = await res.json();
            if (res.ok) setWindows(json.data || []);
        } finally {
            setLoading(false);
        }
    }, [token]);

    const fetchProjects = useCallback(async () => {
        const res = await fetch(`${API_BASE_URL}/api/v1/projects`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (res.ok) setProjects(json.data?.projects || []);
    }, [token]);

    useEffect(() => {
        fetchWindows();
        fetchProjects();
    }, [fetchWindows, fetchProjects]);

    const handleCreate = async () => {
        if (!form.name || form.dayOfWeek.length === 0) {
            toast.error('Name and at least one day are required');
            return;
        }
        const res = await fetch(`${API_BASE_URL}/api/v1/compliance/change-windows`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(form),
        });
        if (res.ok) {
            toast.success('Change window created');
            setShowCreate(false);
            fetchWindows();
            setForm({
                name: '', description: '', dayOfWeek: [], startTime: '09:00', endTime: '17:00',
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, isActive: true, excludedProjectIds: []
            });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this change window?')) return;
        const res = await fetch(`${API_BASE_URL}/api/v1/compliance/change-windows/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
            toast.success('Window deleted');
            fetchWindows();
        }
    };

    if (loading) return <div style={{ padding: 48, textAlign: 'center' }}>Loading windows…</div>;

    return (
        <div className="vault-page">
            <div className="vault-page-header">
                <div>
                    <h1 className="vault-page-title">Change Windows</h1>
                    <p className="vault-page-subtitle">Restrict credential and environment mutations to specific maintenance schedules.</p>
                </div>
                <button className="vault-btn vault-btn--primary" onClick={() => setShowCreate(true)}>
                    + Create Window
                </button>
            </div>

            <div className="vault-card" style={{ padding: 0 }}>
                <table className="vault-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Schedule</th>
                            <th>Time</th>
                            <th>Timezone</th>
                            <th>Status</th>
                            <th>Exclusions</th>
                            <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {windows.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--vault-ink-muted)' }}>
                                    No change windows defined. Mutations are currently permitted at any time.
                                </td>
                            </tr>
                        ) : (
                            windows.map(w => (
                                <tr key={w._id}>
                                    <td>
                                        <div style={{ fontWeight: 600 }}>{w.name}</div>
                                        <div style={{ fontSize: 11, color: 'var(--vault-ink-muted)' }}>{w.description}</div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            {DAYS.map((d, i) => (
                                                <span key={d} style={{
                                                    fontSize: 10, padding: '1px 5px', borderRadius: 3,
                                                    background: w.dayOfWeek.includes(i) ? 'var(--vault-primary-light)' : 'var(--vault-surface)',
                                                    color: w.dayOfWeek.includes(i) ? 'var(--vault-primary)' : 'var(--vault-ink-muted)',
                                                    opacity: w.dayOfWeek.includes(i) ? 1 : 0.4,
                                                    fontWeight: 700
                                                }}>
                                                    {d[0]}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td style={{ fontSize: 13, fontWeight: 500 }}>{w.startTime} – {w.endTime}</td>
                                    <td style={{ fontSize: 12, color: 'var(--vault-ink-muted)' }}>{w.timezone}</td>
                                    <td>
                                        <span style={{
                                            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                                            background: w.isActive ? '#E3FCEF' : '#F4F5F7',
                                            color: w.isActive ? '#006644' : '#42526E'
                                        }}>
                                            {w.isActive ? 'ACTIVE' : 'INACTIVE'}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: 12 }}>
                                        {w.excludedProjectIds?.length || 0} project{w.excludedProjectIds?.length !== 1 ? 's' : ''}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <button onClick={() => handleDelete(w._id)} className="vault-btn--danger-text" style={{ fontSize: 12 }}>Delete</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {showCreate && (
                <div className="vault-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="vault-card" style={{ width: 500, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
                        <h3>Create Change Window</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                            <div>
                                <label className="vault-label">Window Name</label>
                                <input className="vault-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Standard Business Hours" />
                            </div>
                            <div>
                                <label className="vault-label">Days of Week</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {DAYS.map((d, i) => (
                                        <button
                                            key={d}
                                            onClick={() => {
                                                const next = form.dayOfWeek.includes(i) 
                                                    ? form.dayOfWeek.filter(x => x !== i)
                                                    : [...form.dayOfWeek, i];
                                                setForm({...form, dayOfWeek: next});
                                            }}
                                            style={{
                                                padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                                                border: '1px solid var(--vault-border)',
                                                background: form.dayOfWeek.includes(i) ? 'var(--vault-primary)' : 'none',
                                                color: form.dayOfWeek.includes(i) ? '#fff' : 'var(--vault-ink)'
                                            }}
                                        >
                                            {d}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div>
                                    <label className="vault-label">Start Time</label>
                                    <input type="time" className="vault-input" value={form.startTime} onChange={e => setForm({...form, startTime: e.target.value})} />
                                </div>
                                <div>
                                    <label className="vault-label">End Time</label>
                                    <input type="time" className="vault-input" value={form.endTime} onChange={e => setForm({...form, endTime: e.target.value})} />
                                </div>
                            </div>
                            <div>
                                <label className="vault-label">Timezone</label>
                                <select className="vault-input" value={form.timezone} onChange={e => setForm({...form, timezone: e.target.value})}>
                                    <option value="UTC">UTC</option>
                                    <option value={Intl.DateTimeFormat().resolvedOptions().timeZone}>Local ({Intl.DateTimeFormat().resolvedOptions().timeZone})</option>
                                    <option value="America/New_York">Eastern Time (ET)</option>
                                    <option value="Europe/London">London (GMT/BST)</option>
                                    <option value="Asia/Kolkata">India (IST)</option>
                                </select>
                            </div>
                            <div>
                                <label className="vault-label">Excluded Projects (Bypass window)</label>
                                <div style={{ height: 120, overflowY: 'auto', border: '1px solid var(--vault-border)', borderRadius: 6, padding: 8 }}>
                                    {projects.map(p => (
                                        <label key={p._id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13, cursor: 'pointer' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={form.excludedProjectIds.includes(p._id)}
                                                onChange={e => {
                                                    const next = e.target.checked 
                                                        ? [...form.excludedProjectIds, p._id]
                                                        : form.excludedProjectIds.filter(id => id !== p._id);
                                                    setForm({...form, excludedProjectIds: next});
                                                }}
                                            />
                                            {p.name}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
                            <button className="vault-btn vault-btn--secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                            <button className="vault-btn vault-btn--primary" onClick={handleCreate}>Create Window</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
