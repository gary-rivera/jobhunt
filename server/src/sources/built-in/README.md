# Built In source adapter — research notes

Captured 2026-05-20 during Phase 2 of the Built In adapter plan. These notes drive `client.ts`, `extract.ts`, and the test fixtures.

## Anti-bot posture

- `curl` GET against `https://builtin.com/jobs?search=software+engineer` returns: HTTP 200, ~377 KB HTML. No challenge page.
- The only Cloudflare reference is the `cloudflareinsights.com` analytics beacon — not a WAF challenge.
- Required headers: a desktop `User-Agent` is sufficient. No cookies or TLS-fingerprint trickery needed for the search page or detail pages.
- No JS execution required: the search HTML directly contains 25 job cards with anchor tags, and the detail HTML directly contains the JSON-LD JobPosting block.

## Search URL

- Pattern: `https://builtin.com/jobs?search=<query>` (URL-encoded spaces as `%20` or `+` both work).
- Pagination: `&page=N` (1-indexed; first page omits the param). Pager anchors visible in the HTML go up to `page=400`.
- Location filter: not investigated — out of scope for Phase 2 (the plan's `BuiltInSearchOptions.locations` defaults to a single-value filter; refine if/when needed).

## Listing-page structure

- Format: plain HTML.
- Each job card is a `<div id="job-card-<jsonLdJobId>" data-id="job-card">` containing a title anchor:
  `<a href="/job/<slug>/<urlJobId>">…</a>`.
- The numeric ID in the URL (e.g. `3243894`) is **different** from the JSON-LD `identifier.value` (e.g. `4547017`). The JSON-LD identifier is the stable Built In job ID. The URL ID is a permalink/redirect ID — both deduplicate identically across reruns, but use the JSON-LD value as the canonical `sourceJobId` when present.
- Per-card extractable fields (without a detail fetch): URL, title, company, location bucket. **Not enough** for the full `ExtractedJob` (no `descriptionRaw`, no `postedAt`, no `baseSalary`).
- Detail fetch required: **yes** — the description, salary, and posted date all live on the detail page.

## Detail-page structure

- Detail HTML is ~100 KB.
- JSON-LD `JobPosting` is **present** but in two non-obvious ways:
  1. The `<script>` tag's `type` attribute is HTML-encoded: `type="application/ld&#x2B;json"` (not `application/ld+json`). A regex must match both forms.
  2. The JobPosting object is nested inside an `@graph` array on a top-level `@context` object — it is not the top-level value.
- Fields reliably populated by JSON-LD:
  - `title`, `description` (HTML-rich), `datePosted`, `validThrough`
  - `baseSalary.value` with `minValue`, `maxValue`, `unitText` (YEAR), `currency` (USD)
  - `hiringOrganization.name` (and `sameAs` for the company URL on builtin.com)
  - `jobLocation[].address` (multi-location supported: array of `Place` objects with `addressLocality`/`addressRegion`/`addressCountry`)
  - `identifier.value` — the canonical Built In job ID (numeric string)
  - `employmentType`, `industry`, `jobBenefits`, `jobLocationType` (e.g. `TELECOMMUTE`)
- Fields missing from JSON-LD: none of the `ExtractedJob` required fields.

## Unique ID source

- Primary: `JsonLd.identifier.value` (the numeric Built In job ID). Stable across re-fetches.
- Fallback (if JSON-LD is malformed): the numeric ID at the end of the URL path.

## Extraction strategy chosen

- **Strategy A — JSON-LD covers everything.** `extractBuiltInJob` parses the embedded JSON-LD JobPosting on the happy path; the LLM fallback only fires when JSON-LD is absent or has missing required fields. Expected LLM-fallback rate on the happy path: near zero.
- The plan's regex `<script[^>]*type="application/ld\+json"[^>]*>` will miss Built In's pages because the `+` is HTML-encoded as `&#x2B;`. The implementation must match both `application/ld+json` and `application/ld&#x2B;json` (case-insensitive).

## Plan-vs-reality differences

- **`type` attribute encoding:** plan assumed literal `application/ld+json`; Built In uses `application/ld&#x2B;json`. Implementation widens the regex.
- **JSON-LD nesting:** Built In wraps `JobPosting` inside `@graph: [...]`. The plan already handles this branch.
- **Listing-page link regex:** the plan's stub `/<a[^>]+href="(\/job\/[^"#?]+)"/` correctly matches the live anchor pattern `href="/job/<slug>/<numeric-id>"` — no change needed, but `jobId` should be the trailing path segment (URL slug-id), with the JSON-LD identifier preferred downstream during extract.
- **Pagination:** verified `?page=N` (1-indexed). Plan's `buildSearchUrl` is correct.
