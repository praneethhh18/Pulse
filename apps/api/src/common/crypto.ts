import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

// AES-256-GCM encryption for secrets at rest (OAuth tokens). The key is derived
// from TOKEN_ENCRYPTION_KEY. If no key is set (demo), values are stored as a
// reversible plaintext wrapper and a warning is logged — never do that live.

const ALGO = 'aes-256-gcm';

export class TokenCipher {
  private readonly key?: Buffer;

  constructor(secret?: string) {
    if (secret && secret.length > 0) {
      this.key = createHash('sha256').update(secret).digest();
    }
  }

  get enabled(): boolean {
    return !!this.key;
  }

  encrypt(value: unknown): string {
    const json = JSON.stringify(value);
    if (!this.key) return 'plain:' + Buffer.from(json, 'utf8').toString('base64');
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGO, this.key, iv);
    const data = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return 'enc:' + Buffer.concat([iv, tag, data]).toString('base64');
  }

  decrypt<T = unknown>(blob: string): T {
    if (blob.startsWith('enc:')) {
      if (!this.key) {
        throw new Error('Token is encrypted but TOKEN_ENCRYPTION_KEY is not set');
      }
      const raw = Buffer.from(blob.slice(4), 'base64');
      const iv = raw.subarray(0, 12);
      const tag = raw.subarray(12, 28);
      const data = raw.subarray(28);
      const decipher = createDecipheriv(ALGO, this.key, iv);
      decipher.setAuthTag(tag);
      const out = Buffer.concat([decipher.update(data), decipher.final()]);
      return JSON.parse(out.toString('utf8')) as T;
    }
    if (blob.startsWith('plain:')) {
      return JSON.parse(Buffer.from(blob.slice(6), 'base64').toString('utf8')) as T;
    }
    // legacy/raw JSON
    return JSON.parse(blob) as T;
  }
}
