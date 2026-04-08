import { Router } from 'express';
import { Route } from '../routes/routes.types';
import { ResponseHandler } from '../utils/responseHandler';
import { body } from '../utils/validator';
import { z } from 'zod';
import memberService from './member.service';
import { VAULT_ROLES } from '../utils/constants';

const memberRouter = Router();

// ─── GET /api/v1/members ──────────────────────────────────────────────────────
memberRouter.get('/', async (req: any, res, next) => {
    try {
        const { role, search, department } = req.query as Record<string, string>;
        const result = await memberService.list(req.currentUser, { role, search, department });
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// ─── GET /api/v1/members/org-chart ── static route BEFORE /:id ────────────────
memberRouter.get('/org-chart', async (req: any, res, next) => {
    try {
        const result = await memberService.orgChart(req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// ─── GET /api/v1/members/:id ──────────────────────────────────────────────────
memberRouter.get('/:id', async (req: any, res, next) => {
    try {
        const result = await memberService.getById(req.params.id, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// ─── PATCH /api/v1/members/:id ───────────────────────────────────────────────
const updateSchema = z.object({
    name:        z.string().min(1).optional(),
    role:        z.enum([...VAULT_ROLES] as [string, ...string[]]).optional(),
    jobTitle:    z.string().optional(),
    department:  z.string().optional(),
    avatarUrl:   z.string().url().optional(),
    reportingTo: z.string().optional(),
    isActive:    z.boolean().optional(),
});

memberRouter.patch('/:id', body(updateSchema), async (req: any, res, next) => {
    try {
        const result = await memberService.update(req.params.id, req.body, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// ─── POST /api/v1/members/:id/deactivate ─────────────────────────────────────
memberRouter.post('/:id/deactivate', async (req: any, res, next) => {
    try {
        const result = await memberService.deactivate(req.params.id, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

export default new Route('/api/v1/members', memberRouter);
