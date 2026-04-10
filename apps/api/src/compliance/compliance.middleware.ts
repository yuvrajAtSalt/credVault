import { Request, Response, NextFunction } from 'express';
import complianceService from './compliance.service';
import { BASE_PERMISSIONS, VaultRole } from '../utils/constants';

/**
 * Middleware to block mutations (POST/PATCH/DELETE) if outside a Change Window.
 * Bypassed for SYSADMINs or specific emergency override (if we implement it).
 */
export const checkChangeWindow = async (req: Request, res: Response, next: NextFunction) => {
    // Only block mutations
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }

    const user = (req as any).currentUser;
    if (!user) return next();

    // Sysadmins bypass change windows
    if (user.role === 'SYSADMIN') {
        return next();
    }

    // Check if mutation is allowed
    const projectId = (req.params.projectId || req.params.id) as string;
    const allowed = await complianceService.validateMutationAllowed(user.organisationId, projectId);

    if (!allowed) {
        return res.status(403).json({
            error: {
                message: 'Mutation blocked by Change Window policy. You can only modify credentials during approved maintenance windows.',
                code: 'CHANGE_WINDOW_BLOCKED'
            }
        });
    }

    next();
};
