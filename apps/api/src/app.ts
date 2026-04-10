import 'express-async-errors';
import express from 'express';
import { createServer } from 'http';
import { registerMiddlewares } from './routes/routes';
import { connectToMongoDB } from './connections/connectToMongo';
import { validateEnv } from './utils/env-validator';

validateEnv();

export const startServer = async () => {
    try {
        const app = express();
        const httpServer = createServer(app);

        await connectToMongoDB();

        registerMiddlewares(app);

        const port = Number(process.env.PORT) || 5050;
        httpServer.on('error', (err: NodeJS.ErrnoException) => {
            if (err.code === 'EADDRINUSE') {
                console.error(
                    `[api] Port ${port} is already in use (another API server is probably still running).`,
                );
                console.error(
                    `[api] Windows: netstat -ano | findstr :${port}  →  note the PID, then: taskkill /PID <pid> /F`,
                );
                process.exit(1);
            }
            throw err;
        });
        httpServer.listen(port, () => {
            console.log(`[VaultStack] SERVER UP AND RUNNING ON PORT ${port}`);
        });
    } catch (e) {
        console.log(e);
        process.exit(1);
    }
};

startServer();
