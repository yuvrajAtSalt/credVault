import { match } from 'path-to-regexp';
import { ExcludedRoutes, Route } from './routes.types';

import authRoutes from '../auth/auth.route';
import userRoutes from '../user/user.route';
import memberRoutes from '../user/member.route';
import projectRoutes from '../project/project.route';
import credentialRoutes from '../credential/credential.route';

export const routes: Route[] = [authRoutes, userRoutes, memberRoutes, projectRoutes, credentialRoutes];

export const excludedRoutes: ExcludedRoutes = [
    {
        path: match('/api/v1/auth/login'),
        method: 'POST',
    },
    {
        path: match('/api/v1/auth/register'),
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
