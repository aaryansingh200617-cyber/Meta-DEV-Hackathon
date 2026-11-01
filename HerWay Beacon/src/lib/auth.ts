import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { OAuth2Client } from 'google-auth-library';
import { db } from './store';
import { env, useSupabase } from './env';
import { hashPassword, makeSignedToken, readSignedToken, uid, verifyPassword } from './crypto';
import { ApiError, unauthorized } from './http';
import { CONSENT_VERSION, DEFAULT_SETTINGS } from './defaults';
import type { User } from './types';
import { nowIso } from './utils';

export const SESSION_COOKIE = 'sj_session';
const AT_COOKIE = 'sj_at';
const RT_COOKIE = 'sj_rt';
const WEEK = 60 * 60 * 24 * 7;

const cookieOpts = (maxAge: number) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production' && process.env.SJ_INSECURE_COOKIES !== '1',
  path: '/',
  maxAge,
});

const sbAdmin = () => createClient(env.supabaseUrl, env.supabaseService, { auth: { persistSession: false, autoRefreshToken: false } });
const sbAnon = () => createClient(env.supabaseUrl, env.supabaseAnon, { auth: { persistSession: false, autoRefreshToken: false } });

const normEmail = (e: string) => e.trim().toLowerCase();

/* ── Registration ── */

export async function registerUser(input: { email: string; password: string; name: string; demo?: boolean }): Promise<User> {
  const email = normEmail(input.email);
  const store = db();
  const existing = (await store.find('users', { email }))[0];
  if (existing) throw new ApiError(409, 'email_taken', 'An account with this email already exists. Try signing in.');

  let id = uid('u_');
  if (useSupabase()) {
    const { data, error } = await sbAdmin().auth.admin.createUser({ email, password: input.password, email_confirm: true, user_metadata: { name: input.name } });
    if (error || !data.user) throw new ApiError(400, 'signup_failed', error?.message ?? 'Could not create account');
    id = data.user.id;
  }
  const t = nowIso();
  const user: User = {
    id, email, name: input.name.trim(), role: 'traveller', demo: Boolean(input.demo),
    passwordHash: useSupabase() ? undefined : hashPassword(input.password),
    createdAt: t, consentVersion: CONSENT_VERSION, consentAt: t, settings: { ...DEFAULT_SETTINGS },
  };
  await store.insert('users', user);
  await store.insert('consent_log', { id: uid('cl_'), userId: id, kind: 'terms_privacy', detail: `Accepted terms & privacy notice ${CONSENT_VERSION}`, at: t });
  return user;
}

/* ── Login / session ── */

export async function loginUser(emailRaw: string, password: string): Promise<{ user: User; tokens?: { at: string; rt: string } }> {
  const email = normEmail(emailRaw);
  const bad = new ApiError(401, 'invalid_credentials', 'Email or password is incorrect.');
  if (useSupabase()) {
    const { data, error } = await sbAnon().auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) throw bad;
    const user = await db().get('users', data.user.id);
    if (!user) throw bad;
    return { user, tokens: { at: data.session.access_token, rt: data.session.refresh_token } };
  }
  const user = (await db().find('users', { email }))[0];
  // Always run a hash comparison to keep timing similar for unknown emails
  const ok = verifyPassword(password, user?.passwordHash ?? hashPassword('x'));
  if (!user || !ok) throw bad;
  return { user };
}

export async function startSession(user: User, tokens?: { at: string; rt: string }) {
  const jar = await cookies();
  if (tokens) {
    jar.set(AT_COOKIE, tokens.at, cookieOpts(3600));
    jar.set(RT_COOKIE, tokens.rt, cookieOpts(WEEK));
  } else {
    jar.set(SESSION_COOKIE, makeSignedToken({ uid: user.id, exp: Date.now() + WEEK * 1000 }, 'session'), cookieOpts(WEEK));
  }
}

