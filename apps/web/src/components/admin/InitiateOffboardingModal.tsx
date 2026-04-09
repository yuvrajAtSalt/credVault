'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

interface Props {
    user: any;
    onClose: () => void;
}

export function InitiateOffboardingModal({ user, onClose }: Props) {
    const router = useRouter();
    const { toast } = useToast();
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);

    const handleInitiate = async () => {
        setLoading(true);
        try {
            const res = await api.post<any>(`/api/v1/offboarding/initiate/${user._id}`, { targetDate: date });
            if (res.data) {
                toast.success(`Offboarding initiated for ${user.name}`);
                router.push(`/settings/offboarding/${res.data.data?._id || res.data._id}`);
            } else {
                toast.error(res.error?.message || 'Failed to initiate offboarding');
                onClose();
            }
        } catch (e: any) {
            toast.error(e.message || 'An error occurred');
            onClose();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="vault-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="vault-card" style={{ width: 440, padding: 32, boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <div style={{ 
                        width: 56, height: 56, borderRadius: '50%', background: 'rgba(222,53,11,0.1)', 
                        color: 'var(--vault-danger)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 24, margin: '0 auto 16px'
                    }}>
                        👋
                    </div>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Initiate Offboarding</h2>
                    <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--vault-ink-muted)' }}>
                        You are starting the offboarding process for <strong>{user.name}</strong>.
                    </p>
                </div>

                <div style={{ marginBottom: 24 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--vault-ink)', marginBottom: 6 }}>
                        Effective date (Last working day)
                    </label>
                    <input 
                        type="date" 
                        className="vault-input" 
                        value={date} 
                        onChange={e => setDate(e.target.value)}
                        style={{ width: '100%' }}
                    />
                    <p style={{ marginTop: 8, fontSize: 11, color: 'var(--vault-ink-muted)', lineHeight: 1.4 }}>
                        This will create a structured checklist to ensure all credentials and project access is revoked or reassigned.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                    <button className="vault-btn vault-btn--secondary" style={{ flex: 1 }} onClick={onClose} disabled={loading}>
                        Cancel
                    </button>
                    <button className="vault-btn vault-btn--danger" style={{ flex: 1 }} onClick={handleInitiate} disabled={loading}>
                        {loading ? 'Starting...' : 'Initiate Process'}
                    </button>
                </div>
            </div>
        </div>
    );
}
