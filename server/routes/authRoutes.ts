import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { eq } from 'drizzle-orm';
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from '../../shared/validators.ts';
import { db } from '../../src/db/index.ts';
import { roles, systemSettings, userPreferences, users } from '../../src/db/schema.ts';
import { ensureSeeded } from '../../src/db/seed.ts';
import {
  hashPassword,
  signSessionToken,
  verifyPassword,
} from '../../src/lib/security.ts';
import {
  type AuthRequest,
  ensureUserWorkspace,
  requireAuth,
  resolveAuthFromRequest,
} from '../middleware/auth.ts';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' },
});

router.post('/register', authLimiter, async (req, res) => {
  try {
    await ensureSeeded();
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues.map((i) => i.message).join('; '),
      });
    }

    const { name, email, password } = parsed.data;
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const [consumerRole] = await db
      .select()
      .from(roles)
      .where(eq(roles.name, 'CONSUMER'))
      .limit(1);

    const passwordHash = hashPassword(password);
    const uid = `local:${crypto.randomUUID()}`;

    const [created] = await db
      .insert(users)
      .values({
        uid,
        email,
        name,
        passwordHash,
        roleId: consumerRole?.id ?? null,
        role: 'CONSUMER',
        isActive: true,
      })
      .returning();

    await ensureUserWorkspace(created.id);

    const token = signSessionToken({
      userId: created.id,
      uid: created.uid,
      email: created.email,
      role: 'CONSUMER',
    });

    return res.status(201).json({
      token,
      user: {
        id: created.id,
        uid: created.uid,
        email: created.email,
        name: created.name,
        role: created.role,
        avatarUrl: created.avatarUrl,
        createdAt: created.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Unable to complete registration right now.' });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  try {
    await ensureSeeded();
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues.map((i) => i.message).join('; '),
      });
    }

    const { email, password } = parsed.data;
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    if (!user.isActive) {
      return res.status(403).json({ error: 'This account has been deactivated.' });
    }

    const valid = verifyPassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    await ensureUserWorkspace(user.id);

    const token = signSessionToken({
      userId: user.id,
      uid: user.uid,
      email: user.email,
      role: user.role as 'CONSUMER' | 'ADMIN',
    });

    return res.json({
      token,
      user: {
        id: user.id,
        uid: user.uid,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Unable to sign in right now.' });
  }
});

router.post('/firebase-sync', async (req, res) => {
  try {
    await ensureSeeded();
    const user = await resolveAuthFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired Firebase ID token.' });
    }
    return res.json({ user });
  } catch (error) {
    console.error('Firebase sync error:', error);
    return res.status(500).json({ error: 'Failed to synchronize account.' });
  }
});

router.get('/admin-bootstrap-status', async (_req, res) => {
  try {
    await ensureSeeded();
    const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
    const [stored] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'admin_passcode_hash'))
      .limit(1);

    return res.json({
      isConfigured: Boolean(envPasscode || stored),
      usesEnvPasscode: Boolean(envPasscode),
    });
  } catch (error) {
    console.error('Admin bootstrap status check failed:', error);
    return res.status(500).json({ error: 'Unable to verify admin setup status.' });
  }
});

