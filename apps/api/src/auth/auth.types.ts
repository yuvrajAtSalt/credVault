import { z } from 'zod';

export const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
});

export type ILoginPayload = z.infer<typeof loginSchema>;

export interface IAuthResponses {
    [key: string]: {
        statusCode: number;
        message: string;
    };
}
