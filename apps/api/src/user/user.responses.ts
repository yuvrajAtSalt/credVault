import { IUserResponses } from './user.types';

export const userResponses: IUserResponses = {
    USER_CREATED_SUCCESSFULLY: {
        statusCode: 201,
        message: 'USER CREATED SUCCESSFULLY',
    },
    USER_FETCHED_SUCCESSFULLY: {
        statusCode: 200,
        message: 'USER FETCHED SUCCESSFULLY',
    },
    USERS_FETCHED_SUCCESSFULLY: {
        statusCode: 200,
        message: 'USERS FETCHED SUCCESSFULLY',
    },
    USER_UPDATED_SUCCESSFULLY: {
        statusCode: 200,
        message: 'USER UPDATED SUCCESSFULLY',
    },
    USER_NOT_FOUND: {
        statusCode: 404,
        message: 'USER NOT FOUND',
    },
    USER_ALREADY_EXISTS: {
        statusCode: 400,
        message: 'USER ALREADY EXISTS',
    },
    USER_CREATION_FAILED: {
        statusCode: 500,
        message: 'USER CREATION FAILED',
    },
    USER_DELETED_SUCCESSFULLY: {
        statusCode: 200,
        message: 'USER DELETED SUCCESSFULLY',
    },
};
