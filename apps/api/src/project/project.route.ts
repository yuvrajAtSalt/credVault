import { Router } from 'express';
import { Route } from '../routes/routes.types';
import { ResponseHandler } from '../utils/responseHandler';
import { body } from '../utils/validator';
import { z } from 'zod';
import projectService from './project.service';

const projectRouter = Router();

// ─── GET /api/v1/projects ─────────────────────────────────────────────────────
projectRouter.get('/', async (req: any, res, next) => {
    try {
        const result = await projectService.list(req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// ─── POST /api/v1/projects ────────────────────────────────────────────────────
const createSchema = z.object({
    name:        z.string().min(1, 'Project name is required'),
    description: z.string().optional(),
    color:       z.string().optional(),
    tags:        z.array(z.string()).optional(),
    status:      z.enum(['active', 'archived', 'planning']).optional(),
});

projectRouter.post('/', body(createSchema), async (req: any, res, next) => {
    try {
        const result = await projectService.create(req.body, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// ─── GET /api/v1/projects/:id ─────────────────────────────────────────────────
projectRouter.get('/:id', async (req: any, res, next) => {
    try {
        const result = await projectService.getById(req.params.id, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// ─── PATCH /api/v1/projects/:id ───────────────────────────────────────────────
const updateSchema = z.object({
    name:        z.string().min(1).optional(),
    description: z.string().optional(),
    color:       z.string().optional(),
    tags:        z.array(z.string()).optional(),
    status:      z.enum(['active', 'archived', 'planning']).optional(),
});

projectRouter.patch('/:id', body(updateSchema), async (req: any, res, next) => {
    try {
        const result = await projectService.update(req.params.id, req.body, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// ─── DELETE /api/v1/projects/:id — soft archive, sysadmin only ───────────────
projectRouter.delete('/:id', async (req: any, res, next) => {
    try {
        const result = await projectService.archive(req.params.id, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// ─── POST /api/v1/projects/:id/members ───────────────────────────────────────
const memberSchema = z.object({ userId: z.string().min(1) });

projectRouter.post('/:id/members', body(memberSchema), async (req: any, res, next) => {
    try {
        const result = await projectService.addMember(req.params.id, req.body, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// ─── DELETE /api/v1/projects/:id/members/:userId ──────────────────────────────
projectRouter.delete('/:id/members/:userId', async (req: any, res, next) => {
    try {
        const result = await projectService.removeMember(req.params.id, req.params.userId, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

export default new Route('/api/v1/projects', projectRouter);
