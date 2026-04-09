import { Router } from 'express';
import { z } from 'zod';
import { Route } from '../routes/routes.types';
import { ResponseHandler } from '../utils/responseHandler';
import { body } from '../utils/validator';
import notifService from './notification.service';

const notifRouter = Router();

// GET /api/v1/notifications
notifRouter.get('/', async (req: any, res, next) => {
    try {
        const read  = req.query.read === 'false' ? false : undefined;
        const page  = Number(req.query.page)  || 1;
        const limit = Number(req.query.limit) || 20;
        const result = await notifService.listNotifications(String(req.currentUser._id), { read, page, limit });
        res.setHeader('X-Unread-Count', String(result.unreadCount));
        res.status(200).send(new ResponseHandler({ statusCode: 200, message: 'NOTIFICATIONS FETCHED', data: result }));
    } catch (e) { next(e); }
});

// GET /api/v1/notifications/unread-count
notifRouter.get('/unread-count', async (req: any, res, next) => {
    try {
        const count = await notifService.getUnreadCount(String(req.currentUser._id));
        res.status(200).send(new ResponseHandler({ statusCode: 200, message: 'COUNT FETCHED', data: { count } }));
    } catch (e) { next(e); }
});

// POST /api/v1/notifications/read
const readSchema = z.object({
    ids: z.array(z.string()).optional(),
    all: z.boolean().optional(),
});
notifRouter.post('/read', body(readSchema), async (req: any, res, next) => {
    try {
        await notifService.markRead(String(req.currentUser._id), req.body.ids, req.body.all);
        res.status(200).send(new ResponseHandler({ statusCode: 200, message: 'MARKED READ' }));
    } catch (e) { next(e); }
});

// DELETE /api/v1/notifications/:id
notifRouter.delete('/:id', async (req: any, res, next) => {
    try {
        await notifService.deleteNotification(String(req.currentUser._id), req.params.id);
        res.status(200).send(new ResponseHandler({ statusCode: 200, message: 'DELETED' }));
    } catch (e) { next(e); }
});

export default new Route('/api/v1/notifications', notifRouter);
