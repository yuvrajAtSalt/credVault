import * as React from 'react';
import { Text, render, Link } from '@react-email/components';
import { BaseEmail, commonStyles } from './BaseEmail';

interface ProjectRemovedProps {
    recipientName: string;
    actorName: string;
    projectName: string;
    dashboardUrl: string;
    hadResidualAccess?: boolean;
    email?: string;
}

export const ProjectRemoved = ({ recipientName, actorName, projectName, dashboardUrl, hadResidualAccess, email }: ProjectRemovedProps) => (
    <BaseEmail previewText={`You've been removed from ${projectName}`} email={email}>
        <Text style={commonStyles.h1}>Access Revoked</Text>
        <Text style={commonStyles.text}>Hi {recipientName},</Text>
        <Text style={commonStyles.text}>
            You have been removed from the project <strong>{projectName}</strong> by <strong>{actorName}</strong>.
        </Text>

        {hadResidualAccess && (
            <Text style={{ ...commonStyles.text, color: '#FF5630', fontSize: '14px', backgroundColor: 'rgba(255, 86, 48, 0.1)', padding: '10px', borderRadius: '4px' }}>
                Note: You may still have residual access to certain credentials via specific permission grants. You can view these in your dashboard.
            </Text>
        )}

        <Link href={dashboardUrl} style={commonStyles.button}>
            Go to dashboard →
        </Link>
    </BaseEmail>
);

export const renderProjectRemoved = async (props: ProjectRemovedProps) => ({
    html: await render(<ProjectRemoved {...props} />),
    text: await render(<ProjectRemoved {...props} />, { plainText: true })
});
