import { Router } from 'express';
import { z } from 'zod';
import { Route } from '../routes/routes.types';
import { ResponseHandler } from '../utils/responseHandler';
import { body } from '../utils/validator';
import permRequestService from './permission-request.service';
import { ALL_PERMISSIONS } from '../utils/constants';

const permReqRouter = Router();

const sysadminOnly = (req: any, res: any, next: any) => {
    if (req.currentUser?.role !== 'SYSADMIN') return next({ statusCode: 403, message: 'SYSADMIN ONLY' });
    next();
};

// POST /api/v1/permissions/request  (any authenticated user)
const submitSchema = z.object({
    permission: z.enum([...ALL_PERMISSIONS] as [string, ...string[]]),
    reason:     z.string().min(1, 'Reason is required'),
    projectId:  z.string().optional().nullable(),
});
permReqRouter.post('/request', body(submitSchema), async (req: any, res, next) => {
    try {
        const result = await permRequestService.submitRequest(req.body, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// GET /api/v1/permissions/admin/requests  (sysadmin)
permReqRouter.get('/admin/requests', sysadminOnly, async (req: any, res, next) => {
    try {
        const result = await permRequestService.listRequests(req.currentUser, req.query);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// POST /api/v1/permissions/admin/requests/:requestId/approve  (sysadmin)
permReqRouter.post('/admin/requests/:requestId/approve', sysadminOnly, async (req: any, res, next) => {
    try {
        const result = await permRequestService.approveRequest(req.params.requestId, req.body, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// POST /api/v1/permissions/admin/requests/:requestId/reject  (sysadmin)
const rejectSchema = z.object({ reviewNote: z.string().min(1) });
permReqRouter.post('/admin/requests/:requestId/reject', sysadminOnly, body(rejectSchema), async (req: any, res, next) => {
    try {
        const result = await permRequestService.rejectRequest(req.params.requestId, req.body, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

export default new Route('/api/v1/permissions', permReqRouter);
