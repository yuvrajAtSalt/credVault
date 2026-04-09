import { Resend } from 'resend';
import { EmailAdapter, SendEmailParams } from '../index';

export class ResendAdapter implements EmailAdapter {
    private resend: Resend;
    private from: string;

    constructor() {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) throw new Error('RESEND_API_KEY is required when using the resend provider');
        
        this.resend = new Resend(apiKey);
        
        const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'noreply@yourcompany.com';
        const fromName = process.env.EMAIL_FROM_NAME || 'VaultStack';
        this.from = `${fromName} <${fromAddress}>`;
    }

    async send(params: SendEmailParams): Promise<{ messageId: string }> {
        const toList = Array.isArray(params.to) ? params.to : [params.to];
        
        const { data, error } = await this.resend.emails.send({
            from: this.from,
            to: toList,
            subject: params.subject,
            html: params.html,
            text: params.text,
            replyTo: params.replyTo,
            tags: params.tags ? Object.entries(params.tags).map(([name, value]) => ({ name, value })) : undefined,
        });

        if (error) {
            throw new Error(`Resend API Error: ${error.message}`);
        }

        return { messageId: data?.id || 'unknown' };
    }
}
