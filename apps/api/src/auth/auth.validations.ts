import { body } from '../utils/validator';
import { loginSchema } from './auth.types';

export const loginValidations = [body(loginSchema)];
