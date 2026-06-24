import type { Summary } from '../types';
import { hasError } from '../types';
import { fmtScore, fmtSalary } from '../utils';

export function CandidateList({ digest }: { digest: Summary['digest'] }) {
  if (hasError(digest)) {
    return (
      <section className="card">
        <h2>Today&apos;s candidates</h2>
        <div className="bar-error">Unavailable: {digest.error}</div>
      </section>
    );
  }

  const { totals, listings } = digest;
  const bySource = Object.entries(totals.bySource);

  return (
    <section className="card">
      <div className="card-head">
        <h2>Today&apos;s candidates</h2>
        <span className="muted-text">
          {totals.candidates} unique (≥0.6) · {totals.beforeCollapse} before dedupe
        </span>
      </div>

      {bySource.length > 0 && (
        <div className="bysource">
          {bySource.map(([src, n]) => (
            <span key={src} className="chip chip-muted">
              {src} {n}
            </span>
          ))}
        </div>
      )}

      {listings.length === 0 ? (
        <div className="muted-text empty">No candidates scored ≥ 0.6 today.</div>
      ) : (
        <ul className="candidates">
          {listings.map((c) => {
            const salary = fmtSalary(c.salaryMidpointUsd);
            const href = c.applyToUrl || c.listingUrl;
            return (
              <li key={c.id} className="candidate">
                <span className="score-badge">{fmtScore(c.score)}</span>
                <div className="candidate-body">
                  <div className="candidate-title">
                    {c.title} <span className="at">@</span> {c.company}
                  </div>
                  <div className="candidate-sub">
                    <span>{c.location}</span>
                    {salary && <span>· {salary}</span>}
                    <span className="chip chip-muted">{c.source}</span>
                    {c.alsoSeenOn?.map((s) => (
                      <span key={s} className="chip chip-muted">
                        also {s}
                      </span>
                    ))}
                  </div>
                </div>
                <a className="apply" href={href} target="_blank" rel="noreferrer">
                  Apply →
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
