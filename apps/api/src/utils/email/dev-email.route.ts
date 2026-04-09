import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Route } from '../../routes/routes.types';

const devEmailRouter = Router();

// Dev only check just to be absolutely sure
devEmailRouter.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).send('Not available in production');
    }
    next();
});

devEmailRouter.get('/email-preview/latest', (req, res) => {
    const id = req.query.id as string;
    const outDir = path.join(os.tmpdir(), 'vaultstack-emails');
    
    let filePath = path.join(outDir, 'latest.html');
    if (id) {
        filePath = path.join(outDir, `${id}.html`);
    }

    if (!fs.existsSync(filePath)) {
        return res.status(404).send('No preview available');
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    res.setHeader('Content-Type', 'text/html');
    res.send(content);
});

export default new Route('/api/v1/dev', devEmailRouter);
