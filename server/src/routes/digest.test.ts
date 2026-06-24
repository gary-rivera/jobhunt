jest.mock('../services/ollama', () => ({
  generateEmbedding: jest.fn(async () => Array(768).fill(0.1)),
}));

import request from 'supertest';
import app from '../app';
import prisma from '../lib/prisma';
import { computeDedupeKey } from '../pipeline/dedupe';

const TEST_PREFIX = 'digest-test-';

async function seedListing(opts: {
  source: 'BUILT_IN' | 'WTTJ' | 'LINKEDIN_APIFY';
  sourceJobId: string;
  title: string;
  company: string;
  location: string;
  score: number;
  dedupeKey?: string | null;
}) {
  const dedupeKey =
    opts.dedupeKey === null
      ? null
      : opts.dedupeKey ?? computeDedupeKey(opts.title, opts.company, opts.location);
  return prisma.jobListing.create({
    data: {
      source: opts.source,
      sourceJobId: opts.sourceJobId,
      dedupeKey,
      title: opts.title,
      company: opts.company,
      location: opts.location,
      listingUrl: `https://x/${opts.sourceJobId}`,
      applyToUrl: null,
      salaryMidpointUsd: null,
      totalApplicants: null,
      descriptionRaw: 'desc',
      descriptionCleaned: 'desc',
      descriptionEmbedding: Array(768).fill(0.1),
      score: opts.score,
      scrapedAt: new Date(),
    },
  });
}

describe('GET /digest/today — cross-source dedupe', () => {
  beforeEach(async () => {
    await prisma.jobListing.deleteMany({ where: { sourceJobId: { startsWith: TEST_PREFIX } } });
  });
  afterAll(async () => {
    await prisma.jobListing.deleteMany({ where: { sourceJobId: { startsWith: TEST_PREFIX } } });
    await prisma.$disconnect();
  });

  it('collapses two same-day rows sharing dedupeKey, keeps higher score, annotates alsoSeenOn', async () => {
    await seedListing({
      source: 'BUILT_IN',
      sourceJobId: `${TEST_PREFIX}1`,
      title: 'Senior Engineer',
      company: 'Acme',
      location: 'Remote',
      score: 0.8,
    });
    await seedListing({
      source: 'LINKEDIN_APIFY',
      sourceJobId: `${TEST_PREFIX}2`,
      title: 'Senior Engineer',
      company: 'Acme',
      location: 'Remote',
      score: 0.6,
    });

    const res = await request(app).get('/digest/today?minScore=0').expect(200);
    const listings = res.body.listings as {
      sourceJobId: string;
      source: string;
      alsoSeenOn?: string[];
    }[];
    const ours = listings.filter((l) => l.sourceJobId.startsWith(TEST_PREFIX));
    expect(ours).toHaveLength(1);
    expect(ours[0].source).toBe('BUILT_IN');
    expect(ours[0].alsoSeenOn).toEqual(['LINKEDIN_APIFY']);
    expect(res.body.totals.beforeCollapse).toBeGreaterThanOrEqual(2);
    expect(res.body.totals.candidates).toBeLessThan(res.body.totals.beforeCollapse);
  });

  it('does not collapse rows with different dedupeKey', async () => {
    await seedListing({
      source: 'BUILT_IN',
      sourceJobId: `${TEST_PREFIX}u1`,
      title: 'Title A',
      company: 'Co A',
      location: 'NYC',
      score: 0.7,
    });
    await seedListing({
      source: 'WTTJ',
      sourceJobId: `${TEST_PREFIX}u2`,
      title: 'Title B',
      company: 'Co B',
      location: 'SF',
      score: 0.7,
    });
    const res = await request(app).get('/digest/today?minScore=0').expect(200);
    const ours = (res.body.listings as { sourceJobId: string }[]).filter((l) =>
      l.sourceJobId.startsWith(TEST_PREFIX),
    );
    expect(ours).toHaveLength(2);
  });

  it('passes through rows with dedupeKey = null without collapsing', async () => {
    await seedListing({
      source: 'BUILT_IN',
      sourceJobId: `${TEST_PREFIX}n1`,
      title: 'Foo',
      company: 'Bar',
      location: 'Baz',
      score: 0.7,
      dedupeKey: null,
    });
    await seedListing({
      source: 'WTTJ',
      sourceJobId: `${TEST_PREFIX}n2`,
      title: 'Foo',
      company: 'Bar',
      location: 'Baz',
      score: 0.6,
      dedupeKey: null,
    });
    const res = await request(app).get('/digest/today?minScore=0').expect(200);
    const ours = (res.body.listings as { sourceJobId: string }[]).filter((l) =>
      l.sourceJobId.startsWith(TEST_PREFIX),
    );
    expect(ours).toHaveLength(2);
  });
});
