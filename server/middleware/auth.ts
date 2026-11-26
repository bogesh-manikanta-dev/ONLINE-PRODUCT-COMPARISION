import type { NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import { roles, userPreferences, users, wishlists } from '../../src/db/schema.ts';
import { adminAuth } from '../../src/lib/firebase-admin.ts';
import { verifySessionToken } from '../../src/lib/security.ts';

export const OWNER_ADMIN_EMAIL = 'bogeshmanikanta@gmail.com';

export interface AuthenticatedUser {
  id: number;
  uid: string;
  email: string;
  name: string;
  role: 'CONSUMER' | 'ADMIN';
  avatarUrl: string | null;
  isActive: boolean;
}

export interface AuthRequest extends Request {
  authUser?: AuthenticatedUser;
}

export async function ensureUserWorkspace(userId: number): Promise<void> {
  try {
    await db.insert(wishlists).values({ userId, name: 'My Wishlist' }).onConflictDoNothing();
    await db.insert(userPreferences).values({ userId }).onConflictDoNothing();
  } catch (err) {
    console.error('Failed ensuring user workspace:', err);
  }
}

export async function upsertFirebaseUser(
  uid: string,
  email: string,
  name: string,
  avatarUrl?: string
): Promise<AuthenticatedUser> {
  try {
    const normalizedEmail = email.toLowerCase();
    const isOwnerAdmin = normalizedEmail === OWNER_ADMIN_EMAIL;

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existing.length > 0) {
      const current = existing[0];
      const nextRole = isOwnerAdmin ? 'ADMIN' : (current.role as 'CONSUMER' | 'ADMIN');
      const [updated] = await db
        .update(users)
        .set({
          uid,
          name: name || current.name,
          avatarUrl: avatarUrl || current.avatarUrl,
          role: nextRole,
          updatedAt: new Date(),
        })
        .where(eq(users.id, current.id))
        .returning();
      await ensureUserWorkspace(updated.id);
      return {
        id: updated.id,
        uid: updated.uid,
        email: updated.email,
        name: updated.name,
        role: updated.role as 'CONSUMER' | 'ADMIN',
        avatarUrl: updated.avatarUrl,
        isActive: updated.isActive,
      };
    }

    const [roleRow] = await db
      .select()
      .from(roles)
      .where(eq(roles.name, isOwnerAdmin ? 'ADMIN' : 'CONSUMER'))
      .limit(1);

    const [inserted] = await db
      .insert(users)
      .values({
        uid,
        email: normalizedEmail,
        name: name || normalizedEmail.split('@')[0],
        roleId: roleRow?.id ?? null,
        role: isOwnerAdmin ? 'ADMIN' : 'CONSUMER',
        avatarUrl: avatarUrl ?? null,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: { email: normalizedEmail, updatedAt: new Date() },
      })
      .returning();

    await ensureUserWorkspace(inserted.id);
    return {
      id: inserted.id,
      uid: inserted.uid,
      email: inserted.email,
      name: inserted.name,
      role: inserted.role as 'CONSUMER' | 'ADMIN',
      avatarUrl: inserted.avatarUrl,
      isActive: inserted.isActive,
    };
  } catch (error) {
    console.error('Database user upsert failed:', error);
    throw new Error('Authentication synchronization failed.', { cause: error });
  }
}

export async function resolveAuthFromRequest(req: Request): Promise<AuthenticatedUser | null> {
  const authHeader = req.headers.authorization;
  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }
  if (!token) return null;

  // 1. Verify HMAC-signed session token
  const sessionPayload = verifySessionToken(token);
  if (sessionPayload) {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, sessionPayload.userId))
        .limit(1);
      if (!user || !user.isActive) return null;
      return {
        id: user.id,
        uid: user.uid,
        email: user.email,
        name: user.name,
        role: user.role as 'CONSUMER' | 'ADMIN',
        avatarUrl: user.avatarUrl,
        isActive: user.isActive,
      };
    } catch (error) {
      console.error('Session lookup failed:', error);
      return null;
    }
  }

  // 2. Verify Firebase ID token
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (!decoded.email) return null;
    return await upsertFirebaseUser(
      decoded.uid,
      decoded.email,
      decoded.name || decoded.email.split('@')[0],
      decoded.picture
    );
  } catch {
    return null;
  }
}

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  req.authUser = (await resolveAuthFromRequest(req)) ?? undefined;
  next();
};

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const user = await resolveAuthFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required. Please sign in to continue.' });
  }
  if (!user.isActive) {
    return res.status(403).json({ error: 'Account has been deactivated.' });
  }
  req.authUser = user;
  next();
};

export const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const user = await resolveAuthFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  if (user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Administrator privileges are required for this action.' });
  }
  req.authUser = user;
  next();
};
