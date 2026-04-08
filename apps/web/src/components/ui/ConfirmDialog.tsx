'use client';

import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    loading?: boolean;
}

export function ConfirmDialog({
    isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirm', loading = false,
}: ConfirmDialogProps) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            width="sm"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button variant="danger" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
                </>
            }
        >
            <p style={{ fontSize: 14, color: 'var(--vault-ink-muted)', margin: 0 }}>{message}</p>
        </Modal>
    );
}
