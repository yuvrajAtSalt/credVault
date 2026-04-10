import * as React from 'react';
import { render } from '@react-email/render';
import { BaseEmail } from './BaseEmail';
import { Text, Button, Section } from '@react-email/components';

export interface RoleChangedProps {
    recipientName: string;
    oldRole: string;
    newRole: string;
    changedBy: string;
    dashboardUrl: string;
    email: string;
}

export const RoleChangedEmail = ({
    recipientName,
    oldRole,
    newRole,
    changedBy,
    dashboardUrl,
    email,
}: RoleChangedProps) => {
    return (
        <BaseEmail previewText={`Your VaultStack Role was Changed to ${newRole}`} email={email}>
            <Text style={{ fontSize: '16px', color: '#172B4D', margin: '0 0 20px' }}>
                Hi {recipientName},
            </Text>
            <Text style={{ fontSize: '15px', color: '#42526E', lineHeight: '24px', margin: '0 0 20px' }}>
                Your role in VaultStack has been updated by <strong>{changedBy}</strong>.
            </Text>

            <Section style={{ background: '#F4F5F7', padding: '16px', borderRadius: '4px', margin: '0 0 24px' }}>
                <Text style={{ fontSize: '14px', color: '#42526E', margin: '0 0 8px' }}>
                    <strong>Previous Role:</strong> {oldRole}
                </Text>
                <Text style={{ fontSize: '14px', color: '#172B4D', margin: '0' }}>
                    <strong>New Role:</strong> {newRole}
                </Text>
            </Section>

            <Text style={{ fontSize: '15px', color: '#42526E', lineHeight: '24px', margin: '0 0 24px' }}>
                This may affect your access to projects, credentials, and settings. 
                Log in to review your new access level.
            </Text>

            <Button
                href={dashboardUrl}
                style={{
                    backgroundColor: '#0052CC',
                    borderRadius: '3px',
                    color: '#fff',
                    fontSize: '15px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    textAlign: 'center' as const,
                    padding: '12px 24px',
                }}
            >
                View Dashboard
            </Button>
        </BaseEmail>
    );
};

export const renderRoleChanged = async (props: RoleChangedProps) => {
    const html = await render(<RoleChangedEmail {...props} />);
    const text = await render(<RoleChangedEmail {...props} />, { plainText: true });
    return { html, text };
};
