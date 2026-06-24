import { Router } from 'express';
import { getRun, listRuns, listListingsForRun } from '../services/jobScrapeRunService';
import { toJobSourceEnum } from '../sources/types';
import { hasAdapter } from '../sources/registry';
import { ValidationError } from '../lib/errors';

const runsRouter = Router();

runsRouter.get('/', async (req, res) => {
  const sourceParam = req.query.source as string | undefined;
  const limitParam = req.query.limit as string | undefined;

  let source;
  if (sourceParam) {
    if (!hasAdapter(sourceParam)) {
      throw new ValidationError(`Unknown source: ${sourceParam}`);
    }
    source = toJobSourceEnum(sourceParam);
  }

  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 20;
  const runs = await listRuns({ source, limit });
  return res.json({ count: runs.length, runs });
});

runsRouter.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) throw new ValidationError('Invalid run id');
  const run = await getRun(id);
  if (!run) return res.status(404).json({ error: 'Run not found' });
  return res.json(run);
});

runsRouter.get('/:id/listings', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) throw new ValidationError('Invalid run id');

  const limitParam = req.query.limit as string | undefined;
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 500) : 200;
  if (isNaN(limit) || limit < 1) throw new ValidationError('Invalid limit');

  const run = await getRun(id);
  if (!run) return res.status(404).json({ error: 'Run not found' });

  const listings = await listListingsForRun(id, limit);
  return res.json({ runId: id, count: listings.length, listings });
});

export { runsRouter };
