import { readFileSync } from 'fs';
import { join } from 'path';
import { parseMosaicJobs } from './parser';
import { extractIndeedJob, salaryMidpointUsd } from './extract';
import type { RawListing } from '../types';

const searchHtml = readFileSync(join(__dirname, 'fixtures', 'search-page.html'), 'utf-8');

describe('parseMosaicJobs', () => {
  it('extracts the job-card array from the embedded mosaic JSON', () => {
    const jobs = parseMosaicJobs(searchHtml);
    expect(jobs.length).toBeGreaterThan(10);
    for (const j of jobs) {
      expect(j.jobkey).toMatch(/^[a-z0-9]{16}$/);
    }
  });

  it('skips the placeholder template card', () => {
    const jobs = parseMosaicJobs(searchHtml);
    expect(jobs.some((j) => j.jobkey === '890abcdef0123456')).toBe(false);
  });

  it('returns an empty array when no mosaic block is present', () => {
    expect(parseMosaicJobs('<html><body>no mosaic here</body></html>')).toEqual([]);
  });
});

describe('salaryMidpointUsd', () => {
  it('returns null when neither min nor max is present', () => {
    expect(salaryMidpointUsd(undefined)).toBeNull();
    expect(salaryMidpointUsd({})).toBeNull();
  });

  it('passes through YEARLY salary midpoint', () => {
    expect(salaryMidpointUsd({ min: 140_000, max: 180_000, type: 'YEARLY' })).toBe(160_000);
  });

  it('annualizes HOURLY rates (2080 hr/yr)', () => {
    expect(salaryMidpointUsd({ min: 50, max: 60, type: 'HOURLY' })).toBe(50 * 2080 / 2 + 60 * 2080 / 2);
  });

  it('annualizes MONTHLY rates (12 mo/yr)', () => {
    expect(salaryMidpointUsd({ min: 8_000, max: 10_000, type: 'MONTHLY' })).toBe(108_000);
  });

  it('uses the single endpoint when only one bound is provided', () => {
    expect(salaryMidpointUsd({ min: 70, type: 'HOURLY' })).toBe(70 * 2080);
    expect(salaryMidpointUsd({ max: 200_000, type: 'YEARLY' })).toBe(200_000);
  });
});

describe('extractIndeedJob', () => {
  it('extracts a first real fixture job end-to-end', async () => {
    const jobs = parseMosaicJobs(searchHtml);
    const job = jobs[0];
    const raw: RawListing = {
      sourceJobId: job.jobkey,
      sourceUrl: `https://www.indeed.com/viewjob?jk=${job.jobkey}`,
      payload: { mosaicJob: job },
    };

    const ext = await extractIndeedJob(raw);
    expect(ext.sourceJobId).toBe(job.jobkey);
    expect(ext.sourceUrl).toBe(`https://www.indeed.com/viewjob?jk=${job.jobkey}`);
    expect(ext.title.length).toBeGreaterThan(0);
    expect(ext.company.length).toBeGreaterThan(0);
    expect(ext.location.length).toBeGreaterThan(0);
    expect(ext.descriptionCleaned).not.toMatch(/<[^>]+>/);
    expect(ext.totalApplicants).toBeNull();
  });

  it('produces a Date from epoch-ms pubDate', async () => {
    const raw: RawListing = {
      sourceJobId: 'aaaaaaaaaaaaaaaa',
      sourceUrl: 'https://www.indeed.com/viewjob?jk=aaaaaaaaaaaaaaaa',
      payload: {
        mosaicJob: {
          jobkey: 'aaaaaaaaaaaaaaaa',
          title: 'X',
          company: 'Y',
          formattedLocation: 'Remote',
          snippet: '<p>desc</p>',
          pubDate: 1_700_000_000_000,
        },
      },
    };
    const ext = await extractIndeedJob(raw);
    expect(ext.postedAt).toBeInstanceOf(Date);
    expect(ext.postedAt?.getTime()).toBe(1_700_000_000_000);
  });

  it('falls back to "Remote" when location is empty but remoteLocation is true', async () => {
    const raw: RawListing = {
      sourceJobId: 'bbbbbbbbbbbbbbbb',
      sourceUrl: 'https://www.indeed.com/viewjob?jk=bbbbbbbbbbbbbbbb',
      payload: {
        mosaicJob: {
          jobkey: 'bbbbbbbbbbbbbbbb',
          title: 'X',
          company: 'Y',
          remoteLocation: true,
          snippet: '<p>d</p>',
        },
      },
    };
    const ext = await extractIndeedJob(raw);
    expect(ext.location).toBe('Remote');
  });
});
