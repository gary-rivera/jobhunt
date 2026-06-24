/**
 * Lightweight, in-memory instrumentation for Ollama calls.
 *
 * Goal: tell whether the 8 GB box is choking. The single most useful signal is
 * `load_duration` — when a model is already resident in memory it is ~0; when
 * Ollama has to (re)load weights from disk (because something evicted them under
 * memory pressure) it spikes to seconds. A high `reloads` count across a run is
 * the fingerprint of memory thrash. We also track wall-clock latency percentiles
 * and generation throughput (tokens/sec) for general capacity insight.
 *
 * Everything lives in a bounded ring buffer in process memory — no DB, no deps.
 * Inspect via GET /metrics/ollama, or read the per-run summary the pipeline logs.
 */

export type OllamaCallKind = 'embed' | 'chat';

export interface OllamaSample {
  ts: number; // epoch ms when the call returned
  model: string;
  kind: OllamaCallKind;
  wallMs: number; // wall-clock around the call (includes network/queue)
  totalMs?: number; // Ollama-reported total_duration
  loadMs?: number; // Ollama-reported load_duration (model load time)
  promptTokens?: number;
  evalTokens?: number; // generated tokens (chat only)
  evalMs?: number; // generation time (chat only)
  reload: boolean; // loadMs crossed the reload threshold
  ok: boolean;
  error?: string;
}

const NS_PER_MS = 1e6;
export const nsToMs = (ns?: number): number | undefined =>
  typeof ns === 'number' && Number.isFinite(ns) ? ns / NS_PER_MS : undefined;

const MAX_SAMPLES = parseInt(process.env.OLLAMA_METRICS_BUFFER || '1000', 10);
// Above this load time we treat the call as having (re)loaded the model into
// memory rather than reusing a resident copy. ~1s is comfortably above the
// few-ms bookkeeping cost of a warm model but below a real cold load.
export const RELOAD_THRESHOLD_MS = parseInt(process.env.OLLAMA_RELOAD_THRESHOLD_MS || '1000', 10);

const samples: OllamaSample[] = [];

export function recordSample(s: OllamaSample): void {
  samples.push(s);
  if (samples.length > MAX_SAMPLES) samples.shift();
}

export interface OllamaStatSummary {
  count: number;
  errors: number;
  reloads: number;
  wallMsAvg: number;
  wallMsP50: number;
  wallMsP95: number;
  wallMsMax: number;
  loadMsAvg: number;
  loadMsMax: number;
  genTokensPerSec?: number;
}

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

function summarize(list: OllamaSample[]): OllamaStatSummary {
  if (list.length === 0) {
    return {
      count: 0,
      errors: 0,
      reloads: 0,
      wallMsAvg: 0,
      wallMsP50: 0,
      wallMsP95: 0,
      wallMsMax: 0,
      loadMsAvg: 0,
      loadMsMax: 0,
    };
  }
  const walls = list.map((s) => s.wallMs).sort((a, b) => a - b);
  const loads = list.map((s) => s.loadMs ?? 0);
  const pct = (p: number): number => walls[Math.min(walls.length - 1, Math.floor(p * walls.length))];
  const evalTokens = sum(list.map((s) => s.evalTokens ?? 0));
  const evalMs = sum(list.map((s) => s.evalMs ?? 0));
  return {
    count: list.length,
    errors: list.filter((s) => !s.ok).length,
    reloads: list.filter((s) => s.reload).length,
    wallMsAvg: Math.round(sum(walls) / walls.length),
    wallMsP50: Math.round(pct(0.5)),
    wallMsP95: Math.round(pct(0.95)),
    wallMsMax: Math.round(walls[walls.length - 1]),
    loadMsAvg: Math.round(sum(loads) / loads.length),
    loadMsMax: Math.round(Math.max(...loads)),
    genTokensPerSec: evalMs > 0 ? +(evalTokens / (evalMs / 1000)).toFixed(1) : undefined,
  };
}

/** Most recent distinct error messages with a count — surfaces OOM / model-load failures. */
function recentErrors(limit = 5): Array<{ error: string; count: number; lastSeen: number }> {
  const byMsg = new Map<string, { count: number; lastSeen: number }>();
  for (const s of samples) {
    if (s.ok || !s.error) continue;
    const cur = byMsg.get(s.error) ?? { count: 0, lastSeen: 0 };
    byMsg.set(s.error, { count: cur.count + 1, lastSeen: Math.max(cur.lastSeen, s.ts) });
  }
  return Array.from(byMsg.entries())
    .map(([error, v]) => ({ error, ...v }))
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .slice(0, limit);
}

export function getStats(): {
  overall: OllamaStatSummary;
  byKind: Record<OllamaCallKind, OllamaStatSummary>;
  recentErrors: Array<{ error: string; count: number; lastSeen: number }>;
  bufferedSamples: number;
  reloadThresholdMs: number;
} {
  return {
    overall: summarize(samples),
    byKind: {
      embed: summarize(samples.filter((s) => s.kind === 'embed')),
      chat: summarize(samples.filter((s) => s.kind === 'chat')),
    },
    recentErrors: recentErrors(),
    bufferedSamples: samples.length,
    reloadThresholdMs: RELOAD_THRESHOLD_MS,
  };
}

/** Summary of only the samples recorded at/after `tsStart` — used for per-run logging. */
export function summarizeSince(tsStart: number): OllamaStatSummary {
  return summarize(samples.filter((s) => s.ts >= tsStart));
}

/** Test/maintenance helper. */
export function __resetMetricsForTest(): void {
  samples.length = 0;
}
