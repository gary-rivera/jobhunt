jest.mock('../services/ollama', () => ({
  generateEmbedding: jest.fn(async () => Array(768).fill(0.1)),
}));
jest.mock('../services/userService', () => ({
  getUserByAlias: jest.fn(async () => ({
    id: 1,
    alias: 'test',
    bio: 'bio',
    bioEmbedding: Array(768).fill(0.1),
    createdAt: new Date(),
    updatedAt: new Date(),
  })),
}));

import { runSource } from './run';
import { __replaceAdapterForTest } from '../sources/registry';
import { SourceAdapter, RawListing, ExtractedJob } from '../sources/types';
import * as runService from '../services/jobScrapeRunService';
import prisma from '../lib/prisma';

function makeAdapter(opts: {
  raws: RawListing[];
  extract?: (raw: RawListing) => Promise<ExtractedJob>;
}): SourceAdapter {
  return {
    id: 'wttj',
    fetch: async () => opts.raws,
    extract:
      opts.extract ??
      (async (raw) => ({
        sourceJobId: raw.sourceJobId,
        sourceUrl: raw.sourceUrl,
        title: 'Test Title',
        company: 'Test Co',
        location: 'Remote',
        applyUrl: null,
        salaryMidpointUsd: null,
        totalApplicants: null,
        postedAt: null,
        descriptionRaw: 'desc',
        descriptionCleaned: 'desc',
      })),
  };
}

async function cleanup() {
  await prisma.jobListing.deleteMany({
    where: { source: 'WTTJ', sourceJobId: { startsWith: 'pipeline-test-' } },
  });
  await prisma.jobScrapeRun.deleteMany({
    where: {
      source: 'WTTJ',
      OR: [
        { errorMessage: { contains: 'pipeline-test' } },
        { errorMessage: { contains: 'upstream down' } },
        { status: 'COMPLETED', totalSaved: { gte: 0 } },
      ],
    },
  });
}

