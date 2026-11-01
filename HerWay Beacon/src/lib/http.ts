import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export const unauthorized = (m = 'Please sign in') => new ApiError(401, 'unauthorized', m);
export const forbidden = (m = 'You do not have access to this resource') => new ApiError(403, 'forbidden', m);
export const notFound = (m = 'Not found') => new ApiError(404, 'not_found', m);
export const badRequest = (m: string) => new ApiError(400, 'bad_request', m);
export const conflict = (m: string) => new ApiError(409, 'conflict', m);

const g = globalThis as unknown as { __sjRate?: Map<string, number[]> };

/** Tiny in-memory sliding-window limiter (per process). Swap for Redis/Upstash when scaling out. */
export function rateLimit(key: string, limit: number, windowMs: number) {
  const m: Map<string, number[]> = (g.__sjRate ??= new Map<string, number[]>());
  const now = Date.now();
  const hits = (m.get(key) ?? []).filter((t: number) => now - t < windowMs);
  if (hits.length >= limit) throw new ApiError(429, 'rate_limited', 'Too many requests — please wait a moment and try again.');
  hits.push(now);
  m.set(key, hits);
  if (m.size > 5000) for (const [k, v] of m) if (!v.some((t: number) => now - t < windowMs)) m.delete(k);
}

export const clientIp = (req: NextRequest) => req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';

type Ctx<P> = { params: Promise<P> };

/** Wraps a route handler: CSRF origin check, JSON errors, zod validation errors. */
export function route<P extends Record<string, string> = Record<string, string>>(
  fn: (req: NextRequest, p: P) => Promise<unknown>,
) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        const origin = req.headers.get('origin');
        const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
        if (origin && host) {
          let oh = '';
          try { oh = new URL(origin).host; } catch { /* ignore */ }
          if (oh !== host) throw forbidden('Cross-origin request blocked');
        }
      }
      const params = (await ctx?.params) ?? ({} as P);
      const out = await fn(req, params);
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof ApiError) return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: e.status });
      if (e instanceof ZodError) {
        return NextResponse.json({ error: { code: 'validation', message: e.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ') } }, { status: 400 });
      }
      console.error('[api]', req.method, req.nextUrl.pathname, e);
      return NextResponse.json({ error: { code: 'server_error', message: 'Something went wrong on our side. Please try again.' } }, { status: 500 });
    }
  };
}

export async function body<T>(req: NextRequest, schema: { parse: (v: unknown) => T }): Promise<T> {
  let raw: unknown = {};
  try {
    const text = await req.text();
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw badRequest('Request body must be valid JSON');
  }
  return schema.parse(raw);
}
