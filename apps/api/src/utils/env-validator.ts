import path from 'path';
import { config } from 'dotenv';
import { z } from 'zod';

const API_PACKAGE_ENV_PATH = path.resolve(__dirname, '..', '..', '.env');

const optional = (schema: z.ZodString) =>
    z.preprocess(
        (val) =>
            val === undefined || val === '' || (typeof val === 'string' && !val.trim())
                ? undefined
                : String(val).trim(),
        schema.optional(),
    );

export const envValidator = z.object({
    PORT: z.coerce.number(),
    MONGO_URI: z.string(),
    VAULT_JWT_SECRET: z.string(),
    VAULT_JWT_REFRESH_SECRET: optional(z.string()),
    ACCESS_TOKEN_EXPIRATION: z.string(),
    REFRESH_TOKEN_EXPIRATION: z.string(),
    NODE_ENV: optional(z.string()),
    CLIENT_URL: optional(z.string()),
});

interface Env extends z.infer<typeof envValidator> {}

export const validateEnv = () => {
    try {
        config({ path: API_PACKAGE_ENV_PATH });
        config();
        envValidator.parse(process.env);
    } catch (e) {
        throw {
            message: 'ENV NOT CONFIGURED CORRECTLY',
            error: e,
        };
    }
};

declare global {
    namespace NodeJS {
        interface ProcessEnv extends Env {}
    }
    namespace Express {
        interface Request {
            currentUser?: any;
        }
    }
}
