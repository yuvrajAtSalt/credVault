/**
 * One-time migration script: encrypt all plain-text credential values in MongoDB.
 *
 * Run with:
 *   cd apps/api
 *   npx ts-node -e "require('./scripts/migrate-encrypt-credentials')"
 *
 * Safe to run multiple times — already-encrypted values are skipped.
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env') });

import mongoose from 'mongoose';
import { encrypt, isEncrypted } from '../src/utils/crypto';

async function run() {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI not set');

    console.log('[migrate] Connecting to MongoDB…');
    await mongoose.connect(uri);

    const Credential = mongoose.connection.collection('credentials');
    const all = await Credential.find({}).toArray();

    console.log(`[migrate] Found ${all.length} credential(s) to inspect.`);

    let migrated = 0;
    let skipped  = 0;
    let errors   = 0;

    for (const cred of all) {
        const value: string = cred.value ?? '';
        if (isEncrypted(value)) {
            skipped++;
            continue;
        }
        try {
            const encryptedValue = encrypt(value);
            await Credential.updateOne({ _id: cred._id }, { $set: { value: encryptedValue } });
            migrated++;
        } catch (err) {
            console.error(`[migrate] Failed to encrypt credential ${cred._id}:`, err);
            errors++;
        }
    }

    console.log(`[migrate] Done — migrated: ${migrated}, skipped (already encrypted): ${skipped}, errors: ${errors}`);
    await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
