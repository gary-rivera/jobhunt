import { Router } from 'express';
import { hasAdapter } from '../sources/registry';
import { SearchParams, toJobSourceEnum } from '../sources/types';
import {
  createRun,
  findRunningRun,
  isOrphaned,
  markOrphanedFailed,
} from '../services/jobScrapeRunService';
import { runSource } from '../pipeline/run';
import { ValidationError } from '../lib/errors';

// Load adapters so their registerAdapter() side effect runs at process start
import '../sources/wttj';
import '../sources/built-in';
import '../sources/indeed';

const sourcesRouter = Router();
const ORPHAN_TIMEOUT_MIN = parseInt(process.env.RUN_ORPHAN_TIMEOUT_MIN || '30', 10);

function validateSearchParams(body: unknown): SearchParams {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body must be a JSON object');
  }
  const b = body as Record<string, unknown>;
  if (typeof b.query !== 'string' || b.query.length === 0) {
    throw new ValidationError('SearchParams.query is required (non-empty string)');
  }
  return {
    query: b.query,
    locations: Array.isArray(b.locations) ? (b.locations as string[]) : undefined,
    contractTypes: Array.isArray(b.contractTypes) ? (b.contractTypes as string[]) : undefined,
    postedWithinDays: typeof b.postedWithinDays === 'number' ? b.postedWithinDays : undefined,
    hitsPerPage: typeof b.hitsPerPage === 'number' ? b.hitsPerPage : undefined,
    maxPages: typeof b.maxPages === 'number' ? b.maxPages : undefined,
  };
}

sourcesRouter.post('/:sourceId/run', async (req, res) => {
  const { sourceId } = req.params;
  if (!hasAdapter(sourceId)) {
    return res.status(404).json({ error: `Unknown source: ${sourceId}` });
  }
  const params = validateSearchParams(req.body);
  const enumSource = toJobSourceEnum(sourceId);

  const existing = await findRunningRun(enumSource);
  if (existing) {
    if (isOrphaned(existing, ORPHAN_TIMEOUT_MIN)) {
      await markOrphanedFailed(existing);
    } else {
      return res.status(409).json({
        error: 'A run is already in progress for this source',
        runId: existing.id,
        startedAt: existing.startedAt,
      });
    }
  }

  const run = await createRun(enumSource);

  setImmediate(() => {
    runSource(run.id, sourceId, params).catch((err) => {
      log.error('[sources route] background runSource crashed', {
        runId: run.id,
        sourceId,
        err: err instanceof Error ? err.message : String(err),
      });
    });
  });

  return res.status(202).json({ runId: run.id, source: enumSource });
});

export { sourcesRouter };
