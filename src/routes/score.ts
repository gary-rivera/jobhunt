import Router from 'express';
import { getUserByAlias } from '../services/userService';
import { processScoring } from '../services/scoringService';
import prisma from '../lib/prisma';
import { ValidationError } from '../lib/errors';
import { generateTimestampTodayStart } from '../utils/time';

const scoreRouter = Router();

// TODO: typing for batcher response

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
  log.info('batch processing complete, summary: ', summary);
  // TODO: make a JobRun table relationship to track these runs and avoid these types of queries
  log.info("fetching today's job listings to determine top 3 scores");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const newJobListings = await prisma.jobListing.findMany({
    where: { createdAt: { gte: today }, score: { not: null } },
  });

  const jobListingsSortedByScores = newJobListings.sort((a, b) => {
    return (b.score || 0) - (a.score || 0);
  });

  const top3 = jobListingsSortedByScores.slice(0, 3);
  const top3Scores = top3.map((jl) => ({ score: jl.score || null, jobListingId: jl.id }));

  return res.json({
    success: summary.scored > 0,
    summary,
    top3: top3Scores,
  });
});

// TODO: query could contain specifics such as daily, weekly, alltime, default to daily
scoreRouter.get('/top-candidates', async (req, res) => {
  // NOTE: for now, just counting any scores above 60, but liable to change
  const jobListings = await prisma.jobListing.findMany({
    where: {
      createdAt: { gte: generateTimestampTodayStart() },
      score: { gte: 0.6 },
    },
    select: {
      id: true,
      score: true,
      createdAt: true,
      applyToUrl: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return res.status(200).json({
    total: jobListings.length,
    data: jobListings,
  });
});

export { scoreRouter };
