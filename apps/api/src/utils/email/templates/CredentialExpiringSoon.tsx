import * as React from 'react';
import { Text, render, Link } from '@react-email/components';
import { BaseEmail, commonStyles } from './BaseEmail';

interface CredentialExpiringSoonProps {
    recipientName: string;
    credentials: Array<{ label: string; projectName: string; expiresAt: string; url: string }>;
    email?: string;
}

export const CredentialExpiringSoon = ({ recipientName, credentials, email }: CredentialExpiringSoonProps) => (
    <BaseEmail previewText="Action Required: Credentials expiring soon" email={email}>
        <Text style={commonStyles.h1}>Credentials Expiring Soon</Text>
        <Text style={commonStyles.text}>Hi {recipientName},</Text>
        <Text style={commonStyles.text}>
            The following credentials will expire soon. Please update them to avoid service interruptions.
        </Text>

        <ul style={commonStyles.bulletList}>
            {credentials.map((cred, i) => (
                <li key={i} style={commonStyles.bulletItem}>
                    <strong>{cred.label}</strong> — {cred.projectName} — expires on {cred.expiresAt} <Link href={cred.url} style={{marginLeft: 10, color: '#0052CC', textDecoration: 'none'}}>[View →]</Link>
                </li>
            ))}
        </ul>

        <Text style={{ ...commonStyles.text, fontSize: '14px', color: '#5E6C84', marginTop: '20px' }}>
            To clear this warning, rotate the credentials and update their expiration dates in VaultStack.
        </Text>
    </BaseEmail>
);

export const renderCredentialExpiringSoon = async (props: CredentialExpiringSoonProps) => ({
    html: await render(<CredentialExpiringSoon {...props} />),
    text: await render(<CredentialExpiringSoon {...props} />, { plainText: true })
});
