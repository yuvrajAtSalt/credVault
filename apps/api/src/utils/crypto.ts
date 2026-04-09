/**
 * AES-256-GCM encryption utility for credential values.
 *
 * ENCRYPTION_KEY must be a 64-char hex string (32 bytes).
 * Generate with:  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Encrypted format:  <iv_hex>:<authTag_hex>:<ciphertext_hex>
 * All parts are hex-encoded for safe MongoDB string storage.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
    const hex = process.env.ENCRYPTION_KEY;
    if (!hex || hex.length !== 64) {
        throw new Error('[crypto] ENCRYPTION_KEY must be a 64-char hex string (32 bytes). Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    }
    return Buffer.from(hex, 'hex');
}

const ENCRYPTED_MARKER = /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i;

export function isEncrypted(value: string): boolean {
    return ENCRYPTED_MARKER.test(value);
}

export function encrypt(plaintext: string): string {
    const key = getKey();
    const iv  = randomBytes(12); // 96-bit IV for GCM
    const cipher = createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag   = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) throw new Error('[crypto] Invalid encrypted payload format');

    const [ivHex, authTagHex, encryptedHex] = parts;
    const key     = getKey();
    const iv      = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const data    = Buffer.from(encryptedHex, 'hex');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
