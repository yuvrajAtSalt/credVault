import { body } from '../utils/validator';
import { createUserSchema, updateUserSchema } from './user.types';

export const createValidations = [body(createUserSchema)];
export const updateValidations = [body(updateUserSchema)];
