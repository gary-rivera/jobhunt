import express from 'express';
import { getJobListing, LinkedInJob, processAndSaveJob } from '../services/jobListingService';

const jobRouter = express.Router();

jobRouter.get('/:id', async (req, res) => {
  const { id } = req.params;
  const jobListing = await getJobListing(id);

  return res.status(200).json({ jobListing });
});

jobRouter.post('/embed', async (req, res) => {
  const { job }: { job: LinkedInJob } = req.body;

  const newJobListing = processAndSaveJob(job);

  return res.status(201).json({ jobListing: newJobListing });
});

export { jobRouter };
