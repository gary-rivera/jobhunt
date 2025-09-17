import Router from 'express';
import { UserProfile, JobListing } from '@prisma/client';
import { getUser } from '../controllers/UserProfileController';
import { getJobListing } from '../controllers/JobListingController';
import { sendNotFoundError } from '../utils/error';
import { cosineSimilarity } from '../utils/scoring';

const scoreRouter = Router();

scoreRouter.get('/single-job/:alias/:jobId', async (req, res) => {
  const userProfile = (await getUser(req, res)) as UserProfile;
  const jobListing = (await getJobListing(req, res)) as JobListing;

  if (!userProfile || !jobListing)
    return sendNotFoundError(res, 'UserProfile or JobListing not found');

  // @ts-ignore
  const userEmbedding = userProfile.bio_embedding;
  // @ts-ignore
  const jobEmbedding = jobListing.description_embedding;
  const cosineScore = cosineSimilarity(userEmbedding, jobEmbedding);
  return res.json({ userProfile, jobListing, cosineScore });
});

export { scoreRouter };
