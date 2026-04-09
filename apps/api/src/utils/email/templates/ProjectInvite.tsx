import * as React from 'react';
import { Text, render, Link } from '@react-email/components';
import { BaseEmail, commonStyles } from './BaseEmail';

interface ProjectInviteProps {
    recipientName: string;
    actorName: string;
    actorRole: string;
    projectName: string;
    projectUrl: string;
    orgName: string;
    email?: string;
}

export const ProjectInvite = ({ recipientName, actorName, actorRole, projectName, projectUrl, orgName, email }: ProjectInviteProps) => (
    <BaseEmail previewText={`You've been added to ${projectName}`} email={email}>
        <Text style={commonStyles.h1}>Project Invitation</Text>
        <Text style={commonStyles.text}>Hi {recipientName},</Text>
        <Text style={commonStyles.text}>
            <strong>{actorName}</strong> ({actorRole}) added you to <strong>{projectName}</strong> on VaultStack for {orgName}.
        </Text>

        <Link href={projectUrl} style={commonStyles.button}>
            Open project →
        </Link>

        <Text style={{ ...commonStyles.text, fontSize: '14px', color: '#5E6C84' }}>
            You can now view and manage credentials for this project based on your permissions.
        </Text>
    </BaseEmail>
);

export const renderProjectInvite = async (props: ProjectInviteProps) => ({
    html: await render(<ProjectInvite {...props} />),
    text: await render(<ProjectInvite {...props} />, { plainText: true })
});
