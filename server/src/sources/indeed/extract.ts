import { ExtractedJob, RawListing } from '../types';
import { cleanDescription } from '../../utils/html';
import { IndeedMosaicJob, IndeedSalary, viewJobUrl } from './parser';

// Conversion factors to annualize non-yearly salary figures.
const HOURS_PER_YEAR = 2080; // 40 * 52
const WEEKS_PER_YEAR = 52;
const MONTHS_PER_YEAR = 12;
const WORK_DAYS_PER_YEAR = 260; // 5 * 52

function annualize(value: number, type: IndeedSalary['type']): number {
  switch (type) {
    case 'YEARLY':
      return value;
    case 'HOURLY':
      return value * HOURS_PER_YEAR;
    case 'MONTHLY':
      return value * MONTHS_PER_YEAR;
    case 'WEEKLY':
      return value * WEEKS_PER_YEAR;
    case 'DAILY':
      return value * WORK_DAYS_PER_YEAR;
    default:
      return value;
  }
}

export function salaryMidpointUsd(salary?: IndeedSalary): number | null {
  if (!salary) return null;
  const { min, max, type } = salary;
  if (typeof min !== 'number' && typeof max !== 'number') return null;
  const lo = typeof min === 'number' ? annualize(min, type) : null;
  const hi = typeof max === 'number' ? annualize(max, type) : null;
  if (lo !== null && hi !== null) return Math.round((lo + hi) / 2);
  return Math.round((lo ?? hi) as number);
}

function pickLocation(job: IndeedMosaicJob): string {
  if (job.formattedLocation && job.formattedLocation.length > 0) return job.formattedLocation;
  if (job.remoteLocation) return 'Remote';
  return '';
}

function pickPostedAt(job: IndeedMosaicJob): Date | null {
  const epoch = job.pubDate ?? job.createDate;
  if (typeof epoch !== 'number' || epoch <= 0) return null;
  return new Date(epoch);
}

interface IndeedPayload {
  mosaicJob: IndeedMosaicJob;
}

export async function extractIndeedJob(raw: RawListing): Promise<ExtractedJob> {
  const { mosaicJob } = raw.payload as IndeedPayload;

  const title = mosaicJob.title || mosaicJob.displayTitle || '';
  const company = mosaicJob.company || mosaicJob.companyName || '';
  const descriptionRaw = mosaicJob.snippet || '';
  const sourceUrl = viewJobUrl(mosaicJob.jobkey);

  return {
    sourceJobId: mosaicJob.jobkey,
    sourceUrl,
    title,
    company,
    location: pickLocation(mosaicJob),
    applyUrl: sourceUrl,
    salaryMidpointUsd: salaryMidpointUsd(mosaicJob.extractedSalary),
    totalApplicants: null,
    postedAt: pickPostedAt(mosaicJob),
    descriptionRaw,
    descriptionCleaned: cleanDescription(descriptionRaw),
  };
}
