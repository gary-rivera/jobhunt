import { Router } from 'express';
import { JobSource } from '@prisma/client';
import prisma from '../lib/prisma';
import { checkOllamaConnection, getOllamaRuntimeSnapshot } from '../services/ollama';
import { getStats } from '../services/ollamaMetrics';
import { isOrphaned } from '../services/jobScrapeRunService';
import { buildDigest } from '../services/digestService';

const dashboardRouter = Router();

const fmtBytes = (n: number): string => `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;

const ORPHAN_TIMEOUT_MIN = parseInt(process.env.RUN_ORPHAN_TIMEOUT_MIN || '30', 10);

// Sources the dashboard surfaces as cards. JobSource also has a bare LINKEDIN
// value that the hybrid pipeline doesn't run directly, so it's omitted here.
const ACTIVE_SOURCES: JobSource[] = [
  JobSource.WTTJ,
  JobSource.LINKEDIN_APIFY,
  JobSource.BUILT_IN,
  JobSource.INDEED,
];

const errMsg = (err: unknown): string => (err instanceof Error ? err.message : String(err));

async function buildHealth() {
  // Each probe is isolated: a down database or unreachable Ollama still lets the
  // rest of the payload through — surfacing *that* failure is the whole point.
  const database = await prisma
    .$queryRaw`SELECT 1`
    .then(() => ({ ok: true }) as { ok: boolean; error?: string })
    .catch((err) => ({ ok: false, error: errMsg(err) }));

  const ollama = await checkOllamaConnection()
    .then((h) => ({ ok: h.ok, models: h.models, missingRequired: h.missingRequired }))
    .catch((err) => ({ ok: false, error: errMsg(err) }));

  let runtime;
  try {
    const snap = await getOllamaRuntimeSnapshot();
    runtime = {
      memoryPressure: snap.memoryPressure,
      totalResident: fmtBytes(snap.totalResidentBytes),
      memoryBudget: fmtBytes(snap.memoryBudgetBytes),
      loadedModels: snap.loadedModels.map((m) => ({
        name: m.name,
        size: fmtBytes(m.sizeBytes),
        expiresAt: m.expiresAt,
      })),
    };
  } catch (err) {
    runtime = { error: errMsg(err) };
  }

  return { database, ollama, runtime, metrics: getStats() };
}

async function buildSources() {
  const cards = await Promise.all(
    ACTIVE_SOURCES.map(async (source) => {
      const run = await prisma.jobScrapeRun.findFirst({
        where: { source },
        orderBy: { startedAt: 'desc' },
      });
      if (!run) return { source, lastRun: null };

      const durationMs = run.completedAt
        ? run.completedAt.getTime() - run.startedAt.getTime()
        : null;
      const orphaned = run.status === 'RUNNING' && isOrphaned(run, ORPHAN_TIMEOUT_MIN);

      return {
        source,
        lastRun: {
          id: run.id,
          status: run.status,
          startedAt: run.startedAt,
          completedAt: run.completedAt,
          durationMs,
          orphaned,
          totalFetched: run.totalFetched,
          totalExtracted: run.totalExtracted,
          totalSaved: run.totalSaved,
          totalSkipped: run.totalSkipped,
          totalFailed: run.totalFailed,
          errorMessage: run.errorMessage,
        },
      };
    }),
  );
  return cards;
}

/**
 * GET /dashboard/summary
 *
 * One poll for the whole status dashboard: health (Tier 1), per-source run state
 * (Tier 2), and today's scored candidates (Tier 3). Each section is fault-isolated
 * so a single failing subsystem degrades to an `{ error }` instead of a 500.
 */
dashboardRouter.get('/summary', async (_req, res) => {
  const [health, sources, digest] = await Promise.all([
    buildHealth().catch((err) => ({ error: errMsg(err) })),
    buildSources().catch((err) => ({ error: errMsg(err) })),
    buildDigest(new Date(), { minScore: 0.6, limit: 50 })
      .then((d) => ({ date: d.date, totals: d.totals, listings: d.listings }))
      .catch((err) => ({ error: errMsg(err) })),
  ]);

  return res.json({
    generatedAt: new Date().toISOString(),
    orphanTimeoutMin: ORPHAN_TIMEOUT_MIN,
    health,
    sources,
    digest,
  });
});

export { dashboardRouter };
