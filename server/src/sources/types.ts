import { JobSource } from '@prisma/client';

export type SourceId = 'wttj' | 'linkedin-apify' | 'built-in' | 'indeed' | 'linkedin';

export interface SearchParams {
  query: string;
  locations?: string[];
  contractTypes?: string[];
  postedWithinDays?: number;
  hitsPerPage?: number;
  maxPages?: number;
}

export interface RawListing {
  sourceJobId: string;
  sourceUrl: string;
  payload: unknown;
}

export interface ExtractedJob {
  sourceJobId: string;
  sourceUrl: string;
  title: string;
  company: string;
  location: string;
  applyUrl: string | null;
  salaryMidpointUsd: number | null;
  totalApplicants: number | null;
  postedAt: Date | null;
  descriptionRaw: string;
  descriptionCleaned: string;
}

export interface SourceAdapter {
  readonly id: SourceId;
  fetch(params: SearchParams): Promise<RawListing[]>;
  extract(raw: RawListing): Promise<ExtractedJob>;
}

const SOURCE_ID_TO_ENUM: Record<SourceId, JobSource> = {
  wttj: 'WTTJ',
  'linkedin-apify': 'LINKEDIN_APIFY',
  'built-in': 'BUILT_IN',
  indeed: 'INDEED',
  linkedin: 'LINKEDIN',
};

export function toJobSourceEnum(id: SourceId): JobSource {
  return SOURCE_ID_TO_ENUM[id];
}
