import { readFile } from 'fs/promises';

const ALGOLIA_APP_HOST = (appId: string) => `https://${appId.toLowerCase()}-dsn.algolia.net`;
const REFERER = 'https://www.welcometothejungle.com/';
const WTTJ_API_BASE = 'https://api.welcometothejungle.com/api/v1';
const CREDS_CACHE_PATH = process.env.WTTJ_CREDS_CACHE_PATH || './data/wttj-creds.json';
const DEFAULT_INDEX = process.env.WTTJ_INDEX || 'wk_cms_jobs_production';

export interface AlgoliaCreds {
  appId: string;
  apiKey: string;
  fetchedAt: string;
}

export interface AlgoliaHit {
  objectID: string;
  name?: string;
  slug?: string;
  organization?: { slug?: string; name?: string };
  office?: { city?: string; country?: string; country_code?: string };
  offices?: Array<{ city?: string; country?: string; country_code?: string }>;
  published_at?: string;
  salary_minimum?: number | null;
  salary_maximum?: number | null;
  salary_yearly_minimum?: number | null;
  salary_currency?: string | null;
  salary_period?: string | null;
  contract_type?: string;
  remote?: string;
  reference?: string;
  [key: string]: unknown;
}

export interface AlgoliaIndexResult {
  hits: AlgoliaHit[];
  page: number;
  nbPages: number;
  nbHits: number;
  hitsPerPage: number;
  index: string;
}

export interface AlgoliaMultiResponse {
  results: AlgoliaIndexResult[];
}

export interface WttjJobDetail {
  name?: string;
  slug?: string;
  description?: string;
  profile?: string;
  summary?: string;
  apply_url?: string | null;
  published_at?: string;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_period?: string | null;
  salary_currency?: string | null;
  contract_type?: string;
  remote?: string;
  reference?: string;
  organization?: { slug?: string; name?: string };
  office?: { city?: string; country?: string; country_code?: string };
  offices?: Array<{ city?: string; country?: string; country_code?: string }>;
  [key: string]: unknown;
}

let cachedCreds: AlgoliaCreds | null = null;

export async function getAlgoliaCreds(): Promise<AlgoliaCreds> {
  if (cachedCreds) return cachedCreds;
  try {
    const raw = await readFile(CREDS_CACHE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as AlgoliaCreds;
    if (!parsed.appId || !parsed.apiKey) {
      throw new Error('missing appId/apiKey');
    }
    cachedCreds = parsed;
    return parsed;
  } catch (err) {
    throw new Error(
      `[wttj] Algolia creds not available at ${CREDS_CACHE_PATH}. ` +
        `Open https://www.welcometothejungle.com/ in a browser, find an algolia.net request in DevTools Network tab, ` +
        `and write the file as {"appId":"...","apiKey":"...","fetchedAt":"<ISO>"}. ` +
        `(underlying error: ${err instanceof Error ? err.message : String(err)})`,
    );
  }
}

export interface WttjSearchOptions {
  query: string;
  hitsPerPage: number;
  page: number;
  index?: string;
  facetFilters?: string[][];
  numericFilters?: string[];
}

function buildParams(opts: WttjSearchOptions): string {
  const parts: string[] = [
    `query=${encodeURIComponent(opts.query)}`,
    `hitsPerPage=${opts.hitsPerPage}`,
    `page=${opts.page}`,
  ];
  if (opts.facetFilters && opts.facetFilters.length > 0) {
    parts.push(`facetFilters=${encodeURIComponent(JSON.stringify(opts.facetFilters))}`);
  }
  if (opts.numericFilters && opts.numericFilters.length > 0) {
    parts.push(`numericFilters=${encodeURIComponent(JSON.stringify(opts.numericFilters))}`);
  }
  return parts.join('&');
}

export async function searchWttj(opts: WttjSearchOptions): Promise<AlgoliaIndexResult> {
  const creds = await getAlgoliaCreds();
  const url = `${ALGOLIA_APP_HOST(creds.appId)}/1/indexes/*/queries`;
  const indexName = opts.index || DEFAULT_INDEX;
  const body = {
    requests: [{ indexName, params: buildParams(opts) }],
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Algolia-Application-Id': creds.appId,
      'X-Algolia-API-Key': creds.apiKey,
      'Content-Type': 'application/json',
      Referer: REFERER,
    },
    body: JSON.stringify(body),
  });

  if (resp.status === 401 || resp.status === 403) {
    cachedCreds = null;
    throw new Error(
      `[wttj] Algolia rejected creds (${resp.status}). Re-paste creds into ${CREDS_CACHE_PATH} from DevTools.`,
    );
  }
  if (!resp.ok) {
    throw new Error(`[wttj] Algolia query failed: ${resp.status} ${await resp.text()}`);
  }
  const data = (await resp.json()) as AlgoliaMultiResponse;
  if (!data.results?.[0]) {
    throw new Error('[wttj] Algolia returned empty results array');
  }
  return data.results[0];
}

export async function fetchJobDetail(orgSlug: string, jobSlug: string): Promise<WttjJobDetail> {
  const url = `${WTTJ_API_BASE}/organizations/${encodeURIComponent(orgSlug)}/jobs/${encodeURIComponent(jobSlug)}`;
  const resp = await fetch(url, {
    headers: { Referer: REFERER },
  });
  if (!resp.ok) {
    throw new Error(`[wttj] job detail fetch failed: ${resp.status} ${url}`);
  }
  const data = (await resp.json()) as { job?: WttjJobDetail };
  if (!data.job) {
    throw new Error(`[wttj] job detail missing 'job' wrapper: ${url}`);
  }
  return data.job;
}
