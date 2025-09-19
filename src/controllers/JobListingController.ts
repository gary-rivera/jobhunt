import prisma from '../lib/prisma';
import { JobListing } from '@prisma/client';
import { Request, Response } from 'express';
import { sendBadRequestError, sendNotFoundError, sendInternalServerError } from '../utils/error';
import { LinkedInJob } from '../routes';

async function getJobListing(req: Request, res: Response): Promise<JobListing | Response> {
  try {
    const { jobId } = req.params;

    const parsedJobId = parseInt(jobId, 10);

    if (!jobId || isNaN(parsedJobId)) {
      return sendBadRequestError(res, '[JobListingController] Invalid jobId parameter.');
    }

    log.info('[JobListingController] Fetching job listing for jobId:', jobId);

    // TODO: select only necessary fields once scoring is fleshed out
    const response = (await prisma.$queryRaw`
				SELECT
					id,
					job_scrape_run_id,
					title,
					company,
					source,
					location,
					salary_range,
					listing_url,
					apply_to_url,
					description_raw,
					description_cleaned,
					array(SELECT unnest(description_embedding::real[])) as description_embedding,
					skills_found,
					seniority,
					overall_score,
					technical_match,
					experience_match,
					industry_match,
					scraped_at,
					created_at
				FROM job_listings
				WHERE id = ${parsedJobId}
			`) as JobListing[];

    const job: JobListing | null = response[0] || null;

    if (!job) return sendNotFoundError(res, '[JobListingController] Job listing not found');

    log.success('[JobListingController] Fetched job listing successfully');
    return job;
  } catch (err) {
    log.error('Error fetching job listing:', err);
    return sendInternalServerError(res);
  }
}

// parse and process job data - start with **required** columns
function cleanupScrapedJob(scrapedJob: LinkedInJob) {
  // static, 1:1
  const {
    location,
    company_name: company, // maps to company in db
    job_title: title, // maps to title in db
    job_url: listingUrl, // maps to listing_url in db
    job_description: descriptionRaw, // maps to description_raw in db
    // 'time_posted',
    // 'apply_url', // maps to 'apply_to_url' in db
    // 'time_posted',
    // 'num_applicants',
    // 'salary_range',
    // 'job_id' // as source_id,
    // 'job_function',
    // 'seniority_level,
    // 'industries,
  } = scrapedJob;

  // dynamic values
  const descriptionCleaned = descriptionRaw?.replace(/\s*Show more\s*Show less\s*$/i, '').trim();
  const skillsFound = ['foo', 'bar', 'baz'];
  // TODO: applicants, salary <<<-- NOTE: NOT REQUIRED YET

  return {
    requirementsMet: !!descriptionCleaned.length, // TODO:  refactor to assert more values; for now just description is technically required for scoring
    generated: {
      location,
      company,
      title,
      listingUrl,
      descriptionRaw,
      descriptionCleaned,
      skillsFound,
    },
  };
}

export { getJobListing, cleanupScrapedJob };
