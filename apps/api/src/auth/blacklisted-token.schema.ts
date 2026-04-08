import { model, Schema } from 'mongoose';

const blacklistedTokenSchema = new Schema(
    {
        token: { type: String, required: true, unique: true },
    },
    { timestamps: true },
);

blacklistedTokenSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 }); // auto-expire after 24h

export const BlacklistedTokenModel = model('BlacklistedToken', blacklistedTokenSchema);
