import Router from 'express';
import { UserProfile, JobListing } from '@prisma/client';
import { getUser } from '../controllers/UserProfileController';
import { getJobListing } from '../controllers/JobListingController';
import { sendNotFoundError } from '../utils/error';
import { cosineSimilarity } from '../utils/scoring';

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

scoreRouter.get('/single-job/:alias/:jobId', async (req, res) => {
  log.info('[score/single-job] Starting scoring process for user and single job listing...');
  const userProfile = (await getUser(req, res)) as UserProfile;
  const jobListing = (await getJobListing(req, res)) as JobListing;

  if (!userProfile || !jobListing)
    return sendNotFoundError(res, 'UserProfile or JobListing not found');
    return sendNotFoundError(res, '[score/single-job] UserProfile or JobListing not found');

  // @ts-expect-error TODO: Fix type definition - bio_embedding may not exist on userProfile yet
  const userEmbedding = userProfile.bio_embedding;
  // @ts-expect-error TODO: Fix type definition - description_embedding may not exist on jobListing yet
  const jobEmbedding = jobListing.description_embedding;
  const cosineScore = cosineSimilarity(userEmbedding, jobEmbedding);

  return res.json({ userProfile, jobListing, cosineScore });
});

export { scoreRouter };