describe('pipeline.runSource', () => {
  beforeEach(cleanup);

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('saves new listings and marks the run COMPLETED', async () => {
    const adapter = makeAdapter({
      raws: [
        { sourceJobId: 'pipeline-test-1', sourceUrl: 'https://x/1', payload: {} },
        { sourceJobId: 'pipeline-test-2', sourceUrl: 'https://x/2', payload: {} },
      ],
    });
    __replaceAdapterForTest(adapter);

    const run = await runService.createRun('WTTJ');
    await runSource(run.id, 'wttj', { query: 'test' });

    const updated = await runService.getRun(run.id);
    expect(updated?.status).toBe('COMPLETED');
    expect(updated?.totalSaved).toBe(2);
    expect(updated?.totalSkipped).toBe(0);
    expect(updated?.totalFailed).toBe(0);

    const saved = await prisma.jobListing.findMany({
      where: { source: 'WTTJ', sourceJobId: { startsWith: 'pipeline-test-' } },
    });
    expect(saved).toHaveLength(2);
    expect(saved[0].dedupeKey).toMatch(/^[a-f0-9]{64}$/);
    expect(saved[0].jobScrapeRunId).toBe(run.id);
  });

  it('skips intra-source duplicates without embedding them', async () => {
    const adapter = makeAdapter({
      raws: [{ sourceJobId: 'pipeline-test-dup', sourceUrl: 'https://x/dup', payload: {} }],
    });
    __replaceAdapterForTest(adapter);

    const r1 = await runService.createRun('WTTJ');
    await runSource(r1.id, 'wttj', { query: 'test' });

    const ollama = await import('../services/ollama');
    const callsAfterFirst = (ollama.generateEmbedding as jest.Mock).mock.calls.length;

    const r2 = await runService.createRun('WTTJ');
    await runSource(r2.id, 'wttj', { query: 'test' });

    const updated = await runService.getRun(r2.id);
    expect(updated?.totalSkipped).toBe(1);
    expect(updated?.totalSaved).toBe(0);

    // generateEmbedding should not have been called again for the duplicate
    expect((ollama.generateEmbedding as jest.Mock).mock.calls.length).toBe(callsAfterFirst);
  });

  it('counts failed extractions and continues the run', async () => {
    const adapter = makeAdapter({
      raws: [
        { sourceJobId: 'pipeline-test-ok', sourceUrl: 'https://x/ok', payload: {} },
        { sourceJobId: 'pipeline-test-bad', sourceUrl: 'https://x/bad', payload: {} },
      ],
      extract: async (raw) => {
        if (raw.sourceJobId === 'pipeline-test-bad') throw new Error('boom');
        return {
          sourceJobId: raw.sourceJobId,
          sourceUrl: raw.sourceUrl,
          title: 't',
          company: 'c',
          location: 'Remote',
          applyUrl: null,
          salaryMidpointUsd: null,
          totalApplicants: null,
          postedAt: null,
          descriptionRaw: 'd',
          descriptionCleaned: 'd',
        };
      },
    });
    __replaceAdapterForTest(adapter);

    const run = await runService.createRun('WTTJ');
    await runSource(run.id, 'wttj', { query: 'test' });

    const updated = await runService.getRun(run.id);
    expect(updated?.status).toBe('COMPLETED');
    expect(updated?.totalSaved).toBe(1);
    expect(updated?.totalFailed).toBe(1);
  });

  it('skips listings whose location is not in the allowlist', async () => {
    const adapter = makeAdapter({
      raws: [
        { sourceJobId: 'pipeline-test-sf', sourceUrl: 'https://x/sf', payload: {} },
        { sourceJobId: 'pipeline-test-nyc', sourceUrl: 'https://x/nyc', payload: {} },
        { sourceJobId: 'pipeline-test-remote', sourceUrl: 'https://x/remote', payload: {} },
      ],
      extract: async (raw) => {
        const loc =
          raw.sourceJobId === 'pipeline-test-sf'
            ? 'San Francisco, CA'
            : raw.sourceJobId === 'pipeline-test-nyc'
              ? 'New York, NY'
              : 'Remote';
        return {
          sourceJobId: raw.sourceJobId,
          sourceUrl: raw.sourceUrl,
          title: 't',
          company: 'c',
          location: loc,
          applyUrl: null,
          salaryMidpointUsd: null,
          totalApplicants: null,
          postedAt: null,
          descriptionRaw: 'd',
          descriptionCleaned: 'd',
        };
      },
    });
    __replaceAdapterForTest(adapter);

    const run = await runService.createRun('WTTJ');
    await runSource(run.id, 'wttj', { query: 'test' });

    const updated = await runService.getRun(run.id);
    expect(updated?.status).toBe('COMPLETED');
    expect(updated?.totalExtracted).toBe(3);
    expect(updated?.totalSaved).toBe(2);
    expect(updated?.totalSkipped).toBe(1);
    expect(updated?.totalFailed).toBe(0);

    const saved = await prisma.jobListing.findMany({
      where: { source: 'WTTJ', sourceJobId: { startsWith: 'pipeline-test-' } },
      select: { sourceJobId: true, location: true },
    });
    const ids = saved.map((s) => s.sourceJobId).sort();
    expect(ids).toEqual(['pipeline-test-remote', 'pipeline-test-sf']);
  });

  it('marks the run FAILED if adapter.fetch throws', async () => {
    const adapter: SourceAdapter = {
      id: 'wttj',
      fetch: async () => {
        throw new Error('upstream down');
      },
      extract: async () => {
        throw new Error('should not reach');
      },
    };
    __replaceAdapterForTest(adapter);

    const run = await runService.createRun('WTTJ');
    await expect(runSource(run.id, 'wttj', { query: 'test' })).rejects.toThrow('upstream down');

    const updated = await runService.getRun(run.id);
    expect(updated?.status).toBe('FAILED');
    expect(updated?.errorMessage).toContain('upstream down');
  });
});
