const SEARCH_URL_BASE = process.env.BUILTIN_SEARCH_URL || 'https://builtin.com/jobs';
const DETAIL_URL_BASE = 'https://builtin.com';
const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

export interface BuiltInSearchOptions {
  query: string;
  page: number;
  locations?: string[];
}

export interface BuiltInJobLink {
  jobId: string;
  url: string;
}

function buildSearchUrl(opts: BuiltInSearchOptions): string {
  const params = new URLSearchParams();
  params.set('search', opts.query);
  if (opts.page > 1) params.set('page', String(opts.page));
  if (opts.locations && opts.locations.length > 0) {
    params.set('location', opts.locations[0]);
  }
  return `${SEARCH_URL_BASE}?${params.toString()}`;
}

async function fetchHtml(url: string): Promise<string> {
  const resp = await fetch(url, { headers: DEFAULT_HEADERS });
  if (!resp.ok) {
    throw new Error(`[built-in] HTTP ${resp.status} for ${url}`);
  }
  return resp.text();
}

export function parseListingForJobLinks(html: string): BuiltInJobLink[] {
  const seen = new Set<string>();
  const links: BuiltInJobLink[] = [];
  const re = /<a[^>]+href="(\/job\/[^"#?]+)"/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const path = match[1];
    if (seen.has(path)) continue;
    seen.add(path);
    const jobId = path.split('/').pop() || path;
    links.push({ jobId, url: `${DETAIL_URL_BASE}${path}` });
  }
  return links;
}

export async function searchBuiltIn(opts: BuiltInSearchOptions): Promise<BuiltInJobLink[]> {
  const url = buildSearchUrl(opts);
  log.info('[built-in] fetching search page', { url, page: opts.page });
  const html = await fetchHtml(url);
  const links = parseListingForJobLinks(html);
  log.info('[built-in] parsed listing page', { page: opts.page, count: links.length });
  return links;
}

export async function fetchBuiltInJobDetail(url: string): Promise<string> {
  return fetchHtml(url);
}
