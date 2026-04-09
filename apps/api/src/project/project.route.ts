import { Router } from 'express';
import { Route } from '../routes/routes.types';
import { ResponseHandler } from '../utils/responseHandler';
import { body } from '../utils/validator';
import { z } from 'zod';
import projectService from './project.service';
import governanceService from './governance.service';

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

projectRouter.delete('/:id/members/:userId', async (req: any, res, next) => {
    try {
        const revokeResidual = req.query.revokeResidual === 'true';
        const result = await projectService.removeMember(req.params.id, req.params.userId, req.currentUser, revokeResidual);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// ─── POST /api/v1/projects/:id/reactivate (Phase 10) ─────────────────────────
projectRouter.post('/:id/reactivate', async (req: any, res, next) => {
    try {
        const result = await governanceService.reactivate(req.params.id, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// ─── POST /api/v1/projects/:id/handover (Phase 10) ───────────────────────────
const handoverSchema = z.object({ newManagerId: z.string().min(1) });
projectRouter.post('/:id/handover', body(handoverSchema), async (req: any, res, next) => {
    try {
        const result = await governanceService.handover(req.params.id, req.body.newManagerId, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// ─── DELETE /api/v1/projects/:id/visibility/:userId/revoke-all (Phase 10) ────
projectRouter.delete('/:id/visibility/:userId/revoke-all', async (req: any, res, next) => {
    try {
        const result = await governanceService.revokeResidualAccess(req.params.id, req.params.userId, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// ─── PATCH /api/v1/projects/:id/members/:userId (Phase 10) ───────────────────
const updateMemberSchema = z.object({
    memberType: z.enum(['contributor', 'observer']).optional(),
    projectRole: z.string().optional(),
});
projectRouter.patch('/:id/members/:userId', body(updateMemberSchema), async (req: any, res, next) => {
    try {
        const result = await governanceService.updateMember(req.params.id, req.params.userId, req.body, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// ─── Credential Categories (Phase 10) ─────────────────────────────────────────

projectRouter.post('/:id/credential-categories', body(z.object({
    name: z.string().min(1), icon: z.string().optional(), slug: z.string().min(1),
})), async (req: any, res, next) => {
    try {
        const result = await governanceService.addCustomCategory(req.params.id, req.body, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// ─── Project Links (Phase 11) ────────────────────────────────────────────────
const linkSchema = z.object({ title: z.string().min(1), url: z.string().url() });
projectRouter.post('/:id/links', body(linkSchema), async (req: any, res, next) => {
    try {
        const result = await governanceService.addProjectLink(req.params.id, req.body, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

projectRouter.delete('/:id/links/:linkId', async (req: any, res, next) => {
    try {
        const result = await governanceService.removeProjectLink(req.params.id, req.params.linkId, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

export default new Route('/api/v1/projects', projectRouter);
