import { Router } from 'express';
import { Route } from '../routes/routes.types';
import { ResponseHandler } from '../utils/responseHandler';
import { authResponses } from './auth.responses';
import authService from './auth.service';
import { loginValidations } from './auth.validations';
import { validateToken } from '../utils/validate-token';

const authRouter = Router();

// POST /api/v1/auth/login
authRouter.post('/login', ...loginValidations, async (req, res, next) => {
    try {
        const result = await authService.login(req.body);
        const data = result.data as { token?: string; refreshToken?: string };

        if (data?.token) {
            res.cookie('vault_token', data.token, {
                httpOnly: true,
                sameSite: 'lax',
                maxAge: 30 * 60 * 1000, // 30 min
                secure: process.env.NODE_ENV === 'production',
            });
        }
        if (data?.refreshToken) {
            res.cookie('vault_refresh_token', data.refreshToken, {
                httpOnly: true,
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
                secure: process.env.NODE_ENV === 'production',
            });
        }

        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) {
        next(e);
    }
});

// GET /api/v1/auth/me
authRouter.get('/me', async (req: any, res, next) => {
    try {
        const result = await authService.me(req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) {
        next(e);
    }
});

// POST /api/v1/auth/logout
authRouter.post('/logout', validateToken([]), async (req: any, res, next) => {
    try {
        const token = req.headers['authorization']?.split(' ')[1];
        if (!token) {
            res.clearCookie('vault_token');
            res.clearCookie('vault_refresh_token');
            return res.status(200).send(
                new ResponseHandler({ statusCode: 200, message: authResponses.LOGOUT_SUCCESSFUL.message, data: null }),
            );
        }
        const result = await authService.logout(token);
        res.clearCookie('vault_token');
        res.clearCookie('vault_refresh_token');
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) {
        next(e);
    }
});

// POST /api/v1/auth/refresh-token
authRouter.post('/refresh-token', async (req, res, next) => {
    try {
        let refreshToken = req.body?.refreshToken;
        if (!refreshToken && req.headers.cookie) {
            const cookieMatch = req.headers.cookie.match(/(?:^|;\s*)vault_refresh_token=([^;]*)/);
            if (cookieMatch?.[1]) refreshToken = cookieMatch[1].trim();
        }
        if (!refreshToken) throw authResponses.REFRESH_TOKEN_REQUIRED;

        const result = await authService.refreshToken(refreshToken);
        const data = result.data as { token?: string; refreshToken?: string };

        if (data?.token) {
            res.cookie('vault_token', data.token, {
                httpOnly: true,
                sameSite: 'lax',
                maxAge: 30 * 60 * 1000,
                secure: process.env.NODE_ENV === 'production',
            });
        }

        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) {
        next(e);
    }
});

export default new Route('/api/v1/auth', authRouter);
