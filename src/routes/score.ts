import Router from 'express';
import { User, JobListing } from '@prisma/client';
import { getUserByAlias } from '../services/userService';
import { getJobListing, transformScrapedJob } from '../services/jobListingService';
import { cosineSimilarity } from '../utils/scoring';

import { generateEmbedding } from '../services/ollama';

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

// scoreRouter.get('/single-job/:alias/:jobId', async (req, res) => {
//   log.info('[score/single-job] Starting scoring process for user and single job listing...');
//   // const User = (await getUser(req, res)) as User;
//   const jobListing = (await getJobListing(req, res)) as JobListing;

//   if (!User || !jobListing)
//     return sendNotFoundError(res, '[score/single-job] User or JobListing not found');

//   // @ts-expect-error TODO: Fix type definition - bio_embedding may not exist on User yet
//   const userEmbedding = User.bio_embedding;
//   // @ts-expect-error TODO: Fix type definition - description_embedding may not exist on jobListing yet
//   const jobEmbedding = jobListing.description_embedding;
//   const cosineScore = cosineSimilarity(userEmbedding, jobEmbedding);

//   return res.json({ User, jobListing, cosineScore });
// });

// TODO: parallelize so that multiple can be processed at once (maybe 3?)
scoreRouter.post('/batch/:alias', async (req, res) => {
  // const response = {
  //   ok: false,
  // };
  log.info('[score/batch] Starting batch scoring process for user and scraped jobs...');
  const User = await getUserByAlias(req.params.alias);

  // @ts-expect-error TODO: Fix type definition - bio_embedding may not exist on User yet
  const userEmbedding = User.bio_embedding;

  const { scraped_jobs: scrapedJobs } = req.body; // verify this key is right from n8n

  if (!scrapedJobs.length) {
    // NOTE: throw error for now while in alpha, but eventually just log and move on
    // (could just be a bad day for the initial filtering done on n8n)
    // return sendBadRequestError(res, 'No scraped jobs provided for scoring');
  }

  for (const scrapedJob of scrapedJobs) {
    // parse and process job data - start with **required** columns first
    const response = transformScrapedJob(scrapedJob);
    const cleaned = response.partialJobListing;
    // generate an embedding for the processed job data description
    const jobEmbedding = await generateEmbedding(cleaned.descriptionCleaned);

    // compare the job embed with the userp embed

    // @ts-expect-error TODO: Fix type definition - description_embedding may not exist on jobListing yet
    const cosineScore = cosineSimilarity(userEmbedding, jobEmbedding);
    log.info('Cosine similarity score for job:', cleaned.title, 'is', cosineScore);
    // write jobListing to db
  }
  // respond with summary of job
  return res.json({
    message: 'batch process complete',
    score: 'todo',
  });
});

export { scoreRouter };
