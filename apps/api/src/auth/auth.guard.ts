import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';

// When Firebase Auth is configured, every non-public request must carry a valid
// `Authorization: Bearer <idToken>`. We verify it and set the resolved uid as
// `x-user-id` so every existing controller is automatically user-scoped — no
// controller changes needed. When auth is NOT configured, this is a no-op and
// the app behaves exactly as the single-user demo.
const PUBLIC_PATHS = new Set(['/', '/health', '/gmail/callback']);

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger('AuthGuard');

  constructor(private readonly auth: AuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (!this.auth.configured) return true; // demo mode

    const req = ctx.switchToHttp().getRequest<Request>();
    const path = (req.path || req.url || '').split('?')[0];
    if (PUBLIC_PATHS.has(path)) return true;

    const header = req.headers['authorization'];
    const token =
      typeof header === 'string' && header.startsWith('Bearer ')
        ? header.slice(7)
        : null;
    if (!token) throw new UnauthorizedException('Missing auth token');

    try {
      const { uid } = await this.auth.verify(token);
      req.headers['x-user-id'] = uid; // downstream resolveUserId() uses this
      return true;
    } catch (e) {
      this.logger.warn(`Token verification failed: ${e}`);
      throw new UnauthorizedException('Invalid auth token');
    }
  }
}
