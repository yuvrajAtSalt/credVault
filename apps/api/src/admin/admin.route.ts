import { Router } from 'express';
import { z } from 'zod';
import { Route } from '../routes/routes.types';
import { ResponseHandler } from '../utils/responseHandler';
import { body } from '../utils/validator';
import adminService from './admin.service';
import { ALL_PERMISSIONS, VAULT_ROLES } from '../utils/constants';

const adminRouter = Router();

// ─── Guard: sysadmin only ─────────────────────────────────────────────────────
const sysadminOnly = (req: any, res: any, next: any) => {
    if (req.currentUser?.role !== 'SYSADMIN') {
        return next({ statusCode: 403, message: 'SYSADMIN ONLY' });
    }
    next();
};

// ═══════════════════════════════════════════════════════════════════════════════
// USER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/v1/admin/users
adminRouter.get('/users', sysadminOnly, async (req: any, res, next) => {
    try {
        const result = await adminService.listUsers(req.currentUser, req.query as any);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// POST /api/v1/admin/users
const createUserSchema = z.object({
    name:                z.string().min(1),
    email:               z.string().email(),
    password:            z.string().min(8),
    role:                z.enum([...VAULT_ROLES] as [string, ...string[]]).optional(),
    customRoleId:        z.string().optional(),
    forcePasswordChange: z.boolean().optional(),
    jobTitle:            z.string().optional(),
    department:          z.string().optional(),
    teamId:              z.string().optional(),
    reportingTo:         z.string().optional(),
    isOrgRoot:           z.boolean().optional(),
});

adminRouter.post('/users', sysadminOnly, body(createUserSchema), async (req: any, res, next) => {
    try {
        const result = await adminService.createUser(req.body, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// PATCH /api/v1/admin/users/:userId
adminRouter.patch('/users/:userId', sysadminOnly, async (req: any, res, next) => {
    try {
        const result = await adminService.updateUser(req.params.userId, req.body, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// POST /api/v1/admin/users/:userId/reactivate
adminRouter.post('/users/:userId/reactivate', sysadminOnly, async (req: any, res, next) => {
    try {
        const result = await adminService.reactivateUser(req.params.userId, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// POST /api/v1/admin/users/:userId/reset-password
const resetPwSchema = z.object({
    newPassword:         z.string().min(8),
    forcePasswordChange: z.boolean().optional(),
});
adminRouter.post('/users/:userId/reset-password', sysadminOnly, body(resetPwSchema), async (req: any, res, next) => {
    try {
        const result = await adminService.resetPassword(req.params.userId, req.body, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM ROLES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/v1/admin/roles
adminRouter.get('/roles', sysadminOnly, async (req: any, res, next) => {
    try {
        const result = await adminService.listRoles(req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

const roleBodySchema = z.object({
    name:        z.string().min(1),
    description: z.string().optional(),
    color:       z.string().optional(),
    badgeLabel:  z.string().max(8),
    permissions: z.object({
        canSeeAllProjects:    z.boolean(),
        canCreateProject:     z.boolean(),
        canAddCredential:     z.boolean(),
        canManageTeam:        z.boolean(),
        canGrantVisibility:   z.boolean(),
        canSeeAllCredentials: z.boolean(),
        canManageRoles:       z.boolean(),
        canManageMembers:     z.boolean(),
        canViewAuditLog:      z.boolean(),
        canManageOrgSettings: z.boolean(),
        isGod:                z.boolean(),
    }),
});

// POST /api/v1/admin/roles
adminRouter.post('/roles', sysadminOnly, body(roleBodySchema), async (req: any, res, next) => {
    try {
        const result = await adminService.createRole(req.body, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// PATCH /api/v1/admin/roles/:roleId
adminRouter.patch('/roles/:roleId', sysadminOnly, async (req: any, res, next) => {
    try {
        const result = await adminService.updateRole(req.params.roleId, req.body, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// DELETE /api/v1/admin/roles/:roleId
adminRouter.delete('/roles/:roleId', sysadminOnly, async (req: any, res, next) => {
    try {
        const result = await adminService.deleteRole(req.params.roleId, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SPECIAL PERMISSIONS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/v1/admin/users/:userId/permissions
adminRouter.get('/users/:userId/permissions', sysadminOnly, async (req: any, res, next) => {
    try {
        const result = await adminService.getUserPermissions(req.params.userId, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// POST /api/v1/admin/users/:userId/permissions/grant
const grantSchema = z.object({
    permission: z.enum([...ALL_PERMISSIONS] as [string, ...string[]]),
    value:      z.boolean(),
    reason:     z.string().min(1),
    expiresAt:  z.string().datetime().optional().nullable(),
});
adminRouter.post('/users/:userId/permissions/grant', sysadminOnly, body(grantSchema), async (req: any, res, next) => {
    try {
        const result = await adminService.grantPermission(req.params.userId, req.body, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// DELETE /api/v1/admin/users/:userId/permissions/:permissionName
adminRouter.delete('/users/:userId/permissions/:permissionName', sysadminOnly, async (req: any, res, next) => {
    try {
        const result = await adminService.revokePermission(req.params.userId, req.params.permissionName, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// GET /api/v1/admin/permissions/requests/count
adminRouter.get('/permissions/requests/count', sysadminOnly, async (req: any, res, next) => {
    try {
        const result = await adminService.getPendingRequestsCount(req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

export default new Route('/api/v1/admin', adminRouter);
