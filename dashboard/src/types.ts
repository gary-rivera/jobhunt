// Mirrors the GET /dashboard/summary response shape (server/src/routes/dashboard.ts).

export type RunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED';

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

export interface LoadedModel {
  name: string;
  size: string;
  expiresAt: string;
}

export interface Health {
  database: { ok: boolean; error?: string };
  ollama: {
    ok: boolean;
    models?: Record<string, string>;
    missingRequired?: string[];
    error?: string;
  };
  runtime:
    | {
        memoryPressure: boolean;
        totalResident: string;
        memoryBudget: string;
        loadedModels: LoadedModel[];
      }
    | { error: string };
  metrics: {
    overall: OllamaStatSummary;
    byKind: { embed: OllamaStatSummary; chat: OllamaStatSummary };
    recentErrors: Array<{ error: string; count: number; lastSeen: number }>;
    bufferedSamples: number;
    reloadThresholdMs: number;
  };
}

export interface LastRun {
  id: number;
  status: RunStatus;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  orphaned: boolean;
  totalFetched: number | null;
  totalExtracted: number | null;
  totalSaved: number | null;
  totalSkipped: number | null;
  totalFailed: number | null;
  errorMessage: string | null;
}

export interface SourceCardData {
  source: string;
  lastRun: LastRun | null;
}

export interface Candidate {
  id: number;
  source: string;
  title: string;
  company: string;
  location: string;
  listingUrl: string;
  applyToUrl: string | null;
  salaryMidpointUsd: number | null;
  score: number | null;
  postedAt: string | null;
  alsoSeenOn?: string[];
}

export interface Digest {
  date: string;
  totals: { candidates: number; beforeCollapse: number; bySource: Record<string, number> };
  listings: Candidate[];
}

export interface Summary {
  generatedAt: string;
  orphanTimeoutMin: number;
  health: Health | { error: string };
  sources: SourceCardData[] | { error: string };
  digest: Digest | { error: string };
}

export const hasError = <T extends object>(v: T | { error: string }): v is { error: string } =>
  'error' in v;
