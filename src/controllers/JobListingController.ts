import prisma from '../lib/prisma';
import { JobListing } from '@prisma/client';
import { Request, Response } from 'express';
import { sendBadRequestError, sendNotFoundError, sendInternalServerError } from '../utils/error';

async function getJobListing(req: Request, res: Response): Promise<JobListing | Response> {
  try {
    const { jobId } = req.params;
    const parsedJobId = parseInt(jobId, 10);

    if (!jobId || isNaN(parsedJobId)) {
      return sendBadRequestError(res, 'Invalid jobId parameter');
    }

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

    if (!job) return sendNotFoundError(res, 'Job listing not found');

    return job;
  } catch (err) {
    log.error('Error fetching job listing:', err);
    return sendInternalServerError(res);
  }
}

export { getJobListing };
