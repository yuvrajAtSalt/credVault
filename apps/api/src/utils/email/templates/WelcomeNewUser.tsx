import * as React from 'react';
import { Text, render, Link } from '@react-email/components';
import { BaseEmail, commonStyles } from './BaseEmail';

interface WelcomeNewUserProps {
    name: string;
    orgName: string;
    loginUrl: string;
    tempPassword?: string | null;
    role: string;
    email?: string;
}

export const WelcomeNewUser = ({ name, orgName, loginUrl, tempPassword, role, email }: WelcomeNewUserProps) => (
    <BaseEmail previewText={`Welcome to ${orgName} on VaultStack`} email={email}>
        <Text style={commonStyles.h1}>Welcome to {orgName}!</Text>
        <Text style={commonStyles.text}>Hi {name},</Text>
        <Text style={commonStyles.text}>
            Your account has been created on VaultStack with the role: <strong>{role}</strong>.
        </Text>
        
        {tempPassword && (
            <React.Fragment>
                <Text style={commonStyles.text}>Your temporary password is:</Text>
                <Text style={commonStyles.codeBlock}>{tempPassword}</Text>
            </React.Fragment>
        )}

        <Link href={loginUrl} style={commonStyles.button}>
            Log in to VaultStack →
        </Link>

        {tempPassword && (
            <Text style={{ ...commonStyles.text, fontSize: '14px', color: '#5E6C84' }}>
                You will be asked to change this temporary password on your first login.
            </Text>
        )}
    </BaseEmail>
);

export const renderWelcomeNewUser = async (props: WelcomeNewUserProps) => ({
    html: await render(<WelcomeNewUser {...props} />),
    text: await render(<WelcomeNewUser {...props} />, { plainText: true })
});
