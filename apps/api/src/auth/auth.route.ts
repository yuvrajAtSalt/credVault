import { Router } from 'express';
import { Route } from '../routes/routes.types';
import { ResponseHandler } from '../utils/responseHandler';
import { authResponses } from './auth.responses';
import authService from './auth.service';
import { loginValidations } from './auth.validations';
import { validateToken } from '../utils/validate-token';
import { body } from '../utils/validator';
import { z } from 'zod';
import { VAULT_ROLES } from '../utils/constants';

const authRouter = Router();

const COOKIE_OPTS = (maxAge: number) => ({
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge,
});

// ─── POST /api/v1/auth/register — first-user org setup ───────────────────────
const registerSchema = z.object({
    orgName:  z.string().min(1, 'Organisation name required'),
    name:     z.string().min(1, 'Name required'),
    email:    z.string().email(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    slug:     z.string().optional(),
});

authRouter.post('/register', body(registerSchema), async (req, res, next) => {
    try {
        const result = await authService.register(req.body);
        const { token, refreshToken } = result.data as any;
        res.cookie('vault_token', token, COOKIE_OPTS(30 * 60 * 1000));
        res.cookie('vault_refresh_token', refreshToken, COOKIE_OPTS(7 * 24 * 60 * 60 * 1000));
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// ─── POST /api/v1/auth/login ──────────────────────────────────────────────────
authRouter.post('/login', ...loginValidations, async (req, res, next) => {
    try {
        const ip = req.ip || req.socket?.remoteAddress;
        const result = await authService.login(req.body, ip);
        const { token, refreshToken } = result.data as any;
        res.cookie('vault_token', token, COOKIE_OPTS(30 * 60 * 1000));
        res.cookie('vault_refresh_token', refreshToken, COOKIE_OPTS(7 * 24 * 60 * 60 * 1000));
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// ─── GET /api/v1/auth/me ──────────────────────────────────────────────────────
authRouter.get('/me', async (req: any, res, next) => {
    try {
        const result = await authService.me(req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// ─── POST /api/v1/auth/logout ─────────────────────────────────────────────────
authRouter.post('/logout', validateToken([]), async (req: any, res, next) => {
    try {
        const token = req.headers['authorization']?.split(' ')[1];
        const result = await authService.logout(token || '', req.currentUser);
        res.clearCookie('vault_token');
        res.clearCookie('vault_refresh_token');
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// ─── POST /api/v1/auth/refresh-token ─────────────────────────────────────────
authRouter.post('/refresh-token', async (req, res, next) => {
    try {
        let rt = req.body?.refreshToken;
        if (!rt && req.headers.cookie) {
            const m = req.headers.cookie.match(/(?:^|;\s*)vault_refresh_token=([^;]*)/);
            if (m?.[1]) rt = m[1].trim();
        }
        if (!rt) throw authResponses.REFRESH_TOKEN_REQUIRED;
        const result = await authService.refreshToken(rt);
        const { token, refreshToken } = result.data as any;
        res.cookie('vault_token', token, COOKIE_OPTS(30 * 60 * 1000));
        res.cookie('vault_refresh_token', refreshToken, COOKIE_OPTS(7 * 24 * 60 * 60 * 1000));
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

// ─── POST /api/v1/auth/invite — manager/sysadmin only ────────────────────────
const inviteSchema = z.object({
    name:        z.string().min(1),
    email:       z.string().email(),
    role:        z.enum([...VAULT_ROLES] as [string, ...string[]]),
    reportingTo: z.string().optional(),
});

authRouter.post('/invite', body(inviteSchema), async (req: any, res, next) => {
    try {
        const role: string = req.currentUser?.role;
        if (!['SYSADMIN', 'MANAGER'].includes(role)) {
            return next({ statusCode: 403, message: 'FORBIDDEN — MANAGER OR SYSADMIN REQUIRED' });
        }
        const result = await authService.invite(req.body, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) { next(e); }
});

export default new Route('/api/v1/auth', authRouter);
