import { chromium, type Browser, type BrowserContext } from 'playwright';
import { IndeedMosaicJob, parseMosaicJobs } from './parser';

const SEARCH_URL_BASE = process.env.INDEED_SEARCH_URL || 'https://www.indeed.com/jobs';
const DEFAULT_USER_AGENT =
  process.env.INDEED_USER_AGENT ||
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export interface IndeedSearchOptions {
  query: string;
  page: number;
  locations?: string[];
  hitsPerPage?: number;
}

function buildSearchUrl(opts: IndeedSearchOptions): string {
  const params = new URLSearchParams();
  params.set('q', opts.query);
  if (opts.locations && opts.locations.length > 0) {
    params.set('l', opts.locations[0]);
  }
  if (opts.page > 1) {
    const perPage = opts.hitsPerPage ?? 25;
    params.set('start', String((opts.page - 1) * perPage));
  }
  return `${SEARCH_URL_BASE}?${params.toString()}`;
}

async function fetchSearchHtml(url: string): Promise<string> {
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      userAgent: DEFAULT_USER_AGENT,
    });
    const page = await context.newPage();
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    if (!resp || !resp.ok()) {
      throw new Error(`[indeed] HTTP ${resp?.status() ?? 'no-response'} for ${url}`);
    }
    await page.waitForTimeout(2_000);
    return await page.content();
  } finally {
    await context?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }
}

export async function searchIndeed(opts: IndeedSearchOptions): Promise<IndeedMosaicJob[]> {
  const url = buildSearchUrl(opts);
  log.info('[indeed] fetching search page', { url, page: opts.page });
  const html = await fetchSearchHtml(url);
  const jobs = parseMosaicJobs(html);
  log.info('[indeed] parsed search page', { page: opts.page, count: jobs.length });
  return jobs;
}

export { parseMosaicJobs, viewJobUrl } from './parser';
export type { IndeedMosaicJob, IndeedSalary } from './parser';
