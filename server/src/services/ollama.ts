import { Ollama, ChatResponse, ListResponse } from 'ollama';
import { OllamaConnectionError, OllamaModelError } from '../lib/errors/ollama';
import { nsToMs, recordSample, RELOAD_THRESHOLD_MS } from './ollamaMetrics';

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'localhost';
const OLLAMA_LOCAL_URL = `http://${OLLAMA_HOST}:${process.env.OLLAMA_PORT || '11434'}`;
const ollama = new Ollama({ host: OLLAMA_LOCAL_URL });

const EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';
const CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL || 'llama3.1:8b';

interface OllamaModelConfig {
  name: string;
  required: boolean;
}
const ollamaLocalConfig: {
  models: Record<'embedding' | 'chat', OllamaModelConfig>;
  readonly requiredModels: string[];
} = {
  models: {
    embedding: {
      name: EMBEDDING_MODEL,
      required: true,
    },
    chat: {
      name: CHAT_MODEL,
      required: false,
    },
  },
  get requiredModels(): string[] {
    return Object.values(this.models)
      .filter((model) => model.required)
      .map((model) => model.name.split(':')[0]);
  },
};
export type OllamaModelStatus = 'not_installed' | 'installed_not_running' | 'running';

export interface OllamaHealth {
  ok: boolean;
  models: Record<string, OllamaModelStatus>;
  missingRequired: string[];
}

async function listModelNames(fetcher: () => Promise<ListResponse>): Promise<Set<string>> {
  const resp = await fetcher();
  return new Set(resp.models.map((model) => model.name.split(':')[0]));
}

export async function checkOllamaConnection(): Promise<OllamaHealth> {
  log.info('[ollama] checking installed + running models');
  const [installed, running] = await Promise.all([
    listModelNames(() => ollama.list()),
    listModelNames(() => ollama.ps()),
  ]);

  const allConfigured = Object.values(ollamaLocalConfig.models).map((m) => m.name.split(':')[0]);
  const models: Record<string, OllamaModelStatus> = {};
  for (const name of allConfigured) {
    if (running.has(name)) models[name] = 'running';
    else if (installed.has(name)) models[name] = 'installed_not_running';
    else models[name] = 'not_installed';
  }

  const missingRequired = ollamaLocalConfig.requiredModels.filter((name) => !installed.has(name));
  const ok = missingRequired.length === 0;

  log.info('[ollama] health', { ok, models, missingRequired });
  return { ok, models, missingRequired };
}

const EMBEDDING_NUM_CTX = parseInt(process.env.OLLAMA_EMBEDDING_NUM_CTX || '8192', 10);
const EMBEDDING_TRUNCATE_FALLBACK_CHARS = parseInt(
  process.env.OLLAMA_EMBEDDING_TRUNCATE_FALLBACK_CHARS || '7000',
  10,
);

function isContextLengthError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /context length|input length/i.test(err.message);
}

