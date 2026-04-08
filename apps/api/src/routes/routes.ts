import { Application, NextFunction, json, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { excludedRoutes, routes } from './routes.data';
import { ResponseHandler } from '../utils/responseHandler';
import { validateToken } from '../utils/validate-token';

export const registerMiddlewares = (app: Application) => {
    // ─── Health check ────────────────────────────────────────────────
    app.get('/health', (_req: Request, res: Response) => {
        res.status(200).send({ status: 'HEALTHY' });
    });

    app.get('/', (_req: Request, res: Response) => {
        res.status(200).send({ status: 'HEALTHY', app: 'VaultStack API' });
    });

    // ─── Core middleware ─────────────────────────────────────────────
    app.use(json());
    app.use(
        cors({
            origin: (origin, callback) => {
                if (!origin) return callback(null, true);
                callback(null, origin);
            },
            credentials: true,
        }),
    );
    app.use(helmet());

    // ─── Auth guard ──────────────────────────────────────────────────
    app.use(validateToken(excludedRoutes));

    // ─── Module routes ───────────────────────────────────────────────
    for (const route of routes) {
        app.use(route.path, route.router);
    }

    // ─── Global error handler ────────────────────────────────────────
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
        console.error('[VaultStack] Global Error:', err);

        let errorResponse: Record<string, unknown>;
        if (err instanceof Error) {
            const errWithCode = err as Error & { code?: string; statusCode?: number };
            errorResponse = {
                message: err.message,
                stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
                ...(errWithCode.code && { code: errWithCode.code }),
            };
        } else {
            errorResponse = err;
        }

        res.status(err.statusCode || 500).send(new ResponseHandler(null, errorResponse));
    });
};
