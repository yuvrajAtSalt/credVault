'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { api } from '@/lib/api';
import { ROLE_LABELS, VaultRole } from '@/lib/constants';
import { AddEmployeeModal } from '@/components/admin/AddEmployeeModal';
import { EditUserModal } from '@/components/admin/EditUserModal';
import { UserPermissionsDrawer } from '@/components/admin/UserPermissionsDrawer';
import { InitiateOffboardingModal } from '@/components/admin/InitiateOffboardingModal';

const fetcher = (url: string) => api.get<any>(url).then((r) => r.data);

function getInitials(name: string) {
    const p = name.trim().split(' ');
    return p.length >= 2 ? `${p[0][0]}${p[p.length - 1][0]}`.toUpperCase() : name.slice(0, 2).toUpperCase();
}

export default function UsersPage() {
    const [search, setSearch]       = useState('');
    const [roleFilter, setRole]     = useState('');
    const [statusFilter, setStatus] = useState('active');
    const [page, setPage]           = useState(1);
    const [addOpen, setAddOpen]     = useState(false);
    const [editUser, setEditUser]   = useState<any>(null);
    const [permUser, setPermUser]       = useState<any>(null);
    const [offboardUser, setOffboardUser] = useState<any>(null);
    const [viewUser, setViewUser]       = useState<any>(null);

    const router = useRouter();

    const query = new URLSearchParams({
        page: String(page), limit: '20',
        ...(search ? { search } : {}),
        ...(roleFilter ? { role: roleFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
    }).toString();

    const { data, isLoading } = useSWR(`/api/v1/admin/users?${query}`, fetcher);
    const users = data?.data?.users ?? [];
    const total = data?.data?.total ?? 0;
    const pages = data?.data?.pages ?? 1;

    const refresh = () => mutate(`/api/v1/admin/users?${query}`);

    const deactivate = async (userId: string) => {
        if (!confirm('Deactivate this user? They will lose all access immediately.')) return;
        await api.patch(`/api/v1/admin/users/${userId}`, { isActive: false });
        refresh();
    };

    return (
        <div className="vault-page">
            <div className="vault-page-header">
                <div>
                    <h1 className="vault-page-title">User Management</h1>
                    <p className="vault-page-subtitle">Create, edit and manage employee accounts</p>
                </div>
                <button suppressHydrationWarning className="vault-btn vault-btn--primary" onClick={() => setAddOpen(true)}>
                    + Add Employee
                </button>
            </div>

            {/* ── Filters ── */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                <input
                    suppressHydrationWarning
                    className="vault-input" placeholder="Search name or email…"
                    value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    style={{ flex: '1 1 200px', maxWidth: 280 }}
                />
                <select suppressHydrationWarning className="vault-input" value={roleFilter} onChange={(e) => { setRole(e.target.value); setPage(1); }} style={{ flex: '0 0 140px' }}>
                    <option value="">All roles</option>
                    {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select suppressHydrationWarning className="vault-input" value={statusFilter} onChange={(e) => { setStatus(e.target.value); setPage(1); }} style={{ flex: '0 0 130px' }}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="">All</option>
                </select>
            </div>

            {/* ── Table ── */}
            <div className="vault-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--vault-border)', background: 'var(--vault-bg)' }}>
                                {['', 'Name', 'Role', 'Department', 'Status', 'Special Grants', 'Last Login', ''].map((h, i) => (
                                    <th key={`${h}-${i}`} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--vault-text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--vault-text-secondary)' }}>Loading…</td></tr>
                            ) : users.length === 0 ? (
                                <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--vault-text-secondary)' }}>
                                    No users found. <button className="vault-btn vault-btn--ghost" style={{ fontSize: 12 }} onClick={() => setAddOpen(true)}>Add one?</button>
                                </td></tr>
                            ) : users.map((u: any) => (
                                <tr key={u._id} style={{ borderBottom: '1px solid var(--vault-border)', transition: 'background 120ms' }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--vault-bg)')}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                                    {/* Avatar */}
                                    <td style={{ padding: '10px 14px', width: 40 }}>
                                        <div style={{
                                            width: 32, height: 32, borderRadius: '50%',
                                            background: 'rgba(0,82,204,0.12)', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center',
                                            fontSize: 11, fontWeight: 700, color: 'var(--vault-primary)',
                                        }}>
                                            {getInitials(u.name)}
                                        </div>
                                    </td>
                                    {/* Name */}
                                    <td style={{ padding: '10px 14px' }}>
                                        <p style={{ margin: 0, fontWeight: 600, color: 'var(--vault-text)' }}>{u.name}</p>
                                        <p style={{ margin: 0, fontSize: 11, color: 'var(--vault-text-secondary)' }}>{u.email}</p>
                                    </td>
                                    {/* Role */}
                                    <td style={{ padding: '10px 14px' }}>
                                        <span className={`vault-role-badge vault-role--${u.role?.toLowerCase()}`} style={{ fontSize: 10 }}>
                                            {u.customRoleId?.name || ROLE_LABELS[u.role as VaultRole] || u.role}
                                        </span>
                                    </td>
                                    {/* Dept */}
                                    <td style={{ padding: '10px 14px', color: 'var(--vault-text-secondary)' }}>{u.department || '—'}</td>
                                    {/* Status */}
                                    <td style={{ padding: '10px 14px' }}>
                                        <span style={{
                                            display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                                            background: u.isActive ? 'rgba(54,179,126,0.12)' : 'rgba(222,53,11,0.1)',
                                            color: u.isActive ? 'var(--vault-success)' : 'var(--vault-danger)',
                                        }}>
                                            {u.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    {/* Special grants */}
                                    <td style={{ padding: '10px 14px' }}>
                                        {u.specialPermissionsCount > 0 ? (
                                            <span style={{
                                                display: 'inline-block', padding: '2px 8px', borderRadius: 12,
                                                fontSize: 11, fontWeight: 600,
                                                background: 'rgba(255,171,0,0.12)', color: '#B8860B',
                                            }}>
                                                {u.specialPermissionsCount} grant{u.specialPermissionsCount !== 1 ? 's' : ''}
                                            </span>
                                        ) : <span style={{ color: 'var(--vault-text-secondary)', fontSize: 11 }}>—</span>}
                                    </td>
                                    {/* Last login */}
                                    <td style={{ padding: '10px 14px', color: 'var(--vault-text-secondary)', fontSize: 11, whiteSpace: 'nowrap' }}>
                                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                                    </td>
                                    {/* Actions */}
                                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button className="vault-btn vault-btn--ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setViewUser(u)}>View</button>
                                            <button className="vault-btn vault-btn--ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setEditUser(u)}>Edit</button>
                                            <button className="vault-btn vault-btn--ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setPermUser(u)}>Permissions</button>
                                            
                                            {u.activeOffboardingId ? (
                                                <button className="vault-btn vault-btn--ghost" style={{ fontSize: 11, padding: '4px 10px', color: 'var(--vault-primary)' }} onClick={() => router.push(`/settings/offboarding/${u.activeOffboardingId}`)}>Continue</button>
                                            ) : u.isActive ? (
                                                <button className="vault-btn vault-btn--ghost" style={{ fontSize: 11, padding: '4px 10px', color: 'var(--vault-danger)' }} onClick={() => setOffboardUser(u)}>Offboard</button>
                                            ) : null}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {pages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--vault-border)' }}>
                        <span style={{ fontSize: 12, color: 'var(--vault-text-secondary)' }}>
                            Showing {Math.min((page - 1) * 20 + 1, total)}–{Math.min(page * 20, total)} of {total}
                        </span>
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button className="vault-btn vault-btn--ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={{ fontSize: 12, padding: '4px 10px' }}>← Prev</button>
                            <button className="vault-btn vault-btn--ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} style={{ fontSize: 12, padding: '4px 10px' }}>Next →</button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Modals ── */}
            {addOpen      && <AddEmployeeModal onClose={() => { setAddOpen(false); refresh(); }} />}
            {editUser     && <EditUserModal user={editUser} onClose={() => { setEditUser(null); refresh(); }} />}
            {viewUser     && <EditUserModal user={viewUser} onClose={() => { setViewUser(null); }} readonly={true} />}
            {permUser     && <UserPermissionsDrawer user={permUser} onClose={() => { setPermUser(null); refresh(); }} />}
            {offboardUser && <InitiateOffboardingModal user={offboardUser} onClose={() => { setOffboardUser(null); refresh(); }} />}
        </div>
    );
}
