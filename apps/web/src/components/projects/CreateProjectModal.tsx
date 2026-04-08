'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { api } from '@/lib/api';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onCreated: () => void;
}

const COLORS = ['#0052CC', '#00875A', '#FF8B00', '#DE350B', '#6554C0', '#00B8D9'];
const STATUS_OPTIONS = [
    { value: 'active',    label: 'Active' },
    { value: 'planning',  label: 'Planning' },
    { value: 'archived',  label: 'Archived' },
];

export function CreateProjectModal({ isOpen, onClose, onCreated }: Props) {
    const router = useRouter();
    const [name, setName]           = useState('');
    const [description, setDesc]    = useState('');
    const [color, setColor]         = useState(COLORS[0]);
    const [status, setStatus]       = useState<'active' | 'planning' | 'archived'>('active');
    const [tagInput, setTagInput]   = useState('');
    const [tags, setTags]           = useState<string[]>([]);
    const [loading, setLoading]     = useState(false);
    const [error, setError]         = useState('');

    const addTag = () => {
        const t = tagInput.trim();
        if (t && !tags.includes(t)) setTags([...tags, t]);
        setTagInput('');
    };

    const removeTag = (t: string) => setTags(tags.filter((x) => x !== t));

    const handleClose = () => {
        setName(''); setDesc(''); setColor(COLORS[0]);
        setStatus('active'); setTags([]); setTagInput(''); setError('');
        onClose();
    };

    const handleSubmit = async () => {
        if (!name.trim()) { setError('Project name is required.'); return; }
        setLoading(true); setError('');
        try {
            const { error: apiErr } = await api.post('/api/v1/projects', { name: name.trim(), description, color, status, tags });
            if (apiErr) { setError(apiErr.message); return; }
            onCreated();
            handleClose();
        } catch {
            setError('Something went wrong.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="New project"
            width="md"
            footer={
                <>
                    <Button variant="secondary" onClick={handleClose} disabled={loading}>Cancel</Button>
                    <Button variant="primary" onClick={handleSubmit} loading={loading}>Create project</Button>
                </>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {error && (
                    <div style={{ background: 'var(--vault-danger-light)', color: 'var(--vault-danger)', border: '1px solid var(--vault-danger)', borderRadius: 3, padding: '8px 12px', fontSize: 13 }}>
                        {error}
                    </div>
                )}

                <Input
                    label="Project name *"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Backend API"
                    autoFocus
                />

                <Textarea
                    label="Description"
                    value={description}
                    onChange={(e) => setDesc(e.target.value)}
                    placeholder="What is this project about?"
                />

                <Select
                    label="Status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    options={STATUS_OPTIONS}
                />

                {/* Color picker */}
                <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--vault-ink)', marginBottom: 8 }}>Color</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {COLORS.map((c) => (
                            <button
                                key={c}
                                onClick={() => setColor(c)}
                                style={{
                                    width: 28, height: 28, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer',
                                    boxShadow: color === c ? `0 0 0 3px white, 0 0 0 5px ${c}` : 'none',
                                    transition: 'box-shadow 120ms',
                                }}
                                aria-label={`Select color ${c}`}
                            />
                        ))}
                    </div>
                </div>

                {/* Tags */}
                <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--vault-ink)', marginBottom: 8 }}>Tags</p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                        {tags.map((t) => (
                            <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--vault-surface-2)', borderRadius: 3, padding: '2px 8px', fontSize: 12 }}>
                                {t}
                                <button onClick={() => removeTag(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--vault-ink-muted)', lineHeight: 1, fontSize: 14 }}>×</button>
                            </span>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <input
                            className="vault-input"
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                            placeholder="Type tag and press Enter"
                            style={{ flex: 1 }}
                        />
                        <Button variant="secondary" size="sm" onClick={addTag}>Add</Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
