import { match } from 'path-to-regexp';
import { ExcludedRoutes, Route } from './routes.types';

import authRoutes from '../auth/auth.route';
import userRoutes from '../user/user.route';

export const routes: Route[] = [authRoutes, userRoutes];

export const excludedRoutes: ExcludedRoutes = [
    {
        path: match('/api/v1/auth/login'),
        method: 'POST',
    },
    {
        path: match('/api/v1/auth/refresh-token'),
        method: 'POST',
    },
    {
        path: match('/health'),
        method: 'GET',
    },
    {
        path: match('/'),
        method: 'GET',
    },
];
