import { Router } from 'express';
import { MatchFunction } from 'path-to-regexp';

export class Route {
    static registeredRoutes: Route[] = [];

    constructor(public path: string, public router: Router) {
        if (!this.path.startsWith('/')) {
            throw new Error('INVALID PATH — must start with /');
        }
        if (Route.registeredRoutes.find((r) => r.path === this.path)) {
            throw new Error(`PATH ALREADY REGISTERED: ${this.path}`);
        }
        Route.registeredRoutes.push(this);
    }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type ExcludedRoute = {
    path: MatchFunction<any>;
    method: Method;
};

export type ExcludedRoutes = ExcludedRoute[];
