import { NextFunction, Request, Response } from 'express';
import { ZodObject, ZodRawShape } from 'zod';

export const validator =
    <T extends ZodRawShape>(
        source: 'body' | 'params' | 'query',
        schema: ZodObject<T>,
        passthrough: boolean = false,
    ) =>
    (req: Request, res: Response, next: NextFunction) => {
        try {
            if (passthrough) {
                req[source] = schema.passthrough().parse(req[source]);
            } else {
                req[source] = schema.parse(req[source]);
            }
            next();
        } catch (e) {
            next({
                statusCode: 400,
                message: 'BAD REQUEST — VALIDATION ERROR',
                error: e,
            });
        }
    };

export const body = <T extends ZodRawShape>(
    schema: ZodObject<T>,
    passthrough: boolean = false,
) => validator('body', schema, passthrough);

export const params = <T extends ZodRawShape>(
    schema: ZodObject<T>,
    passthrough: boolean = false,
) => validator('params', schema, passthrough);

export const query = <T extends ZodRawShape>(
    schema: ZodObject<T>,
    passthrough: boolean = false,
) => validator('query', schema, passthrough);
