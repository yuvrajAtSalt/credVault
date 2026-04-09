'use client';

import { useState, useEffect, useCallback } from 'react';
import { CredentialRow } from './CredentialRow';
import { AddCredentialModal } from './AddCredentialModal';
import { VisibilityControlPanel } from './VisibilityControlPanel';
import { Button } from '@/components/ui/Button';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/components/auth/auth-provider';
import { api } from '@/lib/api';

const CATEGORIES = [
    { key: 'github',   label: 'GitHub',   icon: '🐙' },
    { key: 'storage',  label: 'Storage',  icon: '🗄️' },
    { key: 'database', label: 'Database', icon: '🗃️' },
    { key: 'smtp',     label: 'SMTP',     icon: '📧' },
    { key: 'deploy',   label: 'Deploy',   icon: '🚀' },
    { key: 'custom',   label: 'Custom',   icon: '🔧' },
] as const;

type Category = typeof CATEGORIES[number]['key'];

interface Credential {
    _id: string;
    label: string;
    value: string;
    category: Category;
    isSecret: boolean;
    environment: string;
    addedBy: { _id: string; name: string; role: any };
    addedByRole: any;
    requiresDualApproval?: boolean;
    createdAt: string;
}

interface ProjectMember {
    userId: { _id: string; name: string; role: any; avatarUrl?: string };
}

interface Props {
    projectId: string;
    members: ProjectMember[];
    isCreator: boolean;
}

export function CredentialPanel({ projectId, members, isCreator }: Props) {
    const { user } = useAuth();
    const perms = usePermissions();

    const [activeTab, setActiveTab]         = useState<Category>('github');
    const [credentials, setCredentials]     = useState<Credential[]>([]);
    const [hiddenCount, setHiddenCount]     = useState(0);
    const [loading, setLoading]             = useState(true);
    const [showAdd, setShowAdd]             = useState(false);

    const canManage = perms.canGrantVisibility() || perms.isGod() ||
        perms.canSeeAllCredentials() || isCreator;

    const fetchCredentials = useCallback(async () => {
        setLoading(true);
        const { data } = await api.get<any>(`/api/v1/projects/${projectId}/credentials`);
        const payload = (data as any)?.data;
        setCredentials(payload?.credentials ?? []);
        setHiddenCount(payload?.hiddenCount ?? 0);
        setLoading(false);
    }, [projectId]);

    useEffect(() => { fetchCredentials(); }, [fetchCredentials]);

    const canDelete = (cred: Credential) => {
        return perms.isGod() ||
            ['SYSADMIN', 'MANAGER'].includes(user?.role ?? '') ||
            cred.addedBy?._id === user?._id;
    };

    const countForTab = (cat: Category) => credentials.filter((c) => c.category === cat).length;
    const tabCreds = credentials.filter((c) => c.category === activeTab);

    return (
        <div className="vault-card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Tab bar */}
            <div style={{
                display: 'flex',
                borderBottom: '1px solid var(--vault-border)',
                overflowX: 'auto',
                background: 'var(--vault-surface)',
            }}>
                {CATEGORIES.map((cat) => {
                    const count = countForTab(cat.key);
                    const isActive = activeTab === cat.key;
                    return (
                        <button
                            key={cat.key}
                            onClick={() => setActiveTab(cat.key)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '12px 16px',
                                border: 'none', background: 'none', cursor: 'pointer',
                                fontSize: 13, fontWeight: isActive ? 600 : 400,
                                color: isActive ? 'var(--vault-primary)' : 'var(--vault-ink-muted)',
                                borderBottom: isActive ? '2px solid var(--vault-primary)' : '2px solid transparent',
                                whiteSpace: 'nowrap',
                                transition: 'all 120ms',
                            }}
                        >
                            <span>{cat.icon}</span>
                            {cat.label}
                            {count > 0 && (
                                <span style={{
                                    background: isActive ? 'var(--vault-primary)' : 'var(--vault-tag-bg)',
                                    color: isActive ? '#fff' : 'var(--vault-tag-text)',
                                    borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700,
                                }}>
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Tab body */}
            <div style={{ padding: '16px 20px' }}>
                {loading ? (
                    <p style={{ color: 'var(--vault-ink-muted)', fontSize: 13 }}>Loading credentials…</p>
                ) : (
                    <>
                        {/* Hidden notice */}
                        {hiddenCount > 0 && (
                            <div style={{
                                background: '#FFFAE6', border: '1px solid #FFE380',
                                borderRadius: 4, padding: '10px 14px', fontSize: 13,
                                color: '#974F0C', marginBottom: 12, display: 'flex', gap: 8,
                            }}>
                                🔒 {hiddenCount} credential{hiddenCount !== 1 ? 's are' : ' is'} hidden. Ask your manager to grant you visibility.
                            </div>
                        )}

                        {/* Credentials list */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {tabCreds.length === 0 ? (
                                <p style={{ fontSize: 13, color: 'var(--vault-ink-subtle)', padding: '12px 0' }}>
                                    No {activeTab} credentials yet.
                                </p>
                            ) : (
                                tabCreds.map((cred) => (
                                    <CredentialRow
                                        key={cred._id}
                                        cred={cred}
                                        projectId={projectId}
                                        currentUserId={user?._id ?? ''}
                                        canDelete={canDelete(cred)}
                                        onDeleted={fetchCredentials}
                                    />
                                ))
                            )}
                        </div>

                        {/* Add credential */}
                        {perms.canAddCredential() && (
                            <div style={{ marginTop: 14 }}>
                                <Button variant="secondary" size="sm" onClick={() => setShowAdd(true)}>
                                    + Add credential
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Visibility control panel */}
            {canManage && (
                <VisibilityControlPanel
                    projectId={projectId}
                    members={members}
                    currentUserId={user?._id ?? ''}
                />
            )}

            <AddCredentialModal
                isOpen={showAdd}
                onClose={() => setShowAdd(false)}
                onCreated={fetchCredentials}
                projectId={projectId}
                defaultCategory={activeTab}
            />
        </div>
    );
}
