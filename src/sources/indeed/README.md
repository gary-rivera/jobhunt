# Indeed source adapter — research notes

Captured 2026-05-22. These notes drive `client.ts`, `extract.ts`, and the test fixtures.

## Anti-bot posture

- `curl` GET against `https://www.indeed.com/jobs?q=...&l=...` with a desktop UA returns **HTTP 403** — Indeed serves a Cloudflare-backed "Security Check - Indeed.com" interstitial. Plain HTTP is not viable.
- Headless Chromium via Playwright (stateless: no storage state, no account) renders the search page cleanly with a real title and 20–25 job cards. No challenge.
- Detail pages (`/viewjob?jk=...` directly, or `/rc/clk?...` redirects from clicking cards) **do** trigger a Cloudflare JS challenge from a fresh context. Bypassing this would require stealth plugins, residential IPs, or challenge solvers — explicitly out of scope per spec principle #2 ("personal-scale, not platform-scale; no CAPTCHA solving").
- Conclusion: search page is fully accessible, detail pages are not. The adapter relies entirely on the structured data embedded in the search HTML.

## Search URL

- Pattern: `https://www.indeed.com/jobs?q=<query>&l=<location>`.
- Pagination: `&start=N` where N is `(page - 1) * hitsPerPage`. First page omits the param.
- **Page 1 is the only accessible page anonymously.** Verified 2026-05-22: `start=10` redirects to `secure.indeed.com/auth?...&branding=page-two-signin` (Indeed's "page two sign-in" wall); `start=20` and higher return a Cloudflare 403 challenge. Page 1 alone yields ~24 results, which is plenty for daily-digest cadence.
- The `maxPages` parameter is still respected (default 1); setting it higher won't error — page 2's sign-in HTML parses cleanly as zero jobs and the loop breaks — but it won't yield more jobs either without auth.

## Listing-page structure

- Format: full SPA HTML with an embedded JSON blob.
- The blob lives at `window.mosaic.providerData["mosaic-provider-jobcards"]` as inline-script assignment. Regex extraction with `JSON.parse` recovers the full object cleanly.
- Each job entry in `metaData.mosaicProviderJobCardsModel.results[]` is a structured object — no HTML scraping needed for the core fields.
- One result is a **template placeholder** with `jobkey: "890abcdef0123456"`. The parser filters it out (real jks are 16-char hex but never that specific sequence).

## Per-card fields (used by the adapter)

| Adapter field | Mosaic field | Notes |
|---|---|---|
| `sourceJobId` | `jobkey` | 16-char lowercase hex, stable across reruns. |
| `sourceUrl` | derived | `https://www.indeed.com/viewjob?jk=<jobkey>` (not the `/rc/clk` redirect). |
| `title` | `title` or `displayTitle` | |
| `company` | `company` or `companyName` | |
| `location` | `formattedLocation` | Falls back to `"Remote"` if empty and `remoteLocation: true`. |
| `descriptionRaw` | `snippet` | HTML-formatted excerpt (typically 2–4 bullet points). **This is a truncated snippet, not the full description** — see "Known limitations" below. |
| `postedAt` | `pubDate` then `createDate` | Epoch milliseconds. |
| `salaryMidpointUsd` | `extractedSalary.{min,max,type}` | Annualized: HOURLY×2080, WEEKLY×52, MONTHLY×12, DAILY×260. |
| `totalApplicants` | — | Indeed does not expose this in the mosaic data. Always `null`. |

## Known limitations

- **Descriptions are snippets, not full text.** Indeed's full job descriptions live on the detail page, which is Cloudflare-gated for direct navigation. The snippet (~2–4 bullets, ~200–500 chars of HTML) is generally enough for relevance scoring but contains less signal than a full description.
- **No application stats** (`totalApplicants` is always null).
- **Sponsored results are included.** They are functionally identical to organic results in the mosaic data, with a different bid layout. No filter applied — let downstream scoring decide.

## Extraction strategy chosen

- **No LLM call.** The mosaic JSON is already structured; extraction is a pure transform. This makes Indeed the cheapest source per listing (no Ollama round-trip) and side-steps LLM brittleness — at the cost of snippet-only descriptions.
- If we ever need full descriptions, the path forward is either (a) accept the Cloudflare challenge cost via a real browser-automation library that handles it, or (b) try Indeed's mobile site `m.indeed.com` which sometimes has weaker protection.
