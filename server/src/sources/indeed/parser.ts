export interface IndeedSalary {
  min?: number;
  max?: number;
  type?: 'YEARLY' | 'HOURLY' | 'MONTHLY' | 'WEEKLY' | 'DAILY' | string;
}

export interface IndeedMosaicJob {
  jobkey: string;
  title?: string;
  displayTitle?: string;
  company?: string;
  companyName?: string;
  formattedLocation?: string;
  remoteLocation?: boolean;
  snippet?: string;
  pubDate?: number;
  createDate?: number;
  formattedRelativeTime?: string;
  extractedSalary?: IndeedSalary;
  salarySnippet?: { text?: string };
  sponsoredJob?: boolean;
}

const MOSAIC_RE =
  /window\.mosaic\.providerData\["mosaic-provider-jobcards"\]\s*=\s*({[\s\S]*?});\s*window/;

interface MosaicEnvelope {
  metaData?: {
    mosaicProviderJobCardsModel?: { results?: IndeedMosaicJob[] };
  };
  results?: IndeedMosaicJob[];
}

// One placeholder card is rendered as a template by Indeed; it has this fake jk.
const PLACEHOLDER_JK = '890abcdef0123456';

export function parseMosaicJobs(html: string): IndeedMosaicJob[] {
  const match = html.match(MOSAIC_RE);
  if (!match) return [];
  let envelope: MosaicEnvelope;
  try {
    envelope = JSON.parse(match[1]) as MosaicEnvelope;
  } catch {
    return [];
  }
  const results =
    envelope.metaData?.mosaicProviderJobCardsModel?.results ?? envelope.results ?? [];
  return results.filter(
    (r): r is IndeedMosaicJob =>
      typeof r?.jobkey === 'string' && r.jobkey.length === 16 && r.jobkey !== PLACEHOLDER_JK,
  );
}

export function viewJobUrl(jobkey: string): string {
  return `https://www.indeed.com/viewjob?jk=${jobkey}`;
}
