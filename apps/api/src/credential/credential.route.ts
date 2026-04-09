import { Router } from 'express';
import { Route } from '../routes/routes.types';
import { ResponseHandler } from '../utils/responseHandler';
import { body } from '../utils/validator';
import { z } from 'zod';
import credentialService from './credential.service';
import { CREDENTIAL_CATEGORIES, CREDENTIAL_ENVIRONMENTS } from './credential.types';
import { revealRateLimiter } from '../utils/rateLimit';

const credentialRouter = Router({ mergeParams: true });

// ─── GET /api/v1/projects/:id/credentials ─────────────────────────────────────
credentialRouter.get('/', async (req: any, res, next) => {
    try {
        const result = await credentialService.list(req.params.id, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// ─── POST /api/v1/projects/:id/credentials ───────────────────────────────────
const createSchema = z.object({
    category:    z.enum([...CREDENTIAL_CATEGORIES] as [string, ...string[]]),
    label:       z.string().min(1, 'Label is required'),
    value:       z.string().min(1, 'Value is required'),
    isSecret:    z.boolean().optional(),
    environment: z.enum([...CREDENTIAL_ENVIRONMENTS] as [string, ...string[]]).optional(),
});

credentialRouter.post('/', body(createSchema), async (req: any, res, next) => {
    try {
        const result = await credentialService.create(req.params.id, req.body, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// ─── STATIC routes MUST come before /:credId dynamic routes ──────────────────

// GET /api/v1/projects/:id/credentials/visibility ─────────────────────────────
credentialRouter.get('/visibility', async (req: any, res, next) => {
    try {
        const result = await credentialService.listGrants(req.params.id, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// POST /api/v1/projects/:id/credentials/visibility ────────────────────────────
const grantSchema = z.object({
    userId: z.string().min(1),
    scope:  z.enum(['all', 'own']),
});

credentialRouter.post('/visibility', body(grantSchema), async (req: any, res, next) => {
    try {
        const result = await credentialService.upsertGrant(req.params.id, req.body, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// ─── DYNAMIC /:credId routes ──────────────────────────────────────────────────

// GET /api/v1/projects/:id/credentials/:credId/reveal ───────────────────────
credentialRouter.get('/:credId/reveal', revealRateLimiter, async (req: any, res, next) => {
    try {
        const result = await credentialService.reveal(req.params.id, req.params.credId, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// PATCH /api/v1/projects/:id/credentials/:credId ──────────────────────────────
const updateSchema = z.object({
    label:       z.string().min(1).optional(),
    value:       z.string().min(1).optional(),
    isSecret:    z.boolean().optional(),
    environment: z.enum([...CREDENTIAL_ENVIRONMENTS] as [string, ...string[]]).optional(),
});

credentialRouter.patch('/:credId', body(updateSchema), async (req: any, res, next) => {
    try {
        const result = await credentialService.update(req.params.id, req.params.credId, req.body, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// DELETE /api/v1/projects/:id/credentials/:credId ─────────────────────────────
credentialRouter.delete('/:credId', async (req: any, res, next) => {
    try {
        const result = await credentialService.softDelete(req.params.id, req.params.credId, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

export default new Route('/api/v1/projects/:id/credentials', credentialRouter);

