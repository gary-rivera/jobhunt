import request from 'supertest';
import app from '../app';
import prisma from '../lib/prisma';
import { computeDedupeKey } from '../pipeline/dedupe';

const TEST_PREFIX = 'runs-test-';

async function seedRunWithListings(opts: {
  source: 'BUILT_IN' | 'WTTJ' | 'LINKEDIN_APIFY' | 'INDEED';
  listings: Array<{ sourceJobId: string; title: string; company: string; location: string; score: number | null }>;
}) {
  const run = await prisma.jobScrapeRun.create({
    data: { source: opts.source, status: 'COMPLETED', completedAt: new Date() },
  });

  for (const l of opts.listings) {
    await prisma.jobListing.create({
      data: {
        source: opts.source,
        sourceJobId: l.sourceJobId,
        dedupeKey: computeDedupeKey(l.title, l.company, l.location),
        title: l.title,
        company: l.company,
        location: l.location,
        listingUrl: `https://x/${l.sourceJobId}`,
        applyToUrl: null,
        salaryMidpointUsd: null,
        totalApplicants: null,
        descriptionRaw: 'desc',
        descriptionCleaned: 'desc',
        descriptionEmbedding: Array(768).fill(0.1),
        score: l.score,
        scrapedAt: new Date(),
        jobScrapeRunId: run.id,
      },
    });
  }

  return run;
}

describe('GET /runs/:id/listings', () => {
  const createdRunIds: number[] = [];

  beforeEach(async () => {
    await prisma.jobListing.deleteMany({ where: { sourceJobId: { startsWith: TEST_PREFIX } } });
  });

  afterAll(async () => {
    await prisma.jobListing.deleteMany({ where: { sourceJobId: { startsWith: TEST_PREFIX } } });
    if (createdRunIds.length > 0) {
      await prisma.jobScrapeRun.deleteMany({ where: { id: { in: createdRunIds } } });
    }
    await prisma.$disconnect();
  });

  it('returns listings for a run, sorted by score desc', async () => {
    const run = await seedRunWithListings({
      source: 'BUILT_IN',
      listings: [
        { sourceJobId: `${TEST_PREFIX}low`, title: 'Low', company: 'A', location: 'X', score: 0.2 },
        { sourceJobId: `${TEST_PREFIX}high`, title: 'High', company: 'B', location: 'Y', score: 0.9 },
        { sourceJobId: `${TEST_PREFIX}mid`, title: 'Mid', company: 'C', location: 'Z', score: 0.5 },
      ],
    });
    createdRunIds.push(run.id);

    const res = await request(app).get(`/runs/${run.id}/listings`).expect(200);

    expect(res.body.runId).toBe(run.id);
    expect(res.body.count).toBe(3);
    const scores = (res.body.listings as Array<{ score: number }>).map((l) => l.score);
    expect(scores).toEqual([0.9, 0.5, 0.2]);
  });

  it('only returns listings linked to the given run', async () => {
    const runA = await seedRunWithListings({
      source: 'WTTJ',
      listings: [{ sourceJobId: `${TEST_PREFIX}a1`, title: 'A', company: 'A', location: 'A', score: 0.5 }],
    });
    const runB = await seedRunWithListings({
      source: 'WTTJ',
      listings: [
        { sourceJobId: `${TEST_PREFIX}b1`, title: 'B1', company: 'B', location: 'B', score: 0.5 },
        { sourceJobId: `${TEST_PREFIX}b2`, title: 'B2', company: 'B', location: 'B', score: 0.4 },
      ],
    });
    createdRunIds.push(runA.id, runB.id);

    const res = await request(app).get(`/runs/${runB.id}/listings`).expect(200);

    expect(res.body.count).toBe(2);
    const ids = (res.body.listings as Array<{ sourceJobId: string }>).map((l) => l.sourceJobId);
    expect(ids).toEqual([`${TEST_PREFIX}b1`, `${TEST_PREFIX}b2`]);
  });

  it('respects the limit query param', async () => {
    const run = await seedRunWithListings({
      source: 'INDEED',
      listings: [
        { sourceJobId: `${TEST_PREFIX}1`, title: '1', company: 'A', location: 'X', score: 0.9 },
        { sourceJobId: `${TEST_PREFIX}2`, title: '2', company: 'B', location: 'Y', score: 0.8 },
        { sourceJobId: `${TEST_PREFIX}3`, title: '3', company: 'C', location: 'Z', score: 0.7 },
      ],
    });
    createdRunIds.push(run.id);

    const res = await request(app).get(`/runs/${run.id}/listings?limit=2`).expect(200);

    expect(res.body.count).toBe(2);
  });

  it('returns 404 for an unknown run id', async () => {
    const res = await request(app).get('/runs/999999999/listings').expect(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('rejects a non-numeric run id', async () => {
    await request(app).get('/runs/abc/listings').expect(400);
  });
});
