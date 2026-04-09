import * as React from 'react';
import {
    Html,
    Head,
    Body,
    Container,
    Section,
    Text,
    Preview,
    Img,
    Link,
    Hr
} from '@react-email/components';

interface BaseEmailProps {
    previewText: string;
    children: React.ReactNode;
    email?: string;
}

export const BaseEmail: React.FC<BaseEmailProps> = ({ previewText, children, email }) => {
    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Body style={main}>
                <Container style={container}>
                    <Section style={header}>
                        <Text style={logoText}>VaultStack</Text>
                    </Section>
                    
                    <Section style={contentBox}>
                        {children}
                    </Section>
                    
                    <Section style={footer}>
                        <Hr style={hr} />
                        <Text style={footerText}>
                            © {new Date().getFullYear()} VaultStack
                        </Text>
                        {email && (
                            <Text style={footerText}>
                                This email was sent to <Link href={`mailto:${email}`} style={footerLink}>{email}</Link>
                            </Text>
                        )}
                    </Section>
                </Container>
            </Body>
        </Html>
    );
};

// Styles
const main = {
    backgroundColor: '#F4F5F7',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container = {
    margin: '0 auto',
    padding: '40px 20px',
    maxWidth: '600px',
};

const header = {
    padding: '0 0 20px 0',
    textAlign: 'center' as const,
};

const logoText = {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#172B4D',
    margin: '0',
    letterSpacing: '-0.5px'
};

const contentBox = {
    backgroundColor: '#FFFFFF',
    borderRadius: '8px',
    padding: '40px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)',
};

const footer = {
    padding: '20px 0',
    textAlign: 'center' as const,
};

const hr = {
    borderColor: '#DFE1E6',
    margin: '20px 0',
};

const footerText = {
    color: '#6B778C',
    fontSize: '12px',
    lineHeight: '16px',
    margin: '4px 0',
};

const footerLink = {
    color: '#6B778C',
    textDecoration: 'underline',
};

export const commonStyles = {
    h1: {
        color: '#172B4D',
        fontSize: '24px',
        fontWeight: 'bold',
        margin: '0 0 20px 0',
    },
    text: {
        color: '#172B4D',
        fontSize: '16px',
        lineHeight: '24px',
        margin: '0 0 20px 0',
    },
    button: {
        backgroundColor: '#0052CC',
        borderRadius: '4px',
        color: '#fff',
        display: 'inline-block',
        fontSize: '16px',
        fontWeight: 'bold',
        lineHeight: '50px',
        textAlign: 'center' as const,
        textDecoration: 'none',
        width: '100%',
        margin: '10px 0 30px',
    },
    bulletList: {
        margin: '0 0 20px 0',
        padding: '0 0 0 20px',
    },
    bulletItem: {
        color: '#172B4D',
        fontSize: '16px',
        lineHeight: '24px',
        margin: '0 0 8px 0',
    },
    codeBlock: {
        backgroundColor: '#F4F5F7',
        borderRadius: '4px',
        padding: '16px',
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#172B4D',
        textAlign: 'center' as const,
        letterSpacing: '2px',
        margin: '0 0 20px 0',
    }
};
