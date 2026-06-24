import { Router } from 'express';
import { getStats } from '../services/ollamaMetrics';
import { getOllamaRuntimeSnapshot } from '../services/ollama';

const metricsRouter = Router();

const fmtBytes = (n: number): string => `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;

/**
 * GET /metrics/ollama
 *
 * On-demand insight into whether Ollama is keeping up on this hardware:
 *  - `runtime`  : what's currently resident in memory + a memory-pressure flag.
 *  - `stats`    : rolling latency/throughput over the buffered call window.
 *
 * Read `stats.overall.reloads` first — a non-zero count means the model is being
 * evicted and reloaded between calls, the classic symptom of too little RAM.
 */
metricsRouter.get('/ollama', async (_req, res) => {
  let runtime;
  try {
    const snapshot = await getOllamaRuntimeSnapshot();
    runtime = {
      memoryPressure: snapshot.memoryPressure,
      totalResident: fmtBytes(snapshot.totalResidentBytes),
      memoryBudget: fmtBytes(snapshot.memoryBudgetBytes),
      loadedModels: snapshot.loadedModels.map((m) => ({
        name: m.name,
        size: fmtBytes(m.sizeBytes),
        sizeVram: fmtBytes(m.sizeVramBytes),
        expiresAt: m.expiresAt,
      })),
    };
  } catch (err) {
    runtime = { error: err instanceof Error ? err.message : String(err) };
  }

  return res.json({
    generatedAt: new Date().toISOString(),
    runtime,
    stats: getStats(),
  });
});

export { metricsRouter };
