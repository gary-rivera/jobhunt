import { ExtractedJob, RawListing } from '../types';
import { AlgoliaHit, WttjJobDetail, fetchJobDetail } from './client';
import { cleanDescription } from '../../utils/html';

const LISTING_URL_BASE = 'https://www.welcometothejungle.com/en/companies';

function buildLocation(hit: AlgoliaHit): string {
  const office = hit.office;
  const first = hit.offices?.[0];
  const parts: string[] = [];
  const city = office?.city || first?.city;
  const country = office?.country || first?.country;
  if (city) parts.push(city);
  if (country && country !== city) parts.push(country);
  return parts.join(', ');
}

function buildSalaryMidpoint(hit: AlgoliaHit): number | null {
  if (typeof hit.salary_yearly_minimum === 'number') return hit.salary_yearly_minimum;
  const min = hit.salary_minimum;
  const max = hit.salary_maximum;
  if (typeof min === 'number' && typeof max === 'number') return Math.round((min + max) / 2);
  if (typeof min === 'number') return min;
  if (typeof max === 'number') return max;
  return null;
}

export function buildListingUrl(orgSlug: string, jobSlug: string): string {
  return `${LISTING_URL_BASE}/${orgSlug}/jobs/${jobSlug}`;
}

export function transformWttjHit(
  hit: AlgoliaHit,
  detail: WttjJobDetail,
  listingUrl: string,
): ExtractedJob {
  const descriptionRaw = detail.description || detail.profile || detail.summary || '';
  return {
    sourceJobId: String(hit.objectID),
    sourceUrl: listingUrl,
    title: String(hit.name || detail.name || ''),
    company: String(hit.organization?.name || detail.organization?.name || ''),
    location: buildLocation(hit),
    applyUrl: detail.apply_url ?? null,
    salaryMidpointUsd: buildSalaryMidpoint(hit),
    totalApplicants: null,
    postedAt: hit.published_at ? new Date(hit.published_at) : null,
    descriptionRaw,
    descriptionCleaned: cleanDescription(descriptionRaw),
  };
}

export async function extractWttjJob(raw: RawListing): Promise<ExtractedJob> {
  const hit = raw.payload as AlgoliaHit;
  const orgSlug = hit.organization?.slug;
  const jobSlug = hit.slug;
  if (!orgSlug || !jobSlug) {
    throw new Error(
      `[wttj] hit ${hit.objectID} missing organization.slug or slug; cannot fetch detail`,
    );
  }
  const detail = await fetchJobDetail(orgSlug, jobSlug);
  return transformWttjHit(hit, detail, buildListingUrl(orgSlug, jobSlug));
}
