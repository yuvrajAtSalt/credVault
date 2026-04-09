import * as React from 'react';
import { Text, render, Link } from '@react-email/components';
import { BaseEmail, commonStyles } from './BaseEmail';

interface AccountLockedProps {
    name: string;
    lockedUntil: Date | string;
    resetUrl: string;
    email?: string;
}

export const AccountLocked = ({ name, lockedUntil, resetUrl, email }: AccountLockedProps) => (
    <BaseEmail previewText="Security Alert: Your VaultStack account has been temporarily locked" email={email}>
        <Text style={commonStyles.h1}>Account Locked</Text>
        <Text style={commonStyles.text}>Hi {name},</Text>
        <Text style={commonStyles.text}>
            Your VaultStack account has been temporarily locked due to too many failed login attempts.
        </Text>
        <Text style={{ ...commonStyles.text, color: '#FF5630', fontWeight: 'bold' }}>
            The lock will automatically expire at: {new Date(lockedUntil).toLocaleString()}
        </Text>
        
        <Text style={commonStyles.text}>
            If you have forgotten your password, you can reset it using the link below:
        </Text>
        <Link href={resetUrl} style={commonStyles.button}>
            Reset password →
        </Link>
        <Text style={{ ...commonStyles.text, fontSize: '14px', color: '#5E6C84' }}>
            If you believe this was an unauthorized attempt to access your account, please contact your organization's administrator immediately.
        </Text>
    </BaseEmail>
);

export const renderAccountLocked = async (props: AccountLockedProps) => ({
    html: await render(<AccountLocked {...props} />),
    text: await render(<AccountLocked {...props} />, { plainText: true })
});
