# LinkedIn no-login adapter — research findings

Captured: 2026-05-22
Recon script: `scripts/linkedin-recon.ts` (re-runnable)

## seeMoreJobPostings endpoint
- URL: `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search`
- Plain `fetch()` with realistic User-Agent: status 200
- Returns HTML fragment (28922 bytes); contains 10 unique job cards.

## Listing-card extraction
- Selector: `data-entity-urn="urn:li:jobPosting:<jobId>"` (primary selector confirmed present; `data-job-id` alt not needed).
- Per-card URL convention: `https://www.linkedin.com/jobs/view/<jobId>/`.
- Per-card sub-selectors verified present in fixture:
  - title: `base-search-card__title`
  - company: `base-search-card__subtitle`
  - location: `job-search-card__location`
  - postedAtRaw: `job-search-card__listdate` (also `job-search-card__listdate--new` variant present)
  - snippet: `job-search-card__snippet` — **NOT PRESENT** in current fixture. The listing fragment does not include snippet text. Plan should not rely on this field from listing cards.

## Detail-page rendering
- Playwright headless navigates to `/jobs/view/<id>/` without auth.
- Result: reached (no login wall encountered)
- JSON-LD present: false
- JSON-LD required fields complete: false
- Detail page exposes job content via HTML class selectors, not JSON-LD:
  - Title: `topcard__title` (also `top-card-layout__title`)
  - Company: `topcard__org-name-link`
  - Location: `topcard__flavor` + `topcard__flavor-row`
  - Description: `description__text description__text--rich`
  - Date posted: `posted-time-ago__text`
  - Criteria (seniority, type, function): `description__job-criteria-item` / `description__job-criteria-text`

## Notes
- No PII (emails, member profile URLs) found in either fixture; no sanitization was necessary.
- `job-search-card__snippet` class absent from listing fragment — do not assume snippet data from listing phase.
- JSON-LD is absent on detail pages (LinkedIn removed structured data); extraction must rely on HTML selectors or LLM fallback.
- Two listdate class variants observed: `job-search-card__listdate` and `job-search-card__listdate--new` — parser should handle both.

## Decision
- JSON-LD-first strategy not viable (no JSON-LD present); pivot to HTML-selector extraction with LLM fallback for description/criteria.
- Graceful-degrade to listing-only fields (title, company, location, date, URL) if detail page becomes login-walled in future runs.

## Phase 0 gate
- seeMore listing reachable via plain HTTP: yes
- Detail page reachable (or wall-then-degrade): yes
- Proceeding to Phase 2.
