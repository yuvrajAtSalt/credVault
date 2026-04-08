import { IAuthResponses } from './auth.types';

export const authResponses: IAuthResponses = {
    INVALID_CREDENTIALS: {
        statusCode: 401,
        message: 'INVALID CREDENTIALS',
    },
    INCORRECT_PASSWORD: {
        statusCode: 401,
        message: 'INCORRECT PASSWORD',
    },
    ACCOUNT_INACTIVE: {
        statusCode: 403,
        message: 'ACCOUNT IS INACTIVE',
    },
    EMAIL_ALREADY_EXISTS: {
        statusCode: 400,
        message: 'EMAIL ALREADY EXISTS',
    },
    USER_NOT_FOUND: {
        statusCode: 404,
        message: 'USER NOT FOUND',
    },
    USER_REGISTRATION_FAILED: {
        statusCode: 500,
        message: 'USER REGISTRATION FAILED',
    },
    DEFAULT_ROLE_NOT_FOUND: {
        statusCode: 500,
        message: 'DEFAULT ROLE NOT FOUND',
    },
    REFRESH_TOKEN_REQUIRED: {
        statusCode: 400,
        message: 'REFRESH TOKEN IS REQUIRED',
    },
    INVALID_OR_EXPIRED_REFRESH_TOKEN: {
        statusCode: 401,
        message: 'INVALID OR EXPIRED REFRESH TOKEN',
    },
    INVALID_TOKEN_TYPE: {
        statusCode: 401,
        message: 'INVALID TOKEN TYPE',
    },
    LOGIN_SUCCESSFUL: {
        statusCode: 200,
        message: 'LOGIN SUCCESSFUL',
    },
    LOGOUT_SUCCESSFUL: {
        statusCode: 200,
        message: 'LOGOUT SUCCESSFUL',
    },
};
