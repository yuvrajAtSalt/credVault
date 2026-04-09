import fs from 'fs';
import path from 'path';
import os from 'os';
import { EmailAdapter, SendEmailParams } from '../index';

export class ConsoleAdapter implements EmailAdapter {
    private outDir: string;

    constructor() {
        this.outDir = path.join(os.tmpdir(), 'vaultstack-emails');
        if (!fs.existsSync(this.outDir)) {
            fs.mkdirSync(this.outDir, { recursive: true });
        }
    }

    async send(params: SendEmailParams): Promise<{ messageId: string }> {
        const id = `local-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const toStr = Array.isArray(params.to) ? params.to.join(', ') : params.to;

        console.log(`\n================= EMAIL DISPATCH =================`);
        console.log(`MESSAGE ID: ${id}`);
        console.log(`TO:         ${toStr}`);
        console.log(`SUBJECT:    ${params.subject}`);
        console.log(`PREVIEW:    http://localhost:3050/api/v1/dev/email-preview/latest?id=${id}`);
        console.log(`==================================================\n`);

        const filePath = path.join(this.outDir, `${id}.html`);
        fs.writeFileSync(filePath, params.html || params.text);

        // Also write a latest.html for pure easy opening
        fs.writeFileSync(path.join(this.outDir, 'latest.html'), params.html || params.text);

        return { messageId: id };
    }
}
