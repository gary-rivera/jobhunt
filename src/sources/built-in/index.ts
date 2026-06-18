import { RawListing, SearchParams, SourceAdapter } from '../types';
import { registerAdapter } from '../registry';
import { searchBuiltIn, fetchBuiltInJobDetail } from './client';
import { extractBuiltInJob } from './extract';

export const builtInAdapter: SourceAdapter = {
  id: 'built-in',

  async fetch(params: SearchParams): Promise<RawListing[]> {
    const maxPages = params.maxPages ?? 3;
    const all: RawListing[] = [];

    for (let page = 1; page <= maxPages; page++) {
      const links = await searchBuiltIn({
        query: params.query,
        page,
        locations: params.locations,
      });
      if (links.length === 0) break;
      for (const link of links) {
        all.push({
          sourceJobId: link.jobId,
          sourceUrl: link.url,
          payload: { jobUrl: link.url },
        });
      }
    }
    return all;
  },

  async extract(raw: RawListing) {
    const payload = raw.payload as { jobUrl: string; detailHtml?: string };
    const detailHtml = payload.detailHtml ?? (await fetchBuiltInJobDetail(payload.jobUrl));
    return extractBuiltInJob({
      ...raw,
      payload: { jobUrl: payload.jobUrl, detailHtml },
    });
  },
};

registerAdapter(builtInAdapter);
