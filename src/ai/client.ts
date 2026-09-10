/**
 * Model client. OpenAI-compatible, so it points at SPUR, OpenAI, or anything else
 * speaking the same protocol by changing two environment variables.
 *
 * SPUR is the sponsor's provider and is the intended path. The indirection exists
 * because their credits were still unfunded during the build, not because the model
 * is optional: the judged demo runs on a real model. Anything else would be the
 * "opt-in, no key required" framing that reads as weak AI use.
 */

const DEFAULT_BASE = 'https://ai.spuric.com/v1';

export interface ModelConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Tried in order if the primary model errors. SPUR featured Gemma 4 for this event. */
  fallbacks: string[];
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): ModelConfig {
  return {
    baseUrl: env.SPUR_BASE_URL || env.OPENAI_BASE_URL || DEFAULT_BASE,
    apiKey: env.SPUR_API_KEY || env.OPENAI_API_KEY || '',
    model: env.SPUR_MODEL || env.MODEL || 'spur-glm-5-2',
    // Verified against GET /v1/models. The id in SPUR's welcome email
    // ("Google Gemma 4 31B") is a display name and 404s if sent as a model id.
    fallbacks: (env.SPUR_FALLBACK_MODELS || 'spur-gemma4,spur-deepseek-v4').split(',').map((s) => s.trim()).filter(Boolean),
  };
}

export type ModelFailure =
  | { kind: 'no-key' }
  | { kind: 'unfunded'; detail: string }
  | { kind: 'auth'; detail: string }
  | { kind: 'unavailable'; detail: string };

export class ModelError extends Error {
  constructor(readonly failure: ModelFailure) {
    super(describe(failure));
    this.name = 'ModelError';
  }
}

export function describe(f: ModelFailure): string {
  switch (f.kind) {
    case 'no-key':
      return 'No API key. Set SPUR_API_KEY (or OPENAI_API_KEY) in .env.';
    case 'unfunded':
      return `The key is valid but the account has no credit. ${f.detail}`;
    case 'auth':
      return `The key was rejected. ${f.detail}`;
    case 'unavailable':
      return `The model endpoint did not answer. ${f.detail}`;
  }
}

export interface ChatOptions {
  system?: string;
  /** Ask for a JSON object back. Falls back to prompt discipline if unsupported. */
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

async function callOnce(
  cfg: ModelConfig,
  model: string,
  prompt: string,
  opts: ChatOptions,
): Promise<string> {
  const messages: Array<{ role: string; content: string }> = [];
  if (opts.system) messages.push({ role: 'system', content: opts.system });
  messages.push({ role: 'user', content: prompt });

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: opts.temperature ?? 0,
    // GLM 5.2 is a reasoning model: it spends tokens thinking before it emits any
    // content, so a budget sized for the answer alone truncates mid-JSON.
    max_tokens: opts.maxTokens ?? 4000,
  };
  if (opts.json) body.response_format = { type: 'json_object' };

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: opts.signal ?? AbortSignal.timeout(60_000),
  });

  const text = await res.text();
  if (!res.ok) {
    if (res.status === 402) throw new ModelError({ kind: 'unfunded', detail: text.slice(0, 200) });
    if (res.status === 401 || res.status === 403) throw new ModelError({ kind: 'auth', detail: text.slice(0, 200) });
    throw new ModelError({ kind: 'unavailable', detail: `HTTP ${res.status}: ${text.slice(0, 200)}` });
  }

  const parsed = JSON.parse(text) as ChatResponse;
  const content = parsed.choices?.[0]?.message?.content;
  if (!content) throw new ModelError({ kind: 'unavailable', detail: 'empty completion' });
  return content;
}

/** Ask the model, trying the configured fallbacks if the primary is unavailable. */
export async function chat(prompt: string, opts: ChatOptions = {}, cfg = readConfig()): Promise<string> {
  if (!cfg.apiKey) throw new ModelError({ kind: 'no-key' });

  const models = [cfg.model, ...cfg.fallbacks];
  let last: unknown;
  for (const model of models) {
    try {
      return await callOnce(cfg, model, prompt, opts);
    } catch (err) {
      last = err;
      // No credit and a bad key are account-level. Trying another model cannot help.
      if (err instanceof ModelError && (err.failure.kind === 'unfunded' || err.failure.kind === 'auth')) throw err;
    }
  }
  throw last instanceof Error ? last : new ModelError({ kind: 'unavailable', detail: String(last) });
}

/** Parse a JSON object out of a completion, tolerating fenced code blocks. */
export function extractJson<T>(raw: string): T {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : raw).trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error(`No JSON object in completion: ${raw.slice(0, 160)}`);
  return JSON.parse(body.slice(start, end + 1)) as T;
}
