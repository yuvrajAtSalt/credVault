'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePermissions } from '@/hooks/usePermissions';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { CreateProjectModal } from '@/components/projects/CreateProjectModal';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { api } from '@/lib/api';
import { SkeletonCardGrid } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Project } from '@/types';

type PopulatedProject = Project & {
    members: Array<{ userId: { _id: string; name: string; avatarUrl?: string } | string }>;
};

const STATUS_OPTIONS = [
    { value: '',         label: 'All statuses' },
    { value: 'active',   label: 'Active' },
    { value: 'planning', label: 'Planning' },
    { value: 'archived', label: 'Archived' },
];

export default function ProjectsPage() {
    const perms = usePermissions();
    const [projects, setProjects]     = useState<PopulatedProject[]>([]);
    const [loading, setLoading]       = useState(true);
    const [error, setError]           = useState('');
    const [search, setSearch]         = useState('');
    const [statusFilter, setStatus]   = useState('');
    const [showCreate, setShowCreate] = useState(false);

    const fetchProjects = useCallback(async () => {
        setLoading(true);
        const { data, error: err } = await api.get<any>('/api/v1/projects');
        if (err) { setError(err.message); setLoading(false); return; }
        setProjects((data as any)?.data ?? []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchProjects(); }, [fetchProjects]);

    const filtered = projects.filter((p) => {
        const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
            (p.description ?? '').toLowerCase().includes(search.toLowerCase());
        const matchStatus = statusFilter ? p.status === statusFilter : true;
        return matchSearch && matchStatus;
    });

    return (
        <main className="vault-page">
            {/* Page header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--vault-ink)', margin: 0 }}>Projects</h1>
                    <p style={{ fontSize: 14, color: 'var(--vault-ink-muted)', marginTop: 2, marginBottom: 0 }}>
                        {projects.length} project{projects.length !== 1 ? 's' : ''}
                    </p>
                </div>
                {perms.canCreateProject() && (
                    <Button variant="primary" onClick={() => setShowCreate(true)}>
                        + New project
                    </Button>
                )}
            </div>

            {/* Filter bar */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 240px', minWidth: 200 }}>
                    <Input
                        placeholder="Search projects…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div style={{ width: 170 }}>
                    <Select
                        value={statusFilter}
                        onChange={(e) => setStatus(e.target.value)}
                        options={STATUS_OPTIONS}
                    />
                </div>
            </div>

            {/* States */}
            {loading && (
                <div style={{ padding: '24px 0' }}>
                    <SkeletonCardGrid count={6} />
                </div>
            )}

            {!loading && error && (
                <div className="vault-card" style={{ background: 'var(--vault-danger-light)', borderColor: 'var(--vault-danger)', color: 'var(--vault-danger)', fontSize: 14 }}>
                    {error}
                </div>
            )}

            {!loading && !error && filtered.length === 0 && (
                <div className="vault-card" style={{ padding: 0 }}>
                    <EmptyState
                        title={search || statusFilter ? 'No projects match your filters' : 'No projects yet'}
                        description={search || statusFilter ? 'Try adjusting your search or filters to find what you are looking for.' : 'Get started by creating your first project to manage credentials.'}
                        action={perms.canCreateProject() && !search && !statusFilter ? {
                            label: 'Create your first project',
                            onClick: () => setShowCreate(true)
                        } : undefined}
                    />
                </div>
            )}

            {/* Grid */}
            {!loading && !error && filtered.length > 0 && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: 16,
                }}>
                    {filtered.map((p) => (
                        <ProjectCard key={p._id} project={p} />
                    ))}
                </div>
            )}

            <CreateProjectModal
                isOpen={showCreate}
                onClose={() => setShowCreate(false)}
                onCreated={fetchProjects}
            />
        </main>
    );
}
