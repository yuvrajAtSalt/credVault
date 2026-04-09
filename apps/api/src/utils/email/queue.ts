import { getEmailAdapter, SendEmailParams } from './index';
import { EmailQueueModel } from '../../email/email-queue.schema';

/**
 * Pushes an email to the queue for background processing.
 */
export async function enqueueEmail(params: SendEmailParams) {
    if (process.env.NODE_ENV === 'test') return;

    try {
        await EmailQueueModel.create({
            to: Array.isArray(params.to) ? params.to.join(',') : params.to,
            subject: params.subject,
            html: params.html,
            text: params.text,
            status: 'pending',
        });
    } catch (e) {
        console.error('[EMAIL QUEUE ERROR]', e);
        // Fallback to sending immediately, fire and forget if queue fails
        try {
            getEmailAdapter().send(params).catch(console.error);
        } catch (e2) {}
    }
}