router.post('/admin-bootstrap', authLimiter, async (req: AuthRequest, res) => {
  try {
    await ensureSeeded();
    const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode.trim() : '';
    const adminEmail =
      typeof req.body?.email === 'string' && req.body.email.includes('@')
        ? req.body.email.trim().toLowerCase()
        : 'admin@comparex.local';
    const adminName =
      typeof req.body?.name === 'string' && req.body.name.trim().length >= 2
        ? req.body.name.trim()
        : 'CompareX Administrator';

    if (passcode.length < 8) {
      return res.status(400).json({ error: 'Admin passcode must be at least 8 characters.' });
    }

    const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
    const [stored] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'admin_passcode_hash'))
      .limit(1);

    if (envPasscode) {
      const a = Buffer.from(passcode);
      const b = Buffer.from(envPasscode);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return res.status(401).json({ error: 'Invalid administrator passcode.' });
      }
    } else if (stored) {
      if (!verifyPassword(passcode, stored.value)) {
        return res.status(401).json({ error: 'Invalid administrator passcode.' });
      }
    } else {
      // First-run atomic bootstrap: claim admin passcode hash
      const hash = hashPassword(passcode);
      await db
        .insert(systemSettings)
        .values({ key: 'admin_passcode_hash', value: hash })
        .onConflictDoNothing();
    }

    // If caller is already signed in, promote them; otherwise sign in / create admin user
    const currentUser = await resolveAuthFromRequest(req);
    const targetEmail = currentUser ? currentUser.email : adminEmail;
    const [adminRole] = await db.select().from(roles).where(eq(roles.name, 'ADMIN')).limit(1);

    const existing = await db.select().from(users).where(eq(users.email, targetEmail)).limit(1);
    let adminUser;

    if (existing.length > 0) {
      const [updated] = await db
        .update(users)
        .set({ role: 'ADMIN', roleId: adminRole?.id ?? null, updatedAt: new Date() })
        .where(eq(users.id, existing[0].id))
        .returning();
      adminUser = updated;
    } else {
      const [created] = await db
        .insert(users)
        .values({
          uid: `local:${crypto.randomUUID()}`,
          email: targetEmail,
          name: adminName,
          passwordHash: hashPassword(passcode),
          role: 'ADMIN',
          roleId: adminRole?.id ?? null,
          isActive: true,
        })
        .returning();
      adminUser = created;
    }

    await ensureUserWorkspace(adminUser.id);
    const token = signSessionToken({
      userId: adminUser.id,
      uid: adminUser.uid,
      email: adminUser.email,
      role: 'ADMIN',
    });

    return res.json({
      token,
      user: {
        id: adminUser.id,
        uid: adminUser.uid,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
        avatarUrl: adminUser.avatarUrl,
        createdAt: adminUser.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Admin bootstrap failed:', error);
    return res.status(500).json({ error: 'Unable to complete administrator verification.' });
  }
});

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.authUser!;
    const [prefs] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, user.id))
      .limit(1);

    return res.json({
      user,
      preferences: prefs
        ? {
            preferredCurrency: prefs.preferredCurrency,
            defaultBudgetMax: prefs.defaultBudgetMax,
            preferredCategories: JSON.parse(prefs.preferredCategoriesJson || '[]'),
            priorityWeights: JSON.parse(prefs.priorityWeightsJson || '{}'),
            emailNotifications: prefs.emailNotifications,
          }
        : null,
    });
  } catch (error) {
    console.error('Fetch profile failed:', error);
    return res.status(500).json({ error: 'Unable to load profile.' });
  }
});

router.put('/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    }

    const user = req.authUser!;
    const { name, preferredCurrency, defaultBudgetMax, preferredCategories, priorityWeights, emailNotifications } =
      parsed.data;

    const [updatedUser] = await db
      .update(users)
      .set({ name, updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .returning();

    await db
      .insert(userPreferences)
      .values({
        userId: user.id,
        preferredCurrency: preferredCurrency || 'USD',
        defaultBudgetMax: defaultBudgetMax ?? null,
        preferredCategoriesJson: JSON.stringify(preferredCategories || []),
        priorityWeightsJson: JSON.stringify(
          priorityWeights || { performance: 0.35, value: 0.35, efficiency: 0.15, reliability: 0.15 }
        ),
        emailNotifications: emailNotifications ?? true,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: {
          preferredCurrency: preferredCurrency || 'USD',
          defaultBudgetMax: defaultBudgetMax ?? null,
          preferredCategoriesJson: JSON.stringify(preferredCategories || []),
          priorityWeightsJson: JSON.stringify(
            priorityWeights || { performance: 0.35, value: 0.35, efficiency: 0.15, reliability: 0.15 }
          ),
          emailNotifications: emailNotifications ?? true,
          updatedAt: new Date(),
        },
      });

    return res.json({
      user: {
        id: updatedUser.id,
        uid: updatedUser.uid,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        avatarUrl: updatedUser.avatarUrl,
        createdAt: updatedUser.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Profile update failed:', error);
    return res.status(500).json({ error: 'Unable to update profile.' });
  }
});

router.post('/change-password', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    }

    const [dbUser] = await db.select().from(users).where(eq(users.id, req.authUser!.id)).limit(1);
    if (!dbUser || !dbUser.passwordHash) {
      return res.status(400).json({
        error: 'Password change is only available for email/password accounts (Google accounts manage passwords via Google).',
      });
    }

    if (!verifyPassword(parsed.data.currentPassword, dbUser.passwordHash)) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    await db
      .update(users)
      .set({ passwordHash: hashPassword(parsed.data.newPassword), updatedAt: new Date() })
      .where(eq(users.id, dbUser.id));

    return res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Change password failed:', error);
    return res.status(500).json({ error: 'Unable to update password.' });
  }
});

router.post('/logout', (_req, res) => {
  res.json({ message: 'Signed out successfully.' });
});

export default router;
