import fs from 'fs';
import path from 'path';
import {
  buildSeeMoreUrl,
  snapTimePostedFilter,
  parseListingCards,
} from './client';

describe('snapTimePostedFilter', () => {
  it('snaps to r86400 for <= 1 day', () => {
    expect(snapTimePostedFilter(0)).toBe('r86400');
    expect(snapTimePostedFilter(1)).toBe('r86400');
  });
  it('snaps to r604800 for 2-7 days', () => {
    expect(snapTimePostedFilter(2)).toBe('r604800');
    expect(snapTimePostedFilter(7)).toBe('r604800');
  });
  it('snaps to r2592000 for 8+ days', () => {
    expect(snapTimePostedFilter(8)).toBe('r2592000');
    expect(snapTimePostedFilter(30)).toBe('r2592000');
    expect(snapTimePostedFilter(90)).toBe('r2592000');
  });
});

describe('buildSeeMoreUrl', () => {
  it('builds with required query only', () => {
    const url = buildSeeMoreUrl({ query: 'software engineer' });
    expect(url).toContain(
      'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search',
    );
    expect(url).toContain('keywords=software+engineer');
    expect(url).toContain('start=0');
    expect(url).toContain('pageSize=25');
  });
  it('includes location when present', () => {
    expect(buildSeeMoreUrl({ query: 'qa', location: 'United States' })).toContain(
      'location=United+States',
    );
  });
  it('encodes special characters', () => {
    expect(buildSeeMoreUrl({ query: 'c++ engineer' })).toContain('keywords=c%2B%2B+engineer');
  });
  it('snaps and includes f_TPR', () => {
    expect(
      buildSeeMoreUrl({ query: 'qa', postedWithinDays: 5 }),
    ).toContain('f_TPR=r604800');
  });
});

describe('parseListingCards', () => {
  it('extracts jobId + jobUrl from data-entity-urn', () => {
    const html =
      '<li data-entity-urn="urn:li:jobPosting:123"></li>' +
      '<li data-entity-urn="urn:li:jobPosting:456"></li>';
    const cards = parseListingCards(html);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({
      jobId: '123',
      jobUrl: 'https://www.linkedin.com/jobs/view/123/',
    });
    expect(cards[1].jobId).toBe('456');
  });

  it('de-duplicates repeated jobIds across the fragment', () => {
    const html =
      '<li data-entity-urn="urn:li:jobPosting:abc"></li>' +
      '<a data-entity-urn="urn:li:jobPosting:abc"></a>';
    const cards = parseListingCards(html);
    expect(cards).toHaveLength(1);
  });

  it('returns empty when no listings', () => {
    expect(parseListingCards('<html><body>no jobs</body></html>')).toEqual([]);
  });

  it('extracts listingFields from real fixture', () => {
    const html = fs.readFileSync(
      path.join(__dirname, 'fixtures/listing-fragment.html'),
      'utf8',
    );
    const cards = parseListingCards(html);
    expect(cards.length).toBeGreaterThan(0);
    const c = cards[0];
    expect(c.jobId).toMatch(/^\d+$/);
    expect(c.jobUrl).toMatch(/^https:\/\/www\.linkedin\.com\/jobs\/view\/\d+\/$/);
    expect(c.listingFields).toBeDefined();
    expect(c.listingFields.title.length).toBeGreaterThan(0);
    expect(c.listingFields.company.length).toBeGreaterThan(0);
    // snippet not asserted — LinkedIn no longer ships it in listing fragments
  });
});
