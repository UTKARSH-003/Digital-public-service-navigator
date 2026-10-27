import type { NextFunction, Request, Response } from 'express';
import type { AuthUser, RoleName } from '../types/index.js';
import type { AuthVerifier } from '../repositories/types.js';
import { forbidden, unauthorized } from '../utils/errors.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

function bearer(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1] ?? null;
}

/** Attaches req.user when a valid token is present; never rejects. */
export function optionalAuth(verifier: AuthVerifier) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const token = bearer(req);
      if (token) {
        const user = await verifier.verify(token);
        if (user) req.user = user;
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}

/** Rejects with 401 unless a valid token is present. */
export function requireAuth(verifier: AuthVerifier) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const token = bearer(req);
      if (!token) throw unauthorized();
      const user = await verifier.verify(token);
      if (!user) throw unauthorized('Invalid or expired session');
      req.user = user;
      next();
    } catch (e) {
      next(e);
    }
  };
}

/** Backend authorization: the only source of truth for admin access. */
export function requireRole(...roles: RoleName[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
}

export const STAFF: RoleName[] = ['super_admin', 'content_admin', 'reviewer'];
export const EDITORS: RoleName[] = ['super_admin', 'content_admin'];
