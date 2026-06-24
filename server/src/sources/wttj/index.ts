import { RawListing, SearchParams, SourceAdapter } from '../types';
import { registerAdapter } from '../registry';
import { searchWttj } from './client';
import { extractWttjJob, buildListingUrl } from './extract';

export const wttjAdapter: SourceAdapter = {
  id: 'wttj',

  async fetch(params: SearchParams): Promise<RawListing[]> {
    const hitsPerPage = params.hitsPerPage ?? 50;
    const maxPages = params.maxPages ?? 3;
    const all: RawListing[] = [];

    for (let page = 0; page < maxPages; page++) {
      const resp = await searchWttj({ query: params.query, hitsPerPage, page });
      log.info('[wttj] fetched page', {
        page,
        count: resp.hits.length,
        nbPages: resp.nbPages,
        nbHits: resp.nbHits,
      });
      for (const hit of resp.hits) {
        const orgSlug = hit.organization?.slug;
        const jobSlug = hit.slug;
        if (!orgSlug || !jobSlug) {
          log.warn('[wttj] skipping hit missing slugs', { objectID: hit.objectID });
          continue;
        }
        all.push({
          sourceJobId: String(hit.objectID),
          sourceUrl: buildListingUrl(orgSlug, jobSlug),
          payload: hit,
        });
      }
      if (page + 1 >= resp.nbPages) break;
    }
    return all;
  },

  async extract(raw: RawListing) {
    return extractWttjJob(raw);
  },
};

registerAdapter(wttjAdapter);
