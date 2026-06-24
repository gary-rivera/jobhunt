import { readFileSync } from 'fs';
import { join } from 'path';
import { transformJobPostingJsonLd, extractBuiltInJob } from './extract';
import type { RawListing } from '../types';

jest.mock('../../services/llmExtractor', () => ({
  extractWithLLM: jest.fn(async () => ({
    title: 'LLM Title',
    company: 'LLM Co',
    location: 'LLM Loc',
    descriptionRaw: '<p>LLM desc</p>',
    applyUrl: null,
    salaryMidpointUsd: null,
    postedAt: null,
  })),
}));

const detailHtml = readFileSync(
  join(__dirname, 'fixtures', 'detail-page.html'),
  'utf-8',
);

describe('transformJobPostingJsonLd', () => {
  it('maps a JobPosting JSON-LD object to ExtractedJob fields', () => {
    const jsonLd = {
      '@type': 'JobPosting',
      title: 'Senior Engineer',
      hiringOrganization: { name: 'Acme' },
      jobLocation: { address: { addressLocality: 'NYC', addressRegion: 'NY' } },
      description: '<p>Hello</p>',
      datePosted: '2026-05-15',
      identifier: { value: 'abc-123' },
      baseSalary: { value: { minValue: 140000, maxValue: 180000, unitText: 'YEAR' } },
    };
    const out = transformJobPostingJsonLd(jsonLd);
    expect(out.title).toBe('Senior Engineer');
    expect(out.company).toBe('Acme');
    expect(out.location).toContain('NYC');
    expect(out.descriptionRaw).toBe('<p>Hello</p>');
    expect(out.postedAt).toBeInstanceOf(Date);
    expect(out.salaryMidpointUsd).toBe(160000);
    expect(out.sourceJobId).toBe('abc-123');
  });

  it('returns null fields when JSON-LD is sparse', () => {
    const out = transformJobPostingJsonLd({
      '@type': 'JobPosting',
      title: 'X',
      hiringOrganization: { name: 'Y' },
      description: 'Z',
    });
    expect(out.location).toBe('');
    expect(out.postedAt).toBeNull();
    expect(out.salaryMidpointUsd).toBeNull();
    expect(out.sourceJobId).toBeNull();
  });

  it('handles jobLocation as an array of Place objects', () => {
    const out = transformJobPostingJsonLd({
      '@type': 'JobPosting',
      title: 'T',
      hiringOrganization: { name: 'C' },
      description: 'D',
      jobLocation: [
        { address: { addressLocality: 'Seattle', addressRegion: 'Washington', addressCountry: 'USA' } },
        { address: { addressLocality: 'NYC', addressRegion: 'New York' } },
      ],
    });
    expect(out.location).toContain('Seattle');
  });
});

describe('extractBuiltInJob', () => {
  it('extracts from the fixture detail-page via JSON-LD (HTML-encoded type attribute)', async () => {
    const raw: RawListing = {
      sourceJobId: 'fixture-job',
      sourceUrl: 'https://builtin.com/job/fixture',
      payload: { detailHtml, jobUrl: 'https://builtin.com/job/fixture' },
    };
    const ext = await extractBuiltInJob(raw);
    expect(ext.title.length).toBeGreaterThan(0);
    expect(ext.company.length).toBeGreaterThan(0);
    expect(ext.descriptionRaw.length).toBeGreaterThan(0);
    expect(ext.descriptionCleaned.length).toBeGreaterThan(0);
    expect(ext.descriptionCleaned).not.toMatch(/<[^>]+>/);
    expect(ext.salaryMidpointUsd).toBeGreaterThan(0);
    expect(ext.postedAt).toBeInstanceOf(Date);
    expect(ext.sourceJobId).toBe('4547017'); // identifier.value from fixture
  });

  it('falls back to LLM when JSON-LD is missing', async () => {
    const raw: RawListing = {
      sourceJobId: 'no-jsonld',
      sourceUrl: 'https://builtin.com/job/x',
      payload: {
        detailHtml: '<html><body><h1>Sr Eng</h1>no jsonld here</body></html>',
        jobUrl: 'https://x',
      },
    };
    const ext = await extractBuiltInJob(raw);
    expect(ext.title).toBe('LLM Title');
    expect(ext.company).toBe('LLM Co');
    const llm = (await import('../../services/llmExtractor')) as unknown as {
      extractWithLLM: jest.Mock;
    };
    expect(llm.extractWithLLM).toHaveBeenCalled();
  });
});
