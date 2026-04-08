import { TokenExpiredError, verify } from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { match } from 'path-to-regexp';
import { BlacklistedTokenModel } from '../auth/blacklisted-token.schema';
import type { ExcludedRoutes } from '../routes/routes.types';

export const validateToken =
    (excludedRoutes: ExcludedRoutes) =>
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const isExcludedRoute = excludedRoutes.some(
                (r) => r.path(req.path) && r.method === req.method,
            );

            let token = req.headers['authorization']?.split(' ')[1];

            // Fallback: read token from cookie
            if (!token && req.headers.cookie) {
                const cookieMatch = req.headers.cookie.match(/(?:^|;\s*)vault_token=([^;]*)/);
                if (cookieMatch && cookieMatch[1]) {
                    token = cookieMatch[1].trim();
                }
            }

            const JWT_SECRET = process.env.VAULT_JWT_SECRET;
            if (!JWT_SECRET) throw new Error('VAULT_JWT_SECRET is not defined');

            if (isExcludedRoute) {
                if (token) {
                    try {
                        const payload = verify(token, JWT_SECRET);
                        req.currentUser = payload;
                    } catch {
                        // Optional auth — no token required for excluded routes
                    }
                }
                return next();
            }

            if (!token) throw 'TOKEN EXPIRED';

            const payload = verify(token, JWT_SECRET);

            // Check if token is blacklisted
            const isBlacklisted = await BlacklistedTokenModel.exists({ token });
            if (isBlacklisted) throw 'TOKEN REVOKED';

            req.currentUser = payload;
            next();
        } catch (e: any) {
            if (e instanceof TokenExpiredError || e?.name === 'TokenExpiredError') {
                next({ statusCode: 401, message: 'TOKEN EXPIRED' });
            } else if (e === 'TOKEN REVOKED') {
                next({ statusCode: 401, message: 'TOKEN REVOKED' });
            } else {
                next({ statusCode: 401, message: 'UNAUTHORIZED ACCESS' });
            }
        }
    };
