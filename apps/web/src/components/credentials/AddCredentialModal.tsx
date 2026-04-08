'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { api } from '@/lib/api';

const CATEGORY_OPTIONS = [
    { value: 'github',   label: '🐙 GitHub' },
    { value: 'storage',  label: '🗄️ Storage' },
    { value: 'database', label: '🗃️ Database' },
    { value: 'smtp',     label: '📧 SMTP' },
    { value: 'deploy',   label: '🚀 Deploy' },
    { value: 'custom',   label: '🔧 Custom' },
];

const ENV_OPTIONS = [
    { value: 'all',         label: 'All environments' },
    { value: 'production',  label: 'Production' },
    { value: 'staging',     label: 'Staging' },
    { value: 'development', label: 'Development' },
];

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onCreated: () => void;
    projectId: string;
    defaultCategory?: string;
}

export function AddCredentialModal({ isOpen, onClose, onCreated, projectId, defaultCategory = 'custom' }: Props) {
    const [category, setCategory]       = useState(defaultCategory);
    const [label, setLabel]             = useState('');
    const [value, setValue]             = useState('');
    const [showValue, setShowValue]     = useState(false);
    const [isSecret, setIsSecret]       = useState(true);
    const [environment, setEnvironment] = useState('all');
    const [loading, setLoading]         = useState(false);
    const [error, setError]             = useState('');

    const handleClose = () => {
        setCategory(defaultCategory); setLabel(''); setValue('');
        setIsSecret(true); setEnvironment('all'); setError('');
        onClose();
    };

    const handleSubmit = async () => {
        if (!label.trim()) { setError('Label is required.'); return; }
        if (!value.trim()) { setError('Value is required.'); return; }
        setLoading(true); setError('');
        const { error: apiErr } = await api.post(`/api/v1/projects/${projectId}/credentials`, {
            category, label: label.trim(), value, isSecret, environment,
        });
        setLoading(false);
        if (apiErr) { setError(apiErr.message); return; }
        onCreated();
        handleClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="Add credential"
            width="md"
            footer={
                <>
                    <Button variant="secondary" onClick={handleClose} disabled={loading}>Cancel</Button>
                    <Button variant="primary" onClick={handleSubmit} loading={loading}>Save credential</Button>
                </>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {error && (
                    <div style={{ background: 'var(--vault-danger-light)', color: 'var(--vault-danger)', border: '1px solid var(--vault-danger)', borderRadius: 3, padding: '8px 12px', fontSize: 13 }}>
                        {error}
                    </div>
                )}

                <Select
                    label="Category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    options={CATEGORY_OPTIONS}
                />

                <Input
                    label="Label *"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Production DB password"
                    autoFocus
                />

                {/* Value with show/hide toggle */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--vault-ink)' }}>Value *</label>
                    <div style={{ position: 'relative' }}>
                        <input
                            className="vault-input"
                            type={showValue ? 'text' : 'password'}
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder="Paste the secret here"
                            style={{ paddingRight: 40 }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowValue(!showValue)}
                            style={{
                                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                                background: 'none', border: 'none', cursor: 'pointer', fontSize: 14,
                                color: 'var(--vault-ink-muted)',
                            }}
                            aria-label={showValue ? 'Hide value' : 'Show value'}
                        >
                            {showValue ? '🙈' : '👁'}
                        </button>
                    </div>
                </div>

                <Select
                    label="Environment"
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value)}
                    options={ENV_OPTIONS}
                />

                {/* Secret toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                        type="button"
                        onClick={() => setIsSecret(!isSecret)}
                        style={{
                            width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                            background: isSecret ? 'var(--vault-primary)' : 'var(--vault-border)',
                            position: 'relative', transition: 'background 150ms',
                        }}
                        aria-label="Toggle secret"
                    >
                        <span style={{
                            position: 'absolute', top: 2, left: isSecret ? 18 : 2,
                            width: 16, height: 16, borderRadius: '50%', background: '#fff',
                            transition: 'left 150ms',
                        }} />
                    </button>
                    <span style={{ fontSize: 13, color: 'var(--vault-ink)' }}>Mark as secret (masked by default)</span>
                </div>
            </div>
        </Modal>
    );
}
