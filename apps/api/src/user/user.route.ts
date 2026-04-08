import { Router } from 'express';
import { Route } from '../routes/routes.types';
import { ResponseHandler } from '../utils/responseHandler';
import { createValidations, updateValidations } from './user.validations';
import userService from './user.service';

const userRouter = Router();

// GET /api/v1/users?search= — search users in org
userRouter.get('/', async (req: any, res, next) => {
    try {
        const search = req.query.search as string | undefined;
        const result = await userService.getAllUsers(String(req.currentUser.organisationId), search);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) {
        next(e);
    }
});

// POST /api/v1/user/create-user — create a user (SYSADMIN)
userRouter.post('/create-user', ...createValidations, async (req: any, res, next) => {
    try {
        const creatorId = req.currentUser?._id;
        const result = await userService.createUser(req.body, creatorId);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) {
        next(e);
    }
});

// GET /api/v1/user/:id — get user by ID
userRouter.get('/:id', async (req, res, next) => {
    try {
        const result = await userService.getUserById(req.params.id);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) {
        next(e);
    }
});

// PATCH /api/v1/user/:id — update user
userRouter.patch('/:id', ...updateValidations, async (req: any, res, next) => {
    try {
        const result = await userService.updateUser(req.params.id, req.body);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) {
        next(e);
    }
});

// DELETE /api/v1/user/:id — soft delete
userRouter.delete('/:id', async (req: any, res, next) => {
    try {
        const requesterId = req.currentUser?._id;
        const result = await userService.deleteUser(req.params.id, requesterId);
        res.status(result.statusCode).send(new ResponseHandler(result));
    } catch (e) {
        next(e);
    }
});

export default new Route('/api/v1/users', userRouter);
