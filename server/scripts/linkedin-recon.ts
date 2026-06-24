import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SEE_MORE_URL =
  'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search' +
  '?keywords=software%20engineer&location=United%20States&f_TPR=r604800&start=0&pageSize=25';

const FIXTURES_DIR = './src/sources/linkedin/fixtures';
const REPORT_PATH = './src/sources/linkedin/fixtures/_recon-report.json';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

interface ReconReport {
  seeMoreStatus: number | string;
  seeMoreBytes: number;
  cardCount: number;
  firstJobUrl: string | null;
  detailStatus: 'reached' | 'login-walled' | 'error';
  detailHasJsonLd: boolean;
  detailJsonLdHasRequired: boolean;
  notes: string[];
}

async function main(): Promise<void> {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  const report: ReconReport = {
    seeMoreStatus: 'unstarted',
    seeMoreBytes: 0,
    cardCount: 0,
    firstJobUrl: null,
    detailStatus: 'error',
    detailHasJsonLd: false,
    detailJsonLdHasRequired: false,
    notes: [],
  };

  let listingHtml = '';
  try {
    const resp = await fetch(SEE_MORE_URL, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en' },
    });
    report.seeMoreStatus = resp.status;
    listingHtml = await resp.text();
    report.seeMoreBytes = listingHtml.length;
    fs.writeFileSync(path.join(FIXTURES_DIR, 'listing-fragment.html'), listingHtml);
    if (!resp.ok) report.notes.push(`seeMore non-2xx: ${resp.status}`);
  } catch (err) {
    report.seeMoreStatus = `error: ${err instanceof Error ? err.message : String(err)}`;
    report.notes.push('seeMore fetch threw');
  }

  const idMatches = Array.from(
    listingHtml.matchAll(/data-entity-urn="urn:li:jobPosting:(\d+)"/g),
  );
  let altMatches: RegExpMatchArray[] = [];
  if (idMatches.length === 0) {
    altMatches = Array.from(listingHtml.matchAll(/data-job-id="(\d+)"/g));
    report.notes.push(
      `Primary selector missing; alt data-job-id matches: ${altMatches.length}`,
    );
  }
  const jobIds = (idMatches.length > 0 ? idMatches : altMatches).map((m) => m[1]);
  report.cardCount = new Set(jobIds).size;
  if (jobIds[0]) report.firstJobUrl = `https://www.linkedin.com/jobs/view/${jobIds[0]}/`;

  if (report.firstJobUrl) {
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({
        userAgent: UA,
        viewport: { width: 1280, height: 800 },
        locale: 'en-US',
        timezoneId: 'America/New_York',
      });
      const page = await context.newPage();
      page.setDefaultNavigationTimeout(30000);
      const resp = await page.goto(report.firstJobUrl, { waitUntil: 'domcontentloaded' });
      const url = page.url();
      const html = await page.content();

      const onAuthwall =
        url.includes('/authwall') ||
        url.includes('/checkpoint') ||
        /sign\s*in\s*to\s*view/i.test(html);
      if (onAuthwall) {
        report.detailStatus = 'login-walled';
        fs.writeFileSync(path.join(FIXTURES_DIR, 'login-wall.html'), html);
        report.notes.push(`authwall on detail (status ${resp?.status() ?? 'n/a'})`);
      } else {
        report.detailStatus = 'reached';
        fs.writeFileSync(path.join(FIXTURES_DIR, 'detail-page.html'), html);
      }

      const jsonLdMatches = Array.from(
        html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi),
      );
      report.detailHasJsonLd = jsonLdMatches.length > 0;
      for (const m of jsonLdMatches) {
        try {
          const parsed = JSON.parse(m[1].trim());
          const items = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of items) {
            if (!item) continue;
            const t = item['@type'];
            const types = Array.isArray(t) ? t : [t];
            if (types.includes('JobPosting')) {
              const has =
                !!item.title &&
                !!item.hiringOrganization &&
                !!item.jobLocation &&
                !!item.description &&
                !!item.datePosted;
              report.detailJsonLdHasRequired = report.detailJsonLdHasRequired || has;
            }
          }
        } catch { /* ignore */ }
      }
      await context.close();
    } finally {
      await browser.close();
    }
  } else {
    report.notes.push('No job IDs parsed; skipping detail recon.');
  }

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => { console.error(err); process.exit(1); });
