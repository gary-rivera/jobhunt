import express from 'express';
import prisma from '../lib/prisma';
import { getJobListing, transformScrapedJob, LinkedInJob } from '../services/jobListingService';
import { generateEmbedding } from '../services/ollama';
import { ValidationError } from '../lib/errors';

const jobRouter = express.Router();

jobRouter.get('/:id', async (req, res) => {
  const { id } = req.params;
  log.info('yuurr');
  const jobListing = await getJobListing(id);
  return res.status(200).json({ jobListing });
});

jobRouter.post('/embed', async (req, res) => {
  // parse job listing and run details from body
  const { job }: { job: LinkedInJob } = req.body;

  const { requirementsMet, partialJobListing } = transformScrapedJob(job);

  if (!requirementsMet) {
    throw new ValidationError('Job listing is missing required fields');
  }

  const jobEmbedding = await generateEmbedding(partialJobListing.descriptionCleaned);

  const newJobListing = await prisma.jobListing.create({
    data: {
      ...partialJobListing,
      descriptionEmbedding: jobEmbedding,
    },
  });

  log.info('Inserted new job listing:', newJobListing.id);
  return res.status(201).json({ jobListing: newJobListing, jobId: newJobListing.id });
});

export { jobRouter };
