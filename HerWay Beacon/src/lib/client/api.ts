export class ApiClientError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export async function api<T = unknown>(path: string, init?: Omit<RequestInit, 'body'> & { body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiClientError(0, 'network', 'Cannot reach the server. Check your connection and try again.');
  }
  let json: { error?: { code: string; message: string } } & Record<string, unknown> = {};
  try { json = await res.json(); } catch { /* empty body */ }
  if (!res.ok) throw new ApiClientError(res.status, json.error?.code ?? 'error', json.error?.message ?? `Request failed (${res.status})`);
  return json as T;
}

export const post = <T,>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body: body ?? {} });
export const patch = <T,>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body });
export const del = <T,>(path: string, body?: unknown) => api<T>(path, { method: 'DELETE', body });

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
