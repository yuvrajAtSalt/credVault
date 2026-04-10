import { Router, Request, Response, NextFunction } from 'express';
import { Route } from './routes.types';
import { registerSSEConnection } from '../sse/sse';
import jwt from 'jsonwebtoken';
import { UserModel } from '../user/user.schema';

const realtimeRouter = Router();

// Validate user for SSE connection
realtimeRouter.get('/events', async (req: Request | any, res: Response, next: NextFunction) => {
    let user = req.currentUser;
    
    // Fallback to query param since EventSource doesn't support headers
    if (!user && req.query.token) {
        try {
            const decoded: any = jwt.verify(req.query.token as string, process.env.VAULT_JWT_SECRET as string);
            user = await UserModel.findById(decoded._id).select('-password').lean();
        } catch (e) {
            // fail silently and let the 401 block catch it
        }
    }

    if (!user) {
        return res.status(401).send('Unauthorized');
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for Nginx
    res.flushHeaders();

    const userId = String(user._id);
    registerSSEConnection(userId, res);

    // Initial keepalive to flush headers
    res.write('event: connected\ndata: "ok"\n\n');

    // Keep connection open with a heartbeat
    const heartbeat = setInterval(() => {
        if (res.writableEnded) {
            clearInterval(heartbeat);
            return;
        }
        res.write(':\n\n'); // SSE comment to keep connection alive
    }, 30000);

    res.on('close', () => {
        clearInterval(heartbeat);
    });
});

export default new Route('/api/v1/realtime', realtimeRouter);
