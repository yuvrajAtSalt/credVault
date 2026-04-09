import { Router } from 'express';
import { Route } from '../routes/routes.types';
import { ResponseHandler } from '../utils/responseHandler';
import searchService from './search.service';

const searchRouter = Router();

searchRouter.get('/', async (req: any, res, next) => {
    try {
        const query = req.query.q as string || '';
        const result = await searchService.globalSearch(query, req.currentUser);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) {
        next(e);
    }
});

export default new Route('/api/v1/search', searchRouter);
