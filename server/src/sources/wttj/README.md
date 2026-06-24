# WTTJ source adapter — research notes

Notes captured during Phase 5 of the multi-source job aggregator foundation plan. These supersede the field-name and endpoint guesses in the plan (which were placeholders) and drive the implementation in Phase 6.

## Endpoints used

### 1. Algolia multi-query (list)

```
POST https://csekhvms53-dsn.algolia.net/1/indexes/*/queries
Content-Type: application/json
X-Algolia-Application-Id: CSEKHVMS53
X-Algolia-API-Key: 4bd8f6215d0cc52b26430765769e65a0
Referer: https://www.welcometothejungle.com/
```

Body:

```json
{
  "requests": [
    {
      "indexName": "wk_cms_jobs_production",
      "params": "query=software engineer&hitsPerPage=20&page=0"
    }
  ]
}
```

- **App ID:** `CSEKHVMS53`
- **Public search key:** `4bd8f6215d0cc52b26430765769e65a0` (referer-restricted; this is a search-only key, safe to commit if we ever decide to skip the cache file, but we still gitignore `data/wttj-creds.json` per plan)
- **Primary index:** `wk_cms_jobs_production`
- **Recency-sorted replica:** `wk_cms_jobs_production_published_at_desc` (use this for full enumeration)
- **Endpoint:** the multi-query `/1/indexes/*/queries`, **not** the single-index `/1/indexes/<index>/query` the plan assumed
- **Referer requirement:** the key returns `403 "Method not allowed with this referer"` unless `Referer: https://www.welcometothejungle.com/` is sent. Plan didn't anticipate this.

### 2. Job detail (REST)

The Algolia hit does **not** include the job description. Algolia returns `profile: ""` (truncated by their indexing config). The full HTML body lives on WTTJ's own REST API:

```
GET https://api.welcometothejungle.com/api/v1/organizations/{organization.slug}/jobs/{slug}
Referer: https://www.welcometothejungle.com/
```

No auth required. Returns `{"job": { ...full job... }}` with `description` (HTML), `apply_url`, `summary`, `key_missions`, `company_description`, `salary_min`/`salary_max`, etc.

## Algolia hit schema (observed)

Fields present on every hit (`first hit keys` from a real query):

```
_geoloc, _highlightResult, _snippetResult,
contract_duration_maximum, contract_duration_minimum,
contract_type, contract_type_names,
department, education_level,
experience_level_minimum,
has_contract_duration, has_education_level,
has_experience_level_minimum, has_salary_yearly_minimum,
language, name, objectID,
office, offices,
organization (has .name, .slug, .descriptions{fr,en,…}),
profession, profession_name,
profile (always empty string in hits — fetch detail endpoint for description),
promoted, published_at, reference, remote,
salary_currency, salary_maximum, salary_minimum,
salary_period, salary_yearly_minimum,
sectors, sectors_name,
slug, website
```

Plan-vs-reality field mapping:

| Plan assumed | Actual |
|---|---|
| `organisation.name` (British) | `organization.name` (American) |
| `organisation.slug` | `organization.slug` |
| `office.location.short` | `office.city` (or `office.country`, `office.country_code`); also `offices[]` array |
| `salary.yearly_min` / `salary.yearly_max` | flat: `salary_minimum`, `salary_maximum`, `salary_yearly_minimum`, plus `salary_period` ('year', 'month', 'none') and `salary_currency` |
| `description` (on hit) | not present — fetch detail endpoint |
| `published_at: ISO date` | `published_at: "2026-05-21T00:00:00.000+02:00"` (timezone-aware ISO) |
| `objectID: string \| number` | `objectID: string` (numeric string) |

## Job detail schema (observed)

Top-level: `{ "job": { ... } }`. Inner job keys:

```
application_fields, apply_url, archived_at, ats, ats_questions,
benefits, company_description, company_summary,
contract_duration_max, contract_duration_min, contract_type,
cta_content, description, education_level, experience_level,
featured_page, is_default, key_missions, language, name,
office, offices, organization, profession, profile,
published_at, recruiter_proposal, recruitment_process,
reference, remote,
salary_currency, salary_max, salary_min, salary_period,
skills, slug, social_image, start_date, status, summary,
team, tools, updated_at, urls, videos, wttj_reference
```

Notes:
- `description` is HTML (~5KB average) — needs stripping in `cleanDescription`
- Detail endpoint uses `salary_min`/`salary_max` (singular suffix), distinct from Algolia hits' `salary_minimum`/`salary_maximum` (`-imum` suffix). Both refer to the same value range.
- `apply_url` is sometimes null; in our pipeline this lands in nullable `apply_to_url`
- `wttj_reference` is a stable string ID (e.g. `SG_qxxA6pr`); `objectID` from Algolia is numeric (`"4081381"`). We'll use Algolia's `objectID` as `sourceJobId` since that's what the search returns first.

