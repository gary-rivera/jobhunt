import { Router } from 'express';
import { JobSource } from '@prisma/client';
import { hasAdapter } from '../sources/registry';
import { toJobSourceEnum } from '../sources/types';
import { ValidationError } from '../lib/errors';
import { buildDigest, parseDate, DigestOpts } from '../services/digestService';

const digestRouter = Router();

function parseQuery(req: { query: Record<string, unknown> }): DigestOpts {
  const minScore = req.query.minScore ? parseFloat(req.query.minScore as string) : 0.6;
  const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string, 10), 200) : 50;
  const sourceParam = req.query.source as string | undefined;
  let source: JobSource | undefined;
  if (sourceParam) {
    if (!hasAdapter(sourceParam)) {
      throw new ValidationError(`Unknown source: ${sourceParam}`);
    }
    source = toJobSourceEnum(sourceParam);
  }
  return { minScore, limit, source };
}

digestRouter.get('/today', async (req, res) => {
  const opts = parseQuery(req);
  const digest = await buildDigest(new Date(), opts);
  return res.json(digest);
});

digestRouter.get('/:date', async (req, res) => {
  const opts = parseQuery(req);
  const date = parseDate(req.params.date);
  const digest = await buildDigest(date, opts);
  return res.json(digest);
});

export { digestRouter };
