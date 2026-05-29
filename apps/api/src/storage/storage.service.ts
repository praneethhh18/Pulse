import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type { Bucket } from '@google-cloud/storage';

// Stores document media. When GCS_BUCKET is configured, files live in Google
// Cloud Storage (production); otherwise they're kept inline as base64 in Mongo
// (demo / small-scale). Callers don't care which — they get a key back and can
// read the bytes back by key.
@Injectable()
export class StorageService {
  private readonly logger = new Logger('StorageService');
  private bucket?: Bucket;
  readonly configured: boolean;

  constructor(private readonly config: ConfigService) {
    const bucketName = this.config.get<string>('GCS_BUCKET');
    this.configured = !!bucketName;
    if (this.configured) {
      try {
        // Lazy require so the heavy SDK only loads when actually used.

        const { Storage } = require('@google-cloud/storage');
        // Uses Application Default Credentials (Cloud Run SA or
        // GOOGLE_APPLICATION_CREDENTIALS).
        this.bucket = new Storage().bucket(bucketName as string);
        this.logger.log(`Cloud Storage enabled (bucket: ${bucketName})`);
      } catch (e) {
        this.logger.error(`Failed to init Cloud Storage: ${e}`);
        (this as { configured: boolean }).configured = false;
      }
    } else {
      this.logger.warn('GCS_BUCKET not set — document media stored inline (demo).');
    }
  }

  /** Upload base64 bytes; returns the object key. Only valid when configured. */
  async uploadBase64(
    userId: string,
    fileName: string,
    mimeType: string,
    base64: string,
  ): Promise<string> {
    if (!this.bucket) throw new Error('Cloud Storage not configured');
    const key = `documents/${userId}/${randomUUID()}-${sanitize(fileName)}`;
    await this.bucket.file(key).save(Buffer.from(base64, 'base64'), {
      contentType: mimeType,
      resumable: false,
    });
    return key;
  }

  async downloadBase64(key: string): Promise<string> {
    if (!this.bucket) throw new Error('Cloud Storage not configured');
    const [buf] = await this.bucket.file(key).download();
    return buf.toString('base64');
  }

  async delete(key: string): Promise<void> {
    if (!this.bucket) return;
    try {
      await this.bucket.file(key).delete({ ignoreNotFound: true });
    } catch (e) {
      this.logger.warn(`Failed to delete ${key}: ${e}`);
    }
  }
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
}
