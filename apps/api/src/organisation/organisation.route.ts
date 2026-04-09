import { Router } from 'express';
import { z } from 'zod';
import { Route } from '../routes/routes.types';
import { ResponseHandler } from '../utils/responseHandler';
import { body } from '../utils/validator';
import { getOrgById, updateOrg } from './organisation.service';

const orgRouter = Router();

// GET /api/v1/organisation
orgRouter.get('/', async (req: any, res, next) => {
    try {
        const org = await getOrgById(String(req.currentUser.organisationId));
        if (!org) return next({ statusCode: 404, message: 'ORGANISATION NOT FOUND' });
        res.status(200).send(new ResponseHandler({ statusCode: 200, message: 'ORGANISATION FETCHED', data: org }));
    } catch (e) { next(e); }
});

// PATCH /api/v1/organisation
const updateOrgSchema = z.object({
    name:      z.string().min(1).optional(),
    logoUrl:   z.string().url().optional().or(z.literal('')),
    hierarchy: z.array(z.string()).optional(),
});

orgRouter.patch('/', body(updateOrgSchema), async (req: any, res, next) => {
    try {
        const role: string = req.currentUser?.role;
        if (role !== 'SYSADMIN') return next({ statusCode: 403, message: 'FORBIDDEN — SYSADMIN ONLY' });

        const updated = await updateOrg(String(req.currentUser.organisationId), req.body);
        res.status(200).send(new ResponseHandler({ statusCode: 200, message: 'ORGANISATION UPDATED', data: updated }));
    } catch (e) { next(e); }
});

export default new Route('/api/v1/organisation', orgRouter);
