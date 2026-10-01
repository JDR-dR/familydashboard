import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt, lt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { hashPassword, verifyPassword } from "./password";
import { db } from "@/lib/db";
import { households, sessions, tokens, users, type User } from "@/lib/db/schema";

const COOKIE = "fd_session";
const SESSION_DAYS = 30;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

/* ------------------------------------------------------------------ sessions -- */

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string, userAgent?: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt, userAgent });

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export interface Session {
  user: User;
  householdId: string;
}

/** Null when signed out. Refreshes the expiry so daily use never logs you out. */
export async function currentSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!row || row.user.archivedAt) return null;
  return { user: row.user, householdId: row.user.householdId };
}

/** For server actions and pages that must have a user. */
export async function requireSession(): Promise<Session> {
  const session = await currentSession();
  if (!session) throw new Error("Not signed in");
  return session;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  store.delete(COOKIE);
}

/** Sign out everywhere, used after a password change or on demand. */
export async function destroyAllSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function pruneExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

/* --------------------------------------------------------------------- login -- */

export type LoginResult =
  | { ok: true; userId: string }
  | { ok: false; reason: string };

/**
 * Wrong passwords count up to a lockout. The same message comes back whether the
 * email is unknown or the password is wrong, so the form cannot be used to find
 * out who has an account.
 */
export async function attemptLogin(email: string, password: string): Promise<LoginResult> {
  const generic = { ok: false as const, reason: "That email and password do not match." };
  const normalised = email.trim().toLowerCase();

  const [user] = await db.select().from(users).where(eq(users.email, normalised)).limit(1);

  if (!user || !user.passwordHash || user.archivedAt) {
    // Spend roughly the same time as a real comparison.
    await bcrypt.compare(password, "$2a$12$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUV0123456");
    return generic;
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    return {
      ok: false,
      reason: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  const valid = await verifyPassword(password, user.passwordHash);

  if (!valid) {
    const attempts = user.failedAttempts + 1;
    await db
      .update(users)
      .set({
        failedAttempts: attempts,
        lockedUntil:
          attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null,
      })
      .where(eq(users.id, user.id));
    return generic;
  }

  await db
    .update(users)
    .set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  return { ok: true, userId: user.id };
}

/* ------------------------------------------------- invites and resets ------- */

export async function issueToken(
  userId: string,
  kind: "invite" | "reset",
  hours = 72,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.insert(tokens).values({
    id: hashToken(token),
    userId,
    kind,
    expiresAt: new Date(Date.now() + hours * 3_600_000),
  });
  return token;
}

export async function consumeToken(
  token: string,
  kind: "invite" | "reset",
): Promise<string | null> {
  const id = hashToken(token);
  const [row] = await db
    .select()
    .from(tokens)
    .where(and(eq(tokens.id, id), eq(tokens.kind, kind), gt(tokens.expiresAt, new Date())))
    .limit(1);
  if (!row || row.usedAt) return null;
  await db.update(tokens).set({ usedAt: new Date() }).where(eq(tokens.id, id));
  return row.userId;
}

export async function setPassword(userId: string, password: string): Promise<void> {
  const hash = await hashPassword(password);
  await db
    .update(users)
    .set({ passwordHash: hash, failedAttempts: 0, lockedUntil: null })
    .where(eq(users.id, userId));
  await destroyAllSessions(userId);
}

/* ---------------------------------------------------------------- household -- */

export async function ensureHousehold(name: string): Promise<string> {
  const [existing] = await db.select().from(households).limit(1);
  if (existing) return existing.id;
  const [created] = await db.insert(households).values({ name }).returning();
  return created.id;
}

export function constantTimeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
