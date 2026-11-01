import { env } from '../env';

export interface MetaResult {
  text: string;
  model: string;
}

/**
 * Meta Model API & Universal AI Engine (Groq / Meta dev.meta.ai / OpenRouter).
 * Supports both OpenAI-compatible Chat Completions and Meta native Responses API.
 */
export async function metaComplete(opts: {
  system: string;
  user: string;
  maxOutputTokens?: number;
}): Promise<MetaResult> {
  const key = env.metaKey.trim();
  if (!key) throw new Error('MODEL_API_KEY not set');

  const base = env.metaBase;
  const isChatEndpoint =
    base.includes('api.meta.ai') ||
    base.includes('groq.com') ||
    base.includes('together.xyz') ||
    base.includes('openrouter.ai') ||
    base.endsWith('/v1') ||
    base.endsWith('/chat/completions');

  // If using standard chat completions provider (Meta API, Groq, Together, OpenRouter, etc.)
  if (isChatEndpoint) {
    const url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
    const candidateModels = Array.from(
      new Set(
        [
          env.metaModel,
          'muse-spark-1.3',
          'muse-wonder-1.0',
          'openai/gpt-oss-120b',
          'qwen/qwen3.8-27b',
          'llama-3.3-70b-versatile',
        ].filter(Boolean),
      ),
    );

    let lastError = '';
    for (const m of candidateModels) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: m,
            messages: [
              { role: 'system', content: opts.system },
              { role: 'user', content: opts.user },
            ],
            max_tokens: opts.maxOutputTokens ?? 2000,
            temperature: 0.2,
          }),
          signal: AbortSignal.timeout(25_000),
        });

        if (res.ok) {
          const data = (await res.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          const text = data.choices?.[0]?.message?.content ?? '';
          if (text.trim()) {
            return { text: text.trim(), model: m };
          }
        } else {
          lastError = await res.text().catch(() => '');
          // If 404 (model not found) or 400 (bad model), try next model
          if (res.status === 404 || res.status === 400) {
            continue;
          }
          break;
        }
      } catch (e) {
        lastError = (e as Error).message;
      }
    }

    // If primary provider failed and a separate Groq key exists, try Groq fallback
    if (env.hasMetaKey && env.groqKey && key !== env.groqKey) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.groqKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'openai/gpt-oss-120b',
            messages: [
              { role: 'system', content: opts.system },
              { role: 'user', content: opts.user },
            ],
            max_tokens: opts.maxOutputTokens ?? 2000,
            temperature: 0.2,
          }),
          signal: AbortSignal.timeout(25_000),
        });
        if (groqRes.ok) {
          const gData = (await groqRes.json()) as { choices?: { message?: { content?: string } }[] };
          const gText = gData.choices?.[0]?.message?.content ?? '';
          if (gText.trim()) return { text: gText.trim(), model: 'groq/openai/gpt-oss-120b' };
        }
      } catch {
        // Continue to throw lastError below
      }
    }

    throw new Error(`AI API error: ${lastError.slice(0, 120)}`);
  }

  // Native Meta Model API (POST {base}/responses)
  const callMetaNative = async (withLimit: boolean) =>
    fetch(`${base}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.metaModel,
        input: [
          { role: 'system', content: opts.system },
          { role: 'user', content: opts.user },
        ],
        ...(withLimit ? { max_output_tokens: opts.maxOutputTokens ?? 2000 } : {}),
      }),
      signal: AbortSignal.timeout(25_000),
    });

  let res = await callMetaNative(true);
  if (res.status === 400) res = await callMetaNative(false);

  // If 404 or 405 on /responses, try fallback to /chat/completions
  if (res.status === 404 || res.status === 405) {
    const fallbackRes = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.metaModel,
        messages: [
          { role: 'system', content: opts.system },
          { role: 'user', content: opts.user },
        ],
        max_tokens: opts.maxOutputTokens ?? 2000,
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (fallbackRes.ok) {
      const fbData = (await fallbackRes.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = fbData.choices?.[0]?.message?.content ?? '';
      if (text.trim()) return { text: text.trim(), model: env.metaModel };
    }
  }

  if (!res.ok) throw new Error(`Meta API ${res.status}`);

  const data = (await res.json()) as {
    output_text?: string;
    output?: { type: string; content?: { type: string; text?: string }[] }[];
  };

  const text =
    data.output_text ??
    (data.output ?? [])
      .filter((o) => o.type === 'message')
      .flatMap((o) => o.content ?? [])
      .filter((c) => c.type === 'output_text')
      .map((c) => c.text ?? '')
      .join('');

  if (!text.trim()) throw new Error('Empty response from Meta API');
  return { text: text.trim(), model: env.metaModel };
}

export function extractJson<T>(text: string): T | null {
  const a = text.indexOf('{');
  const b = text.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try {
    return JSON.parse(text.slice(a, b + 1)) as T;
  } catch {
    return null;
  }
}
