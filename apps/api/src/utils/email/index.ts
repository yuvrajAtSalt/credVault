export interface SendEmailParams {
    to: string | string[];
    subject: string;
    html: string;
    text: string;            // plain-text fallback — always required
    replyTo?: string;
    tags?: Record<string, string>;   // for provider-level analytics tagging
}

export interface EmailAdapter {
    send(params: SendEmailParams): Promise<{ messageId: string }>;
}

export function getEmailAdapter(): EmailAdapter {
    const provider = (process.env.EMAIL_PROVIDER || 'console').toLowerCase();

    if (provider === 'resend') {
        const { ResendAdapter } = require('./adapters/resend');
        return new ResendAdapter();
    }
    if (provider === 'smtp') {
        const { SmtpAdapter } = require('./adapters/smtp');
        return new SmtpAdapter();
    }
    
    // Default to console
    const { ConsoleAdapter } = require('./adapters/console');
    return new ConsoleAdapter();
}