async function embedOnce(text: string, numCtx?: number): Promise<number[]> {
  const startedAt = Date.now();
  try {
    const response = await ollama.embed({
      model: EMBEDDING_MODEL,
      input: text,
      ...(numCtx ? { options: { num_ctx: numCtx } } : {}),
    });
    if (!response) throw new OllamaConnectionError();
    const embedding = response.embeddings[0];
    if (!embedding) throw new OllamaModelError('No embedding returned from Ollama API');
    const loadMs = nsToMs(response.load_duration);
    recordSample({
      ts: Date.now(),
      model: EMBEDDING_MODEL,
      kind: 'embed',
      wallMs: Date.now() - startedAt,
      totalMs: nsToMs(response.total_duration),
      loadMs,
      promptTokens: response.prompt_eval_count,
      reload: (loadMs ?? 0) >= RELOAD_THRESHOLD_MS,
      ok: true,
    });
    return embedding;
  } catch (err) {
    recordSample({
      ts: Date.now(),
      model: EMBEDDING_MODEL,
      kind: 'embed',
      wallMs: Date.now() - startedAt,
      reload: false,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  log.info('[ollama] Attempting to generate embedding', { inputLen: text.length });
  try {
    const embedding = await embedOnce(text, EMBEDDING_NUM_CTX);
    log.success('[ollama] Generated embedding of length:', embedding.length);
    return embedding;
  } catch (error) {
    if (isContextLengthError(error)) {
      log.warn('[ollama] context length exceeded; retrying with truncated input', {
        originalLen: text.length,
        truncatedTo: EMBEDDING_TRUNCATE_FALLBACK_CHARS,
      });
      try {
        const embedding = await embedOnce(
          text.slice(0, EMBEDDING_TRUNCATE_FALLBACK_CHARS),
          EMBEDDING_NUM_CTX,
        );
        log.success('[ollama] Generated embedding (truncated) of length:', embedding.length);
        return embedding;
      } catch (retryErr) {
        log.error('[ollama] Truncated embedding also failed:', retryErr);
        throw retryErr;
      }
    }
    log.error('[ollama] Error generating embedding:', error);
    throw error;
  }
}

export async function generateUserBioSummary(resume_md: string, category?: string): Promise<ChatResponse | null> {
  const prompt = generatePrompt(resume_md, category || 'technical');
  const startedAt = Date.now();
  try {
    const response = await ollama.chat({
      model: CHAT_MODEL,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });
    if (response) {
      const loadMs = nsToMs(response.load_duration);
      recordSample({
        ts: Date.now(),
        model: CHAT_MODEL,
        kind: 'chat',
        wallMs: Date.now() - startedAt,
        totalMs: nsToMs(response.total_duration),
        loadMs,
        promptTokens: response.prompt_eval_count,
        evalTokens: response.eval_count,
        evalMs: nsToMs(response.eval_duration),
        reload: (loadMs ?? 0) >= RELOAD_THRESHOLD_MS,
        ok: true,
      });
      return response;
    }
    return null;
  } catch (error) {
    recordSample({
      ts: Date.now(),
      model: CHAT_MODEL,
      kind: 'chat',
      wallMs: Date.now() - startedAt,
      reload: false,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
    log.error('Error generating user profile summary:', error);
    return null;
  }
}

/**
 * Snapshot of what Ollama currently holds in memory (via `ollama.ps()`), plus a
 * crude memory-pressure flag. On an 8 GB CPU-only box, `size` is the RAM footprint
 * of each loaded model; if the configured models can't all stay resident they get
 * evicted and reloaded (see reload tracking in ollamaMetrics). size_vram > 0 only
 * if a GPU is in play (expected 0 here).
 */
export interface OllamaRuntimeModel {
  name: string;
  sizeBytes: number;
  sizeVramBytes: number;
  expiresAt: Date;
}
export interface OllamaRuntimeSnapshot {
  loadedModels: OllamaRuntimeModel[];
  totalResidentBytes: number;
  memoryBudgetBytes: number;
  memoryPressure: boolean;
}

const MEMORY_BUDGET_BYTES = parseInt(
  process.env.OLLAMA_MEMORY_BUDGET_BYTES || String(8 * 1024 * 1024 * 1024),
  10,
);
// Fraction of the budget above which we flag pressure (room for OS + node + postgres).
const MEMORY_PRESSURE_RATIO = parseFloat(process.env.OLLAMA_MEMORY_PRESSURE_RATIO || '0.7');

export async function getOllamaRuntimeSnapshot(): Promise<OllamaRuntimeSnapshot> {
  const ps = await ollama.ps();
  const loadedModels: OllamaRuntimeModel[] = ps.models.map((m) => ({
    name: m.name,
    sizeBytes: m.size,
    sizeVramBytes: m.size_vram,
    expiresAt: m.expires_at,
  }));
  const totalResidentBytes = loadedModels.reduce((acc, m) => acc + m.sizeBytes, 0);
  return {
    loadedModels,
    totalResidentBytes,
    memoryBudgetBytes: MEMORY_BUDGET_BYTES,
    memoryPressure: totalResidentBytes > MEMORY_BUDGET_BYTES * MEMORY_PRESSURE_RATIO,
  };
}

function generatePrompt(resume_md: string, category: string) {
  const categoryMap = {
    technical: {
      focusOn: 'representing the most important technical skills and tools I have',
      additionalRequirements: [],
    },
    industry: {
      focusOn: 'capturing what industries I have experience in',
      additionalRequirements: [
        '- Include that I have experience in early-stage startups with high growth',
        '- Mention experience in both B2B and B2C environments',
        '- Highlight working FinTech and SaaS sectors specifically, namely credit building, mortgages, banking, and developer tools',
      ],
    },
    tenure: {
      focusOn: 'duration and progression of roles',
      additionalRequirements: [],
    },
  };

  return `Transform this resume markdown into a paragraph summary optimized for job matching.

	Requirements:
	- Use language commonly found in job descriptions (not resume language)
	- Include specific technologies, years of experience, and quantifiable details
	- Write in descriptive paragraphs, not bullet points
	- Focus on ${categoryMap[category as keyof typeof categoryMap].focusOn}
	${categoryMap[category as keyof typeof categoryMap].additionalRequirements.join('\n')}
	- No additional commentary, only the summary itself

	Resume as Markdown:
	${resume_md}

	Output a single paragraph summary that maximizes semantic similarity with job postings in my field with no additional commentary, only the summary itself.
	`;
}
