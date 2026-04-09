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
            user = await UserModel.findById(decoded.id).select('-password').lean();
        } catch (e) {
            // fail silently and let the 401 block catch it
        }
    }

    if (!user) {
        return res.status(401).send('Unauthorized');
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable buffering for Nginx
    });

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
