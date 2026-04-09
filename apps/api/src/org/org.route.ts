import { Router } from 'express';
import { z } from 'zod';
import { Route } from '../routes/routes.types';
import { ResponseHandler } from '../utils/responseHandler';
import { body } from '../utils/validator';
import orgService from './org.service';

const orgRouter = Router();

// ─── Teams ────────────────────────────────────────────────────────────────────

// GET /api/v1/org/teams
orgRouter.get('/teams', async (req: any, res, next) => {
    try {
        const result = await orgService.listTeams(String(req.currentUser.organisationId));
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

const teamBodySchema = z.object({
    name:         z.string().min(1),
    description:  z.string().optional(),
    color:        z.string().optional(),
    icon:         z.string().optional(),
    leadId:       z.string().optional(),
    parentTeamId: z.string().optional(),
});

// POST /api/v1/org/teams
orgRouter.post('/teams', body(teamBodySchema), async (req: any, res, next) => {
    try {
        if (req.currentUser.role !== 'SYSADMIN') return next({ statusCode: 403, message: 'SYSADMIN only' });
        const result = await orgService.createTeam(req.body, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// PATCH /api/v1/org/teams/:teamId
orgRouter.patch('/teams/:teamId', body(teamBodySchema.partial()), async (req: any, res, next) => {
    try {
        if (req.currentUser.role !== 'SYSADMIN') return next({ statusCode: 403, message: 'SYSADMIN only' });
        const result = await orgService.updateTeam(req.params.teamId, req.body, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// DELETE /api/v1/org/teams/:teamId
orgRouter.delete('/teams/:teamId', async (req: any, res, next) => {
    try {
        if (req.currentUser.role !== 'SYSADMIN') return next({ statusCode: 403, message: 'SYSADMIN only' });
        const result = await orgService.deleteTeam(req.params.teamId, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// ─── Org chart ────────────────────────────────────────────────────────────────

// GET /api/v1/org/chart
orgRouter.get('/chart', async (req: any, res, next) => {
    try {
        const result = await orgService.getOrgChart(String(req.currentUser.organisationId));
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// ─── Reporting relationships ──────────────────────────────────────────────────

const reportingSchema = z.object({
    reportingTo: z.string().nullable().optional(),
    teamId:      z.string().nullable().optional(),
    isOrgRoot:   z.boolean().optional(),
});

// PATCH /api/v1/org/members/:userId/reporting
orgRouter.patch('/members/:userId/reporting', body(reportingSchema), async (req: any, res, next) => {
    try {
        if (req.currentUser.role !== 'SYSADMIN') return next({ statusCode: 403, message: 'SYSADMIN only' });
        const result = await orgService.updateReporting(req.params.userId, req.body, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// GET /api/v1/org/members/:userId/chain
orgRouter.get('/members/:userId/chain', async (req: any, res, next) => {
    try {
        const result = await orgService.getReportingChain(req.params.userId);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// POST /api/v1/org/members/bulk-assign
const bulkAssignSchema = z.object({
    assignments: z.array(z.object({
        userId:      z.string(),
        reportingTo: z.string().optional(),
        teamId:      z.string().optional(),
    })),
});

orgRouter.post('/members/bulk-assign', body(bulkAssignSchema), async (req: any, res, next) => {
    try {
        if (req.currentUser.role !== 'SYSADMIN') return next({ statusCode: 403, message: 'SYSADMIN only' });
        const result = await orgService.bulkAssign(req.body.assignments, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// ─── Snapshots ────────────────────────────────────────────────────────────────

// GET /api/v1/org/snapshots
orgRouter.get('/snapshots', async (req: any, res, next) => {
    try {
        const result = await orgService.listSnapshots(String(req.currentUser.organisationId));
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// POST /api/v1/org/snapshots
orgRouter.post('/snapshots', body(z.object({ label: z.string().min(1) })), async (req: any, res, next) => {
    try {
        if (req.currentUser.role !== 'SYSADMIN') return next({ statusCode: 403, message: 'SYSADMIN only' });
        const result = await orgService.saveSnapshot(req.body.label, String(req.currentUser.organisationId), req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

export default new Route('/api/v1/org', orgRouter);
