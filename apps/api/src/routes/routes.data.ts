import { match } from 'path-to-regexp';
import { ExcludedRoutes, Route } from './routes.types';

import authRoutes from '../auth/auth.route';
import userRoutes from '../user/user.route';
import memberRoutes from '../user/member.route';
import projectRoutes from '../project/project.route';
import credentialRoutes from '../credential/credential.route';
import auditRoutes from '../audit/audit.route';
import orgRoutes from '../organisation/organisation.route';
import envRoutes from '../env/env.route';
import orgHierarchyRoutes from '../org/org.route';
import adminRoutes from '../admin/admin.route';
import permissionRequestRoutes from '../admin/permission-request.route';

export const routes: Route[] = [
    authRoutes, userRoutes, memberRoutes, projectRoutes,
    credentialRoutes, auditRoutes, orgRoutes, envRoutes,
    orgHierarchyRoutes, adminRoutes, permissionRequestRoutes,
];



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
