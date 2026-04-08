import { Schema, SchemaDefinitionProperty } from 'mongoose';

export class BaseSchema extends Schema {
    constructor(schema: { [key: string]: SchemaDefinitionProperty }) {
        super(
            {
                ...schema,
                isDeleted: {
                    type: Boolean,
                    required: false,
                    default: false,
                },
                updatedBy: {
                    required: true,
                    type: Schema.Types.ObjectId,
                    ref: 'User',
                },
                createdBy: {
                    required: true,
                    type: Schema.Types.ObjectId,
                    ref: 'User',
                },
            },
            { timestamps: true },
        );
    }
}
