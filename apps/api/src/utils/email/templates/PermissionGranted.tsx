import * as React from 'react';
import { Text, render, Link } from '@react-email/components';
import { BaseEmail, commonStyles } from './BaseEmail';

interface PermissionGrantedProps {
    recipientName: string;
    permission: string;
    grantedBy: string;
    reason: string;
    expiresAt?: Date | string | null;
    dashboardUrl: string;
    email?: string;
}

export const PermissionGranted = ({ recipientName, permission, grantedBy, reason, expiresAt, dashboardUrl, email }: PermissionGrantedProps) => (
    <BaseEmail previewText={`You've been granted: ${permission}`} email={email}>
        <Text style={commonStyles.h1}>Permission Granted</Text>
        <Text style={commonStyles.text}>Hi {recipientName},</Text>
        <Text style={commonStyles.text}>
            <strong>{grantedBy}</strong> granted you the following permission on VaultStack:
        </Text>

        <ul style={commonStyles.bulletList}>
            <li style={{ ...commonStyles.bulletItem, fontWeight: 'bold' }}>✓ {permission}</li>
        </ul>

        <Text style={{ ...commonStyles.text, fontStyle: 'italic', backgroundColor: '#F4F5F7', padding: '10px', borderRadius: '4px' }}>
            Reason: "{reason}"
        </Text>

        <Text style={commonStyles.text}>
            {expiresAt ? `This permission expires on: ${new Date(expiresAt).toLocaleString()}` : 'This permission does not expire.'}
        </Text>

        <Link href={dashboardUrl} style={commonStyles.button}>
            Go to dashboard →
        </Link>
    </BaseEmail>
);

export const renderPermissionGranted = async (props: PermissionGrantedProps) => ({
    html: await render(<PermissionGranted {...props} />),
    text: await render(<PermissionGranted {...props} />, { plainText: true })
});
