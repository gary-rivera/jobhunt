import { RawListing, SearchParams, SourceAdapter } from '../types';
import { registerAdapter } from '../registry';
import { searchIndeed, viewJobUrl } from './client';
import { extractIndeedJob } from './extract';

export const indeedAdapter: SourceAdapter = {
  id: 'indeed',

  async fetch(params: SearchParams): Promise<RawListing[]> {
    // Spec: page 1 is sufficient at daily cadence. Honor maxPages if explicitly set.
    const maxPages = params.maxPages ?? 1;
    const hitsPerPage = params.hitsPerPage ?? 25;
    const all: RawListing[] = [];
    const seen = new Set<string>();

    for (let page = 1; page <= maxPages; page++) {
      const jobs = await searchIndeed({
        query: params.query,
        page,
        locations: params.locations,
        hitsPerPage,
      });
      if (jobs.length === 0) break;
      for (const job of jobs) {
        if (seen.has(job.jobkey)) continue;
        seen.add(job.jobkey);
        all.push({
          sourceJobId: job.jobkey,
          sourceUrl: viewJobUrl(job.jobkey),
          payload: { mosaicJob: job },
        });
      }
    }
    return all;
  },

  async extract(raw: RawListing) {
    return extractIndeedJob(raw);
  },
};

registerAdapter(indeedAdapter);
