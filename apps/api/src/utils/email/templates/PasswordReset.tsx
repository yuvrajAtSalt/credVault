import * as React from 'react';
import { Text, Link, render } from '@react-email/components';
import { BaseEmail, commonStyles } from './BaseEmail';

interface PasswordResetProps {
    name: string;
    resetUrl: string;
    expiresInMinutes?: number;
    email?: string;
}

export const PasswordReset = ({ name, resetUrl, expiresInMinutes = 60, email }: PasswordResetProps) => (
    <BaseEmail previewText="Reset your VaultStack password" email={email}>
        <Text style={commonStyles.h1}>Password Reset</Text>
        <Text style={commonStyles.text}>Hi {name},</Text>
        <Text style={commonStyles.text}>
            You requested a password reset for your VaultStack account.
        </Text>
        <Link href={resetUrl} style={commonStyles.button}>
            Reset password →
        </Link>
        <Text style={{ ...commonStyles.text, fontSize: '14px', color: '#5E6C84' }}>
            This link expires in {expiresInMinutes} minutes. If you didn't request this, you can safely ignore this email.
        </Text>
    </BaseEmail>
);

export const renderPasswordReset = async (props: PasswordResetProps) => ({
    html: await render(<PasswordReset {...props} />),
    text: await render(<PasswordReset {...props} />, { plainText: true })
});
