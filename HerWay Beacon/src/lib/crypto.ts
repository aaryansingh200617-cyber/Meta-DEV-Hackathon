import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { env } from './env';

let cachedSecret: Buffer | null = null;

/** APP_SECRET if set; otherwise a random secret persisted in the data dir (dev/demo convenience). */
function secret(): Buffer {
  if (cachedSecret) return cachedSecret;
  if (env.appSecret) return (cachedSecret = crypto.createHash('sha256').update(env.appSecret).digest());
  const dir = path.resolve(process.cwd(), env.dataDir);
  const file = path.join(dir, 'secret.key');
  try {
    if (fs.existsSync(file)) return (cachedSecret = Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'hex'));
    fs.mkdirSync(dir, { recursive: true });
    const k = crypto.randomBytes(32);
    fs.writeFileSync(file, k.toString('hex'), { mode: 0o600 });
    console.warn('[herway] APP_SECRET not set — generated a local secret in', file, '(set APP_SECRET in production)');
    return (cachedSecret = k);
  } catch {
    return (cachedSecret = crypto.randomBytes(32));
  }
}

const subkey = (label: string) => crypto.createHmac('sha256', secret()).update(label).digest();

export const uid = (prefix = '') => `${prefix}${crypto.randomUUID()}`;
export const shortId = (prefix = '') => `${prefix}${crypto.randomBytes(5).toString('hex')}`;

/* ── HMAC-signed tokens (sessions, contact links) ── */

export function sign(payload: string, purpose: string): string {
  return crypto.createHmac('sha256', subkey(`sign:${purpose}`)).update(payload).digest('base64url');
}

export function verifySig(payload: string, sig: string, purpose: string): boolean {
  const expected = Buffer.from(sign(payload, purpose));
  const given = Buffer.from(sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

export function makeSignedToken(obj: Record<string, unknown>, purpose: string): string {
  const body = Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${body}.${sign(body, purpose)}`;
}

export function readSignedToken<T>(token: string | undefined | null, purpose: string): T | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig || !verifySig(body, sig, purpose)) return null;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T; } catch { return null; }
}

/* ── Password hashing (local auth mode) ── */

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string | undefined): boolean {
  if (!stored) return false;
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(expected, actual);
}

/* ── Field encryption at rest (contact phone / email) ── */

export function encryptField(plain: string | null | undefined): string | null {
  if (!plain) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', subkey('field-enc'), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${enc.toString('base64url')}`;
}

export function decryptField(blob: string | null | undefined): string | null {
  if (!blob) return null;
  try {
    const [v, iv, tag, data] = blob.split('.');
    if (v !== 'v1' || !iv || !tag || !data) return null;
    const d = crypto.createDecipheriv('aes-256-gcm', subkey('field-enc'), Buffer.from(iv, 'base64url'));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(data, 'base64url')), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export const maskPhone = (p: string | null) => (p ? p.replace(/.(?=.{3}$)/g, '•') : null);
export const maskEmail = (e: string | null) => {
  if (!e) return null;
  const [u, d] = e.split('@');
  return `${u!.slice(0, 1)}•••@${d}`;
};
