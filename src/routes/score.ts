import Router from 'express';
import { getUserByAlias } from '../services/userService';
import { processScoring } from '../services/scoringService';
import prisma from '../lib/prisma';
import { ValidationError } from '../lib/errors';

const scoreRouter = Router();

// interface BatchScoringResponse {
//   ok: boolean;
//   error: any;
//   best_matches?: LinkedInJob[]; // TODO: update this interface to an apt one for n8n to expect/interact with
//   total?: {
//     scored: number;
//     skipped: number;
//     received: number;
//     failed: number;
//   };
// }

scoreRouter.post('/single', async (req, res) => {
  const { alias, job } = req.body;
  log.info('[score/single] Starting scoring process for user and single job listing...');
  const user = await getUserByAlias(alias);
  const { jobListing, similarityScore } = await processScoring(user, job);

  return res.json({
    success: {
      fetching_user: !!user,
      creating_listing_record: !!jobListing,
      scoring: !!similarityScore,
    },
    similarity_score: similarityScore,
  });
});

// TODO: parallelize so that multiple can be processed at once (maybe 3?)
// TODO: timer module to track how long a given job listing takes to process (use extra benchmark util?)
scoreRouter.post('/batch', async (req, res) => {
  log.info('[score/batch] Starting batch scoring process for user and scraped jobs...');
  const { alias, scraped_jobs: scrapedJobs } = req.body;
  // source: n8n/linkedin

  const user = await getUserByAlias(alias);

  if (!scrapedJobs.length) {
    throw new ValidationError('No scraped jobs were passed in to batch processor');
  }

  const summary = {
    scored: 0,
    skipped: 0,
    received: scrapedJobs.length,
    failed: 0,
  };
  log.info(`starting batch process of ${scrapedJobs.length} scraped jobs`);
  for (const scrapedJob of scrapedJobs) {
    try {
      await processScoring(user, scrapedJob);
      summary.scored++;
    } catch (err) {
      log.error(err);
      summary.failed++;
    }
  }

  // once all done with assigning scores
  // query every jobListing created from the current run
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const newJobListings = await prisma.jobListing.findMany({
    where: { createdAt: { gte: today }, score: { not: null } },
  });

  const jobListingsSortedByScores = newJobListings.sort((a, b) => {
    // Since score is guaranteed to be non-null from your query
    return (b.score || 0) - (a.score || 0);
  });

  const top3Scores = jobListingsSortedByScores.slice(0, 3);

  return res.json({
    message: 'batch process complete',
    score: 'todo',
    summary,
    top3: top3Scores,
  });
});

export { scoreRouter };