export async function endSession() {
  const jar = await cookies();
  for (const c of [SESSION_COOKIE, AT_COOKIE, RT_COOKIE]) jar.delete(c);
}

const sbCache = new Map<string, { uid: string; exp: number }>();

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  if (useSupabase()) {
    let at = jar.get(AT_COOKIE)?.value;
    const rt = jar.get(RT_COOKIE)?.value;
    let userId: string | null = null;
    if (at) {
      const hit = sbCache.get(at);
      if (hit && hit.exp > Date.now()) userId = hit.uid;
      else {
        const { data } = await sbAnon().auth.getUser(at);
        if (data.user) { userId = data.user.id; sbCache.set(at, { uid: userId, exp: Date.now() + 30_000 }); }
      }
    }
    if (!userId && rt) {
      const { data } = await sbAnon().auth.refreshSession({ refresh_token: rt });
      if (data.session && data.user) {
        userId = data.user.id;
        try {
          jar.set(AT_COOKIE, data.session.access_token, cookieOpts(3600));
          jar.set(RT_COOKIE, data.session.refresh_token, cookieOpts(WEEK));
        } catch { /* cookies are read-only in server components */ }
      }
    }
    return userId ? db().get('users', userId) : null;
  }
  const payload = readSignedToken<{ uid: string; exp: number }>(jar.get(SESSION_COOKIE)?.value, 'session');
  if (!payload || payload.exp < Date.now()) return null;
  return db().get('users', payload.uid);
}

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) throw unauthorized();
  return u;
}

/** Role-based authorization. Travellers manage journeys; contacts only ever hold a scoped link token (see contact-token.ts). */
export function requireRole(user: User, role: User['role']) {
  if (user.role !== role) throw new ApiError(403, 'forbidden', 'Your role cannot perform this action');
}

export async function deleteAuthUser(userId: string) {
  if (useSupabase()) await sbAdmin().auth.admin.deleteUser(userId);
}

const googleAuthClient = new OAuth2Client();

export async function loginWithGoogle(credentialToken: string): Promise<User> {
  const clientId = env.googleClientId;
  if (!clientId) {
    throw new ApiError(500, 'google_auth_not_configured', 'Google Client ID is not configured on the server. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID or GOOGLE_CLIENT_ID.');
  }

  let payload;
  try {
    const ticket = await googleAuthClient.verifyIdToken({
      idToken: credentialToken,
      audience: clientId,
    });
    payload = ticket.getPayload();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid credential token';
    throw new ApiError(401, 'invalid_google_token', `Google verification failed: ${msg}`);
  }

  if (!payload || !payload.email) {
    throw new ApiError(400, 'invalid_google_payload', 'Google did not return an email address.');
  }

  const email = normEmail(payload.email);
  const store = db();
  let user = (await store.find('users', { email }))[0];

  if (!user) {
    const t = nowIso();
    const id = uid('u_');
    user = {
      id,
      email,
      name: (payload.name || payload.given_name || email.split('@')[0]).trim(),
      role: 'traveller',
      demo: false,
      createdAt: t,
      consentVersion: CONSENT_VERSION,
      consentAt: t,
      settings: { ...DEFAULT_SETTINGS },
      picture: payload.picture,
      googleId: payload.sub,
    };
    await store.insert('users', user);
    await store.insert('consent_log', {
      id: uid('cl_'),
      userId: id,
      kind: 'terms_privacy',
      detail: `Accepted terms & privacy notice via Google Sign-In (${CONSENT_VERSION})`,
      at: t,
    });
  } else if (!user.googleId || !user.picture) {
    await store.update('users', user.id, {
      googleId: user.googleId || payload.sub,
      picture: user.picture || payload.picture,
    });
    user = (await store.get('users', user.id)) || user;
  }

  return user;
}

export const publicUser = (u: User) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  demo: u.demo,
  createdAt: u.createdAt,
  settings: u.settings,
  consentVersion: u.consentVersion,
  picture: u.picture,
});
