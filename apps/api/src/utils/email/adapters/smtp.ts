import nodemailer from 'nodemailer';
import { EmailAdapter, SendEmailParams } from '../index';

export class SmtpAdapter implements EmailAdapter {
    private transporter: nodemailer.Transporter;
    private from: string;

    constructor() {
        if (!process.env.SMTP_HOST) throw new Error('SMTP_HOST is required for smtp provider');
        if (!process.env.SMTP_PORT) throw new Error('SMTP_PORT is required for smtp provider');

        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT),
            secure: process.env.SMTP_SECURE === 'true',
            auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            } : undefined,
        });

        const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'noreply@yourcompany.com';
        const fromName = process.env.EMAIL_FROM_NAME || 'VaultStack';
        this.from = `"${fromName}" <${fromAddress}>`;
    }

    async send(params: SendEmailParams): Promise<{ messageId: string }> {
        const toList = Array.isArray(params.to) ? params.to.join(', ') : params.to;

        const info = await this.transporter.sendMail({
            from: this.from,
            to: toList,
            subject: params.subject,
            html: params.html,
            text: params.text,
            replyTo: params.replyTo,
            // nodemailer headers could be used for tags, but generally SMTP doesn't natively support "tags" like Resend does natively
        });

        return { messageId: info.messageId || 'unknown' };
    }
}
