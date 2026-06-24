import { nsToMs, recordSample, RELOAD_THRESHOLD_MS } from './ollamaMetrics';

const DEFAULT_MODEL = process.env.OLLAMA_EXTRACTION_MODEL || 'llama3.1:8b';
const DEFAULT_NUM_CTX = parseInt(process.env.OLLAMA_EXTRACTION_NUM_CTX || '8192', 10);
// Keep the input cap aligned with num_ctx: a smaller context window can't hold a
// 30k-char prompt, so reducing one without the other silently truncates the job
// description. Configurable so they can be tuned together for the host's RAM.
const DEFAULT_MAX_HTML_CHARS = parseInt(
  process.env.OLLAMA_EXTRACTION_MAX_HTML_CHARS || '30000',
  10,
);
const DEFAULT_SYSTEM =
  'Extract the fields described by the schema from the HTML below. Return JSON only.';

function ollamaUrl(): string {
  const port = process.env.OLLAMA_PORT || '11434';
  const host = process.env.OLLAMA_HOST || 'localhost';
  return `http://${host}:${port}/api/generate`;
}

export function preCleanHtml(html: string, maxChars = DEFAULT_MAX_HTML_CHARS): string {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.length > maxChars ? stripped.slice(0, maxChars) : stripped;
}

export interface ExtractWithLLMOptions {
  maxHtmlChars?: number;
  model?: string;
  system?: string;
  numCtx?: number;
}

export async function extractWithLLM<T>(
  html: string,
  schema: unknown,
  opts: ExtractWithLLMOptions = {},
): Promise<T> {
  const cleaned = preCleanHtml(html, opts.maxHtmlChars ?? DEFAULT_MAX_HTML_CHARS);
  const model = opts.model ?? DEFAULT_MODEL;
  const numCtx = opts.numCtx ?? DEFAULT_NUM_CTX;
  const system = opts.system ?? DEFAULT_SYSTEM;

  const body = {
    model,
    prompt: `HTML:\n${cleaned}`,
    system,
    format: schema,
    stream: false,
    options: { num_ctx: numCtx },
  };

  const startedAt = Date.now();
  const recordFailure = (error: string): void =>
    recordSample({
      ts: Date.now(),
      model,
      kind: 'chat',
      wallMs: Date.now() - startedAt,
      reload: false,
      ok: false,
      error,
    });

  let resp: Response;
  try {
    resp = await fetch(ollamaUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    recordFailure(err instanceof Error ? err.message : String(err));
    throw err;
  }
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    // Surfaces OOM on small hardware, e.g. {"error":"model requires more system memory ..."}
    recordFailure(`Ollama ${resp.status}: ${errText.slice(0, 200)}`);
    throw new Error(`[llmExtractor] Ollama ${resp.status}: ${errText.slice(0, 200)}`);
  }
  const data = (await resp.json()) as {
    response?: string;
    total_duration?: number;
    load_duration?: number;
    prompt_eval_count?: number;
    eval_count?: number;
    eval_duration?: number;
  };
  const raw = data.response ?? '';

  const loadMs = nsToMs(data.load_duration);
  recordSample({
    ts: Date.now(),
    model,
    kind: 'chat',
    wallMs: Date.now() - startedAt,
    totalMs: nsToMs(data.total_duration),
    loadMs,
    promptTokens: data.prompt_eval_count,
    evalTokens: data.eval_count,
    evalMs: nsToMs(data.eval_duration),
    reload: (loadMs ?? 0) >= RELOAD_THRESHOLD_MS,
    ok: true,
  });

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(
      `[llmExtractor] failed to parse JSON from model=${model} (response excerpt: ${raw.slice(0, 200)})`,
    );
  }
}
