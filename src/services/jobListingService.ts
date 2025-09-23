import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { ValidationError, NotFoundError } from '../lib/errors';
import { generateEmbedding } from './ollama';

import { JobListing } from '@prisma/client';
import { normalizeSalaryRange } from '../utils/jobs';
import { parseISODateString, parseRelativeTime } from '../utils/time';
import { validateRequiredFields } from '../utils/validation';

export interface LinkedInJob {
  job_id: string;
  company_name: string;
  job_url: string;
  apply_url: string;
  company_url: string;
  job_title: string;
  location: string;
  time_posted: string;
  num_applicants: string;
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
  scraped_at: string;
}

async function getJobListing(jobId: string): Promise<JobListing> {
  log.info('[getJobListing] job listing fetch invoked');

  if (!jobId) {
    throw new ValidationError('Job ID missing');
  }
  const parsedJobId = parseInt(jobId, 10);

  if (!jobId || isNaN(parsedJobId)) {
    throw new ValidationError('Invalid Job ID parameter');
  }

  log.info('[getJobListing] Fetching job listing for jobId:', jobId);

  const jobListing = await prisma.jobListing.findUniqueOrThrow({
    where: { id: parsedJobId },
  });

  if (!jobListing) {
    throw new NotFoundError('job listing resource not found');
  }

  log.success('[getJobListing] Found job listing');
  return jobListing;
}

// TODO: add try catch, akin to ollama service
// given a scraped job from LinkedIn, parse and generate a partial JobListing object
function transformScrapedJob(scrapedJob: LinkedInJob): Prisma.JobListingCreateInput {
  log.info('[transformScrapedJob] transforming externally scraped job');
  const {
    job_id: externalJobId,
    job_description: descriptionRaw,
    salary_range: salaryRange,
    num_applicants: numApplicantsStr,
    scraped_at: scrapedAtISOString,
    time_posted: timePosted,
    // skills_found: skillsFound, // TODO: extract from description using NLP
  } = scrapedJob;

  if (!descriptionRaw || !salaryRange || !numApplicantsStr) {
    log.warn('[transformScrapedJob] missing essential field(s) from external job listing id: ', externalJobId);
  }

  const descriptionCleaned = descriptionRaw?.replace(/\s*Show more\s*Show less\s*$/i, '').trim();

  const normalizedSalary = normalizeSalaryRange(salaryRange);
  const salaryMidpointUsd = normalizedSalary?.midpoint || null;

  const parsedApplicants: number | null = parseInt(numApplicantsStr.replace(/\D/g, ''), 10);
  const totalApplicants = isNaN(parsedApplicants) ? null : parsedApplicants;

  const scrapedAt = parseISODateString(scrapedAtISOString);
  const postedAt = parseRelativeTime(timePosted);

  const partialJobListing = {
    externalId: `n8n/linkedin-${externalJobId}`,
    title: scrapedJob.job_title,
    company: scrapedJob.company_name,
    location: scrapedJob.location,
    listingUrl: scrapedJob.job_url,
    applyToUrl: scrapedJob.apply_url,

    salaryMidpointUsd,
    totalApplicants,

    descriptionRaw,
    descriptionCleaned,
    postedAt,
    scrapedAt,
  };

  return partialJobListing;
}

async function processScrapedJob(scrapedJob: LinkedInJob): Promise<Prisma.JobListingCreateInput> {
  const transformed = transformScrapedJob(scrapedJob);
  const descriptionEmbedding = await generateEmbedding(transformed.descriptionCleaned);

  return {
    ...transformed,
    descriptionEmbedding,
  };
}

async function saveJobListing(jobListing: Prisma.JobListingCreateInput) {
  const { valid, missing } = validateRequiredFields(jobListing, 'JobListing');
  if (!valid) {
    log.error('[saveJobListing] refused to create job listing. Missing the following fields: ', missing);
    throw new ValidationError('Cannot save job listing as its missing required fields');
  }
  return await prisma.jobListing.create({
    data: jobListing,
  });
}

async function processAndSaveJob(job: LinkedInJob): Promise<JobListing> {
  const processed = await processScrapedJob(job);
  return await saveJobListing(processed);
}

export { getJobListing, transformScrapedJob, processScrapedJob, saveJobListing, processAndSaveJob };
