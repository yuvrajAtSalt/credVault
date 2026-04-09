import { Router } from 'express';
import { Route } from '../routes/routes.types';
import { EmailQueueModel } from '../email/email-queue.schema';
import { getEmailAdapter } from '../utils/email';
import { CredentialModel } from '../credential/credential.schema';
import { ProjectModel } from '../project/project.schema';
import { UserModel } from '../user/user.schema';
import { enqueueEmail } from '../utils/email/queue';
import { templates } from '../utils/email/templates';
import { pushToUser } from '../sse/sse';

const cronRouter = Router();

// Minimal built-in cron protection
cronRouter.use((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!process.env.CRON_SECRET) {
        return next(); // or block depending on strictness
    }
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).send('Unauthorized CRON');
    }
    next();
});

cronRouter.get('/check-expiry', async (req, res) => {
    try {
        const soon = new Date();
        soon.setDate(soon.getDate() + 7); // 7 days window

        const expiringCreds = await CredentialModel.find({
            isDeleted: false,
            expiresAt: { $lte: soon, $gt: new Date() },
            $or: [
                { lastExpiryNoticeSentAt: { $exists: false } },
                { lastExpiryNoticeSentAt: null },
                { lastExpiryNoticeSentAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } // Only 1 notice per day
            ]
        }).populate('projectId');

        if (expiringCreds.length === 0) return res.json({ status: 'idle', count: 0 });

        // Group by project
        const projectGroups = new Map<string, any[]>();
        for (const cred of expiringCreds as any[]) {
            const pid = String(cred.projectId._id || cred.projectId);
            if (!projectGroups.has(pid)) projectGroups.set(pid, []);
            projectGroups.get(pid)!.push(cred);
        }

        let totalEmails = 0;

        for (const [projectId, creds] of projectGroups.entries()) {
            const project = await ProjectModel.findById(projectId).lean() as any;
            if (!project) continue;

            const memberIds = project.members.map((m: any) => String(m.userId?._id || m.userId));
            const users = await UserModel.find({ _id: { $in: memberIds }, isActive: true }).lean();

            const itemsStr = creds.map(c => ({
                label: c.label,
                projectName: project.name,
                expiresAt: new Date(c.expiresAt).toLocaleDateString(),
                url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3050'}/projects/${project._id}`
            }));

            for (const u of users) {
                await enqueueEmail({
                    to: u.email,
                    subject: 'Action Required: Credentials expiring soon',
                    ...(await templates.CredentialExpiringSoon({
                        recipientName: u.name,
                        credentials: itemsStr,
                        email: u.email
                    }))
                });
                
                // Push real-time event for connected users
                pushToUser(String(u._id), {
                    type: 'credential_expiry_warning',
                    data: { count: creds.length, projectId }
                });
                
                totalEmails++;
            }

            // Mark as sent
            await CredentialModel.updateMany(
                { _id: { $in: creds.map(c => c._id) } },
                { $set: { lastExpiryNoticeSentAt: new Date() } }
            );
        }

        res.json({ status: 'complete', count: totalEmails, credentialsProcessed: expiringCreds.length });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

cronRouter.get('/process-email-queue', async (req, res) => {
    try {
        const emails = await EmailQueueModel.find({
            status: { $in: ['pending', 'failed'] },
            $expr: { $lt: ['$attempts', '$maxAttempts'] }
        })
        .sort({ createdAt: 1 })
        .limit(10);
        
        if (emails.length === 0) {
            return res.json({ processed: 0, status: 'idle' });
        }
        
        const adapter = getEmailAdapter();
        let processed = 0, failed = 0;
        
        for (const email of emails) {
            email.attempts += 1;
            email.lastAttemptAt = new Date();
            
            try {
                await adapter.send({
                    to: email.to,
                    subject: email.subject,
                    html: email.html,
                    text: email.text,
                });
                email.status = 'sent';
                processed++;
            } catch (err: any) {
                email.status = 'failed';
                email.error = err.message || 'Unknown error';
                failed++;
            }
            
            await email.save();
        }
        
        res.json({ processed, failed, status: 'complete' });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default new Route('/api/v1/cron', cronRouter);
