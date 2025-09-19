import express from 'express';
import prisma from '../lib/prisma';
import lodash from 'lodash';
import { getJobListing } from '../controllers/JobListingController';
import { generateEmbedding } from '../services/ollama';
import { normalizeSalaryRange } from '../utils/jobs';

const jobRouter = express.Router();

export interface LinkedInJob {
  job_id: string;
  company_name: string;
  job_url: string;
  apply_url: string;
  company_url: string;
  job_title: string;
  location: string;
  time_posted: string;
  num_applicants: string; // lazy parse to number later
  job_description: string;
  seniority_level:
    | 'Not Applicable'
    | 'Internship'
    | 'Entry level'
    | 'Associate'
    | 'Mid-Senior level'
    | 'Director'
    | 'Executive';
  job_function: string;
  industries: string;
  employment_type: string;
  salary_range?: string;
}

interface JobScoringCriteria
  extends Pick<
    LinkedInJob,
    'job_title' | 'location' | 'time_posted' | 'seniority_level' | 'industries' | 'employment_type'
  > {
  job_description_cleaned: string;
  salary: number | null; // average midpoint of min and max salary
  applicants: number | null;
}

jobRouter.get('/:jobId', getJobListing);

jobRouter.post('/embed', async (req, res) => {
  // parse job listing and run details from body
  const { job }: { job: LinkedInJob } = req.body;

  if (!job || !job.job_description || !job.num_applicants)
    return res.status(400).json({ error: 'Invalid job listing' });

  // cleanup and normalize fields
  let applicantsCount: number | null = parseInt(job.num_applicants.replace(/\D/g, ''), 10);
  applicantsCount = isNaN(applicantsCount) ? null : applicantsCount;

  const normalizedSalary = normalizeSalaryRange(job.salary_range);
  const salaryMidrange = normalizedSalary?.midpoint || null;

  // TODO: further cleaning -> salary range, disclaimer texts,
  const cleanedDescription = job.job_description.replace(/\s*Show more\s*Show less\s*$/i, '').trim();

  // pick fields relevant for scoring
  const scoringCriteria = lodash.pick(job, [
    'job_title',
    'location',
    'time_posted',
    'seniority_level',
    'industries', // 'Financial Services' is my industry matchup
  ]) as JobScoringCriteria;

  scoringCriteria.applicants = applicantsCount;
  scoringCriteria.salary = salaryMidrange;
  scoringCriteria.job_description_cleaned = cleanedDescription;

  // console.log('scoringCriteria', scoringCriteria);

  // generate embedding for the job description
  const jobEmbedding = await generateEmbedding(cleanedDescription);
  // const jobEmbedding = response?.embeddings[0] || null;
  const { job_id, job_title, company_name, job_url, job_description } = job;

  const newJobListing = await prisma.$executeRaw`
    INSERT INTO job_listings (
      id,
      job_scrape_run_id,
      title,
      company,
      listing_url,
      description_raw,
      description_cleaned,
      description_embedding,
      skills_found
    )
    VALUES (
      ${1},
      ${'random_job_scrape_run_id'},
      ${job_title},
      ${company_name},
      ${job_url},
      ${job_description},
      ${cleanedDescription},
      ${jobEmbedding},
      ${['foo', 'bar']}
    );
  `;

  log.info('Inserted new job listing:', job_id);
  return res.status(201).json({ jobListing: newJobListing, jobId: job_id });
});

export { jobRouter };
