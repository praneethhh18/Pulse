import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

// Verifies Firebase ID tokens. Active only when FIREBASE_SERVICE_ACCOUNT is set
// — otherwise the app runs single-user demo mode (no auth required).
@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger('AuthService');
  configured = false;
  private app?: admin.app.App;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const raw = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT');
    if (!raw) {
      this.logger.warn(
        'Firebase Auth not configured — running single-user demo mode.',
      );
      return;
    }
    try {
      const serviceAccount = JSON.parse(raw);
      this.app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      this.configured = true;
      this.logger.log('Firebase Auth enabled — multi-user mode.');
    } catch (e) {
      this.logger.error(`Failed to init Firebase Auth: ${e}`);
    }
  }

  async verify(idToken: string): Promise<{ uid: string; email?: string }> {
    if (!this.app) throw new Error('Auth not configured');
    const decoded = await this.app.auth().verifyIdToken(idToken);
    return { uid: decoded.uid, email: decoded.email };
  }
}