## Concurrency: detail-page fetch IS required

Plan's Task 10 Step 5 asked us to decide. **Decision:** per-job detail fetch is required → `extract.ts` must perform a network call.

Implications for Phase 6:

- The `extract` step is no longer pure — it makes one HTTP call per Algolia hit
- For ~1000 search hits, that's 1000 sequential GETs against `api.welcometothejungle.com` — needs throttling
- Use a concurrency cap (suggest 4 parallel requests) and a short backoff on 429/403
- Cache by `(orgSlug, jobSlug)` within a single run isn't necessary since `objectID` is unique; cross-run dedup happens upstream via `UNIQUE(source, sourceJobId)`

Concrete implementation guidance:
- `client.ts` exposes `searchWttj(opts)` (Algolia multi-query) and `fetchJobDetail(orgSlug, jobSlug)` (REST)
- Both calls always send `Referer: https://www.welcometothejungle.com/`
- Adapter `fetch()` does the Algolia query and returns `RawListing[]` where `payload = { algoliaHit }`
- Adapter `extract()` reads `payload.algoliaHit`, calls `fetchJobDetail`, merges, returns `ExtractedJob`
- Concurrency control lives in the adapter's `fetch()` post-processing OR the pipeline's per-item loop — simpler to leave pipeline as-is and have `extract()` self-throttle by limiting parallelism with a small semaphore.

Since the pipeline currently iterates sequentially (`for (const raw of rawListings) { await adapter.extract(raw); ... }`), there's already an implicit concurrency of 1 → safe but slow (~1000 jobs × 200ms = 200s). For initial implementation, **keep the sequential loop**. Add concurrency later if needed.

## Useful parameter reference (from user's research)

Inside the URL-encoded `params` string of the Algolia multi-query body:

- **Full-text:** `query=...`
- **Pagination:** `page=0` (0-indexed), `hitsPerPage=20` (Algolia caps at 1000)
- **Facet counts:** `facets=["contract_type","remote","experience_level_minimum","education_level","offices.country_code","offices.city","language","has_salary_yearly_minimum"]` (JSON-encoded)
- **Facet filters:** `facetFilters=[["contract_type:FULL_TIME"],["remote:partial","remote:fulltime"],["offices.country_code:FR"]]`
- **Numeric filters:** `numericFilters=["salary_yearly_minimum>=40000"]`
- **Geo:** `aroundLatLng=48.8566,2.3522&aroundRadius=30000` (meters)
- **Sort by recency:** switch `indexName` to `wk_cms_jobs_production_published_at_desc`
- **Click analytics (optional):** `clickAnalytics=true`

Common facet values observed:

- **`contract_type`:** `FULL_TIME`, `PART_TIME`, `INTERNSHIP`, `APPRENTICESHIP`, `FREELANCE`, `TEMPORARY`, `VIE`, `OTHER`
- **`remote`:** `fulltime`, `partial`, `punctual`, `no`, `unknown`
- **`offices.country_code`:** ISO-2 codes (`FR`, `GB`, `US`, …)

## Full-enumeration strategy

For a complete crawl (~4,400 active jobs):
- Walk `wk_cms_jobs_production_published_at_desc` with `hitsPerPage=1000`, increment `page` until `nbPages`
- Algolia hard-caps total paginated results at 1000 per query — if a single query exceeds, narrow by `numericFilters=["published_at_timestamp>=..."]` or split by `offices.country_code`
- Cache `nbHits`/`nbPages` from the first response to plan pagination
- On 403 from Algolia, re-fetch the public key (in our pipeline: invalidate the cache and prompt re-paste; we are no longer scraping the homepage). Algolia returns rate-limit info in response headers.

## Fixtures

- `fixtures/algolia-response.json` — sanitized 3-hit response to a `query=software engineer` call. Used by `extract.test.ts` to exercise field mapping.
- `fixtures/job-detail.json` — full job-detail response for the first hit (`objectID=4081381`, `slug=software-engineer_la-defense_SG_qxxA6pr`, org=`societe-generale`). Used by `extract.test.ts` to test description cleaning.

No `fixtures/homepage.html` — we don't scrape the homepage anymore. The plan's `parseCreds.{ts,test.ts}` is replaced by direct cred config (see next section).

## Credential storage

Per plan, `data/wttj-creds.json` is gitignored and holds:

```json
{
  "appId": "CSEKHVMS53",
  "apiKey": "4bd8f6215d0cc52b26430765769e65a0",
  "fetchedAt": "2026-05-20T22:38:00.000Z"
}
```

If absent at runtime, the client refuses to start and emits a clear error pointing here. Operator must paste fresh values from DevTools (Network → filter `algolia.net` → Headers tab) and write the file. Rotation cadence appears to be very low; refresh on demand only.
