import { Router } from 'express';
import { z } from 'zod';
import { Route } from '../routes/routes.types';
import { ResponseHandler } from '../utils/responseHandler';
import { body } from '../utils/validator';
import envService from './env.service';

const envRouter = Router({ mergeParams: true });

// ─── Environments ─────────────────────────────────────────────────────────────

// GET /api/v1/projects/:projectId/envs
envRouter.get('/', async (req: any, res, next) => {
    try {
        const result = await envService.listEnvironments(req.params.projectId);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// POST /api/v1/projects/:projectId/envs
const createEnvSchema = z.object({
    name:              z.string().min(1),
    description:       z.string().optional(),
    color:             z.string().optional(),
    isBaseEnvironment: z.boolean().optional(),
    cloneFromEnvId:    z.string().optional(),
});
envRouter.post('/', body(createEnvSchema), async (req: any, res, next) => {
    try {
        const result = await envService.createEnvironment(req.params.projectId, req.body, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// ─── STATIC compare route before :envId dynamic ───────────────────────────────

// GET /api/v1/projects/:projectId/envs/compare?envA=&envB=
envRouter.get('/compare', async (req: any, res, next) => {
    try {
        const { envA, envB } = req.query as { envA: string; envB: string };
        if (!envA || !envB) return next({ statusCode: 400, message: 'envA and envB query params required' });
        const result = await envService.compareEnvironments(req.params.projectId, envA, envB);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// ─── :envId dynamic routes ────────────────────────────────────────────────────

// PATCH /api/v1/projects/:projectId/envs/:envId
const updateEnvSchema = z.object({
    name:              z.string().min(1).optional(),
    description:       z.string().optional(),
    color:             z.string().optional(),
    isBaseEnvironment: z.boolean().optional(),
});
envRouter.patch('/:envId', body(updateEnvSchema), async (req: any, res, next) => {
    try {
        const result = await envService.updateEnvironment(req.params.envId, req.body);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// DELETE /api/v1/projects/:projectId/envs/:envId
envRouter.delete('/:envId', async (req: any, res, next) => {
    try {
        const role: string = req.currentUser?.role;
        if (!['SYSADMIN', 'MANAGER'].includes(role)) return next({ statusCode: 403, message: 'FORBIDDEN' });
        const result = await envService.deleteEnvironment(req.params.envId, req.params.projectId, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// ─── Variables ────────────────────────────────────────────────────────────────

// GET /api/v1/projects/:projectId/envs/:envId/variables
envRouter.get('/:envId/variables', async (req: any, res, next) => {
    try {
        const result = await envService.listVariables(req.params.projectId, req.params.envId, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// POST /api/v1/projects/:projectId/envs/:envId/variables/:varId/reveal
envRouter.post('/:envId/variables/:varId/reveal', async (req: any, res, next) => {
    try {
        const result = await envService.revealVariable(req.params.projectId, req.params.envId, req.params.varId, req.currentUser, req.body?.reason);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// GET /api/v1/projects/:projectId/envs/:envId/variables/:varId/reveal
envRouter.get('/:envId/variables/:varId/reveal', async (req: any, res, next) => {
    try {
        const result = await envService.revealVariable(req.params.projectId, req.params.envId, req.params.varId, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// POST /api/v1/projects/:projectId/envs/:envId/variables
const createVarSchema = z.object({
    key:      z.string().regex(/^[A-Z][A-Z0-9_]*$/, 'Key must be uppercase letters, digits, underscores only'),
    value:    z.string().min(1),
    isSecret: z.boolean().optional(),
    group:    z.string().optional(),
    expiresAt: z.string().datetime().optional().nullable(),
    sensitivityLevel: z.enum(['normal', 'sensitive', 'critical']).optional(),
});
envRouter.post('/:envId/variables', body(createVarSchema), async (req: any, res, next) => {
    try {
        const result = await envService.createVariable(req.params.projectId, req.params.envId, req.body, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// POST /api/v1/projects/:projectId/envs/:envId/variables/bulk
const bulkSchema = z.object({
    variables: z.array(z.object({
        key:      z.string().regex(/^[A-Z][A-Z0-9_]*$/),
        value:    z.string(),
        isSecret: z.boolean().optional(),
        group:    z.string().optional(),
    })),
    overwriteExisting: z.boolean(),
});
envRouter.post('/:envId/variables/bulk', body(bulkSchema), async (req: any, res, next) => {
    try {
        const result = await envService.bulkUpsert(req.params.projectId, req.params.envId, req.body, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// PATCH /api/v1/projects/:projectId/envs/:envId/variables/:varId
const updateVarSchema = z.object({
    value:    z.string().optional(),
    isSecret: z.boolean().optional(),
    group:    z.string().optional(),
    expiresAt: z.string().datetime().optional().nullable(),
    sensitivityLevel: z.enum(['normal', 'sensitive', 'critical']).optional(),
});
envRouter.patch('/:envId/variables/:varId', body(updateVarSchema), async (req: any, res, next) => {
    try {
        const result = await envService.updateVariable(req.params.varId, req.params.envId, req.body, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// DELETE /api/v1/projects/:projectId/envs/:envId/variables/:varId
envRouter.delete('/:envId/variables/:varId', async (req: any, res, next) => {
    try {
        const result = await envService.deleteVariable(req.params.varId, req.params.envId, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// GET /api/v1/projects/:projectId/envs/:envId/export?format=dotenv|json|yaml
envRouter.get('/:envId/export', async (req: any, res, next) => {
    try {
        const format = (req.query.format as string) || 'dotenv';
        const reason = (req.query.reason as string);
        const { content, contentType, filename } = await envService.exportEnvironment(
            req.params.projectId, req.params.envId, format, req.currentUser, reason,
        );
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(content);
    } catch (e) { next(e); }
});

export default new Route('/api/v1/projects/:projectId/envs', envRouter);
