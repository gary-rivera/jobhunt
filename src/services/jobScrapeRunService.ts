import { JobScrapeRun, JobSource, JobScrapeRunStatus, JobListing } from '@prisma/client';
import prisma from '../lib/prisma';

export interface RunTotals {
  totalFetched: number;
  totalExtracted: number;
  totalSaved: number;
  totalSkipped: number;
  totalFailed: number;
}

export async function createRun(source: JobSource): Promise<JobScrapeRun> {
  log.info('[JobScrapeRun] creating run', { source });
  return prisma.jobScrapeRun.create({
    data: { source, status: 'RUNNING' },
  });
}

export async function completeRun(id: number, totals: RunTotals): Promise<JobScrapeRun> {
  log.success('[JobScrapeRun] completed', { id, totals });
  return prisma.jobScrapeRun.update({
    where: { id },
    data: { ...totals, status: 'COMPLETED', completedAt: new Date() },
  });
}

export async function failRun(
  id: number,
  totals: Partial<RunTotals>,
  errorMessage: string,
): Promise<JobScrapeRun> {
  log.error('[JobScrapeRun] failed', { id, totals, errorMessage });
  return prisma.jobScrapeRun.update({
    where: { id },
    data: { ...totals, status: 'FAILED', completedAt: new Date(), errorMessage },
  });
}

export async function findRunningRun(source: JobSource): Promise<JobScrapeRun | null> {
  return prisma.jobScrapeRun.findFirst({
    where: { source, status: 'RUNNING' },
    orderBy: { startedAt: 'desc' },
  });
}

export function isOrphaned(run: JobScrapeRun, timeoutMinutes: number): boolean {
  const ageMs = Date.now() - run.startedAt.getTime();
  return ageMs > timeoutMinutes * 60 * 1000;
}

export async function markOrphanedFailed(run: JobScrapeRun): Promise<JobScrapeRun> {
  log.warn('[JobScrapeRun] marking orphaned run as FAILED', { id: run.id, source: run.source });
  return failRun(run.id, {}, 'orphaned by app restart or crash');
}

export async function getRun(id: number): Promise<JobScrapeRun | null> {
  return prisma.jobScrapeRun.findUnique({ where: { id } });
}

export async function listRuns(opts: { source?: JobSource; limit?: number } = {}): Promise<JobScrapeRun[]> {
  const limit = opts.limit ?? 20;
  return prisma.jobScrapeRun.findMany({
    where: opts.source ? { source: opts.source } : undefined,
    orderBy: { startedAt: 'desc' },
    take: limit,
  });
}

export type RunListing = Pick<
  JobListing,
  | 'id'
  | 'source'
  | 'sourceJobId'
  | 'dedupeKey'
  | 'title'
  | 'company'
  | 'location'
  | 'listingUrl'
  | 'applyToUrl'
  | 'salaryMidpointUsd'
  | 'score'
  | 'postedAt'
  | 'scrapedAt'
  | 'createdAt'
>;

export async function listListingsForRun(
  runId: number,
  limit = 200,
): Promise<RunListing[]> {
  return prisma.jobListing.findMany({
    where: { jobScrapeRunId: runId },
    select: {
      id: true,
      source: true,
      sourceJobId: true,
      dedupeKey: true,
      title: true,
      company: true,
      location: true,
      listingUrl: true,
      applyToUrl: true,
      salaryMidpointUsd: true,
      score: true,
      postedAt: true,
      scrapedAt: true,
      createdAt: true,
    },
    orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  });
}

export { JobScrapeRunStatus };
