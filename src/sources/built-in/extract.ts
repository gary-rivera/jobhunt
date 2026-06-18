import { ExtractedJob, RawListing } from '../types';
import { cleanDescription } from '../../utils/html';
import { extractWithLLM } from '../../services/llmExtractor';

interface JsonLdLocation {
  address?: { addressLocality?: string; addressRegion?: string; addressCountry?: string };
}

interface JsonLdJobPosting {
  '@type'?: string;
  title?: string;
  hiringOrganization?: { name?: string } | string;
  jobLocation?: JsonLdLocation | JsonLdLocation[];
  description?: string;
  datePosted?: string;
  identifier?: { value?: string | number } | string;
  baseSalary?: {
    value?: { minValue?: number; maxValue?: number; unitText?: string } | number;
  };
  url?: string;
  [k: string]: unknown;
}

interface JsonLdTransform {
  sourceJobId: string | null;
  title: string;
  company: string;
  location: string;
  descriptionRaw: string;
  applyUrl: string | null;
  salaryMidpointUsd: number | null;
  postedAt: Date | null;
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function asLocation(loc: JsonLdLocation | JsonLdLocation[] | undefined): string {
  if (!loc) return '';
  const first = Array.isArray(loc) ? loc[0] : loc;
  const a = first?.address;
  if (!a) return '';
  return [a.addressLocality, a.addressRegion, a.addressCountry]
    .filter((s) => typeof s === 'string' && s.length > 0)
    .join(', ');
}

function midpoint(min?: number, max?: number): number | null {
  if (typeof min === 'number' && typeof max === 'number') return Math.round((min + max) / 2);
  if (typeof min === 'number') return min;
  if (typeof max === 'number') return max;
  return null;
}

export function transformJobPostingJsonLd(jsonLd: JsonLdJobPosting): JsonLdTransform {
  const company =
    typeof jsonLd.hiringOrganization === 'string'
      ? jsonLd.hiringOrganization
      : asString(jsonLd.hiringOrganization?.name);
  const rawIdentifier =
    typeof jsonLd.identifier === 'string'
      ? jsonLd.identifier
      : jsonLd.identifier?.value;
  const identifier =
    rawIdentifier === undefined || rawIdentifier === null ? '' : String(rawIdentifier);
  const salaryValue = jsonLd.baseSalary?.value;
  const salaryMidpointUsd =
    typeof salaryValue === 'number'
      ? salaryValue
      : midpoint(salaryValue?.minValue, salaryValue?.maxValue);

  return {
    sourceJobId: identifier || null,
    title: asString(jsonLd.title),
    company,
    location: asLocation(jsonLd.jobLocation),
    descriptionRaw: asString(jsonLd.description),
    applyUrl: asString(jsonLd.url) || null,
    salaryMidpointUsd,
    postedAt: jsonLd.datePosted ? new Date(jsonLd.datePosted) : null,
  };
}

// Built In encodes the '+' in the type attribute as the HTML entity '&#x2B;'.
// Match either the literal '+' or that entity (case-insensitive).
const JSON_LD_SCRIPT_RE =
  /<script[^>]*type="application\/ld(?:\+|&#x2B;)json"[^>]*>([\s\S]*?)<\/script>/gi;

function findJobPostingJsonLd(html: string): JsonLdJobPosting | null {
  let match: RegExpExecArray | null;
  while ((match = JSON_LD_SCRIPT_RE.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const candidate of candidates) {
        if (candidate && candidate['@type'] === 'JobPosting') return candidate as JsonLdJobPosting;
        if (Array.isArray(candidate?.['@graph'])) {
          const inGraph = candidate['@graph'].find(
            (n: { '@type'?: string }) => n?.['@type'] === 'JobPosting',
          );
          if (inGraph) return inGraph as JsonLdJobPosting;
        }
      }
    } catch {
      // ignore malformed JSON-LD blocks
    }
  }
  return null;
}

const REQUIRED_JSON_LD_FIELDS: (keyof JsonLdTransform)[] = [
  'title',
  'company',
  'descriptionRaw',
];

function jsonLdIsComplete(t: JsonLdTransform): boolean {
  return REQUIRED_JSON_LD_FIELDS.every((k) => {
    const v = t[k];
    return typeof v === 'string' ? v.length > 0 : v !== null && v !== undefined;
  });
}

interface BuiltInPayload {
  detailHtml: string;
  jobUrl: string;
}

const BUILTIN_LLM_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    company: { type: 'string' },
    location: { type: 'string' },
    descriptionRaw: { type: 'string' },
    applyUrl: { type: ['string', 'null'] },
    salaryMidpointUsd: { type: ['number', 'null'] },
    postedAt: { type: ['string', 'null'] },
  },
  required: ['title', 'company', 'descriptionRaw'],
};

const BUILTIN_LLM_SYSTEM =
  'Extract the job posting fields from the HTML. Salary should be a US-dollar yearly midpoint if mentioned, otherwise null. postedAt is an ISO date if present.';

export async function extractBuiltInJob(raw: RawListing): Promise<ExtractedJob> {
  const { detailHtml, jobUrl } = raw.payload as BuiltInPayload;

  const jsonLd = findJobPostingJsonLd(detailHtml);
  let t: JsonLdTransform | null = jsonLd ? transformJobPostingJsonLd(jsonLd) : null;

  if (!t || !jsonLdIsComplete(t)) {
    const llm = await extractWithLLM<{
      title: string;
      company: string;
      location?: string;
      descriptionRaw: string;
      applyUrl?: string | null;
      salaryMidpointUsd?: number | null;
      postedAt?: string | null;
    }>(detailHtml, BUILTIN_LLM_SCHEMA, { system: BUILTIN_LLM_SYSTEM });

    t = {
      sourceJobId: t?.sourceJobId ?? null,
      title: t?.title || llm.title,
      company: t?.company || llm.company,
      location: t?.location || llm.location || '',
      descriptionRaw: t?.descriptionRaw || llm.descriptionRaw,
      applyUrl: t?.applyUrl ?? llm.applyUrl ?? null,
      salaryMidpointUsd: t?.salaryMidpointUsd ?? llm.salaryMidpointUsd ?? null,
      postedAt: t?.postedAt ?? (llm.postedAt ? new Date(llm.postedAt) : null),
    };
  }

  const descriptionCleaned = cleanDescription(t.descriptionRaw);

  return {
    sourceJobId: t.sourceJobId || raw.sourceJobId,
    sourceUrl: jobUrl,
    title: t.title,
    company: t.company,
    location: t.location,
    applyUrl: t.applyUrl,
    salaryMidpointUsd: t.salaryMidpointUsd,
    totalApplicants: null,
    postedAt: t.postedAt,
    descriptionRaw: t.descriptionRaw,
    descriptionCleaned,
  };
}
