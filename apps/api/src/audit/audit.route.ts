import { Router } from 'express';
import { Route } from '../routes/routes.types';
import { ResponseHandler } from '../utils/responseHandler';
import { queryAuditLogs } from './audit.service';

const auditRouter = Router();

// GET /api/v1/audit-log?action=&actorId=&targetType=&from=&to=&page=&limit=
auditRouter.get('/', async (req: any, res, next) => {
    try {
        const role: string = req.currentUser?.role;
        if (!['SYSADMIN', 'MANAGER'].includes(role)) {
            return next({ statusCode: 403, message: 'FORBIDDEN' });
        }

        const { action, actorId, targetType, from, to, page, limit } = req.query as Record<string, string>;

        const result = await queryAuditLogs({
            organisationId: String(req.currentUser.organisationId),
            action,
            actorId,
            targetType,
            from,
            to,
            page:  page  ? Number(page)  : 1,
            limit: limit ? Number(limit) : 50,
        });

        res.status(200).send(new ResponseHandler({
            statusCode: 200,
            message: 'AUDIT LOGS FETCHED',
            data: result,
        }));
    } catch (e) { next(e); }
});

export default new Route('/api/v1/audit-log', auditRouter);
