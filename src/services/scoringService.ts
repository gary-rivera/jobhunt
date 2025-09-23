import { User, Prisma } from '@prisma/client';
import { LinkedInJob, processScrapedJob, saveJobListing } from '../services/jobListingService';
import { cosineSimilarity } from '../utils/scoring';

function generateJobListingToUserSimilarityScore(jobListing: Prisma.JobListingCreateInput, user: User) {
  const userBioEmbedding = user.bioEmbedding;
  const jdEmbedding = jobListing.descriptionEmbedding as number[];

  return cosineSimilarity(userBioEmbedding, jdEmbedding);
}

async function processScoring(user: User, scrapedJob: LinkedInJob) {
  const transformed = await processScrapedJob(scrapedJob);

  const similarityScore = generateJobListingToUserSimilarityScore(transformed, user);

  const newJobListing = await saveJobListing({ ...transformed, score: similarityScore });
  log.info(
    `[scoringService][processScoring] user ${user.alias} scored simliarity of ${similarityScore} to job ${newJobListing.id}\n`,
  );

  return {
    jobListing: newJobListing,
    similarityScore,
  };
}

// batch processing of multiple jobs to a user bio
export { generateJobListingToUserSimilarityScore, processScoring };
