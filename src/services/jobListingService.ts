import prisma from '../lib/prisma';
import { JobListing } from '@prisma/client';
import { normalizeSalaryRange } from '../utils/jobs';
import { parseISODateString, parseRelativeTime } from '../utils/time';
import { validateRequiredFields } from '../utils/validation';
import { ValidationError, NotFoundError } from '../lib/errors';

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

interface ScrapedJobParsingResult {
  requirementsMet: boolean;
  partialJobListing: Omit<JobListing, 'id' | 'createdAt' | 'updatedAt' | 'descriptionEmbedding' | 'score'>;
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

  const jobListing = await prisma.jobListing.findUnique({
    where: { id: parsedJobId },
  });

  if (!jobListing) {
    throw new NotFoundError('job listing resource not found');
  }

  log.success('[getJobListing] Found job listing');
  return jobListing;
}

// given a scraped job from LinkedIn, parse and generate a partial JobListing object
function transformScrapedJob(scrapedJob: LinkedInJob): ScrapedJobParsingResult {
  log.info('[transformScrapedJob] transforming externally scraped job');
  const {
    job_description: descriptionRaw,
    salary_range: salaryRange,
    num_applicants: numApplicantsStr,
    scraped_at: scrapedAtISOString,
    time_posted: timePosted,
    // skills_found: skillsFound, // TODO: extract from description using NLP
  } = scrapedJob;

  const descriptionCleaned = descriptionRaw?.replace(/\s*Show more\s*Show less\s*$/i, '').trim();

  const normalizedSalary = normalizeSalaryRange(salaryRange);
  const salaryMidpointUsd = normalizedSalary?.midpoint || null;

  const parsedApplicants: number | null = parseInt(numApplicantsStr.replace(/\D/g, ''), 10);
  const totalApplicants = isNaN(parsedApplicants) ? null : parsedApplicants;

  const scrapedAt = parseISODateString(scrapedAtISOString);
  const postedAt = parseRelativeTime(timePosted);

  const partialJobListing = {
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

  const { requirementsMet, missing } = validateRequiredFields(partialJobListing);
  if (!requirementsMet) {
    log.error('[parseScrapedJob] Failed to parse required fields: ', missing);
  }

  return {
    requirementsMet,
    partialJobListing,
  };
}

export { getJobListing, transformScrapedJob };
