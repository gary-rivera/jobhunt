import { readFileSync } from 'fs';
import { join } from 'path';
import { transformWttjHit } from './extract';
import type { AlgoliaHit, WttjJobDetail } from './client';

const algoliaFixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'algolia-response.json'), 'utf-8'),
) as { results: Array<{ hits: AlgoliaHit[] }> };

const jobDetailFixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'job-detail.json'), 'utf-8'),
) as { job: WttjJobDetail };

describe('transformWttjHit', () => {
  const hit = algoliaFixture.results[0].hits[0];
  const detail = jobDetailFixture.job;
  const listingUrl = 'https://www.welcometothejungle.com/en/companies/societe-generale/jobs/software-engineer_la-defense_SG_qxxA6pr';

  it('maps required fields from Algolia hit + job detail', () => {
    const ext = transformWttjHit(hit, detail, listingUrl);
    expect(ext.sourceJobId).toBe('4081381');
    expect(ext.sourceUrl).toBe(listingUrl);
    expect(ext.title).toBe('Software Engineer');
    expect(ext.company).toBe('Société Générale');
    expect(ext.location).toContain('La Défense');
    expect(ext.descriptionRaw.length).toBeGreaterThan(0);
    expect(ext.descriptionCleaned.length).toBeGreaterThan(0);
    expect(ext.descriptionCleaned).not.toMatch(/<[a-z]/i);
  });

  it('pulls applyUrl from job detail', () => {
    const ext = transformWttjHit(hit, detail, listingUrl);
    expect(ext.applyUrl).toBe(detail.apply_url);
  });

  it('parses postedAt to a Date when present', () => {
    const ext = transformWttjHit(hit, detail, listingUrl);
    expect(ext.postedAt).toBeInstanceOf(Date);
  });

  it('returns null applicants (WTTJ does not expose this)', () => {
    const ext = transformWttjHit(hit, detail, listingUrl);
    expect(ext.totalApplicants).toBeNull();
  });

  it('returns null salary when hit has none', () => {
    const ext = transformWttjHit(hit, detail, listingUrl);
    // Both fixture's hit and detail have salary nulls
    expect(ext.salaryMidpointUsd).toBeNull();
  });

  it('computes salary midpoint from yearly_minimum when present', () => {
    const withSalary = { ...hit, salary_yearly_minimum: 65000, salary_minimum: 60000, salary_maximum: 70000 };
    const ext = transformWttjHit(withSalary, detail, listingUrl);
    expect(ext.salaryMidpointUsd).toBe(65000);
  });

  it('falls back to (min+max)/2 if yearly_minimum is null but min and max exist', () => {
    const withMinMax = { ...hit, salary_yearly_minimum: null, salary_minimum: 50000, salary_maximum: 80000 };
    const ext = transformWttjHit(withMinMax, detail, listingUrl);
    expect(ext.salaryMidpointUsd).toBe(65000);
  });

  it('handles a minimal hit with missing optional fields', () => {
    const minimal: AlgoliaHit = {
      objectID: 'x',
      name: 'T',
      slug: 's',
      organization: { name: 'C', slug: 'c' },
    };
    const minimalDetail: WttjJobDetail = { description: '<p>D</p>', apply_url: null };
    const ext = transformWttjHit(minimal, minimalDetail, 'https://x');
    expect(ext.sourceJobId).toBe('x');
    expect(ext.title).toBe('T');
    expect(ext.company).toBe('C');
    expect(ext.applyUrl).toBeNull();
    expect(ext.salaryMidpointUsd).toBeNull();
    expect(ext.postedAt).toBeNull();
  });
});
