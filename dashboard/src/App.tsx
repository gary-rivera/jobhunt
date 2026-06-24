import { useEffect, useRef, useState } from 'react';
import { fetchSummary } from './api';
import type { Summary } from './types';
import { hasError } from './types';
import { fmtClock } from './utils';
import { HealthBar } from './components/HealthBar';
import { SourceCard } from './components/SourceCard';
import { CandidateList } from './components/CandidateList';

const REFRESH_MS = 20_000;

export default function App() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const data = await fetchSummary(ctrl.signal);
        if (!active) return;
        setSummary(data);
        setError(null);
        setUpdatedAt(new Date().toISOString());
      } catch (err) {
        if (!active || (err instanceof DOMException && err.name === 'AbortError')) return;
        setError(err instanceof Error ? err.message : String(err));
      }
    }

    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Job Hunter</h1>
        <div className="app-status">
          {error ? (
            <span className="bad-text">unreachable — {error}</span>
          ) : updatedAt ? (
            <span className="muted-text">updated {fmtClock(updatedAt)}</span>
          ) : (
            <span className="muted-text">loading…</span>
          )}
        </div>
      </header>

      {!summary && !error && <div className="muted-text empty">Fetching status…</div>}

      {summary && (
        <>
          <HealthBar health={summary.health} />

          <section className="card">
            <div className="card-head">
              <h2>Sources</h2>
              <span className="muted-text">orphan timeout {summary.orphanTimeoutMin}m</span>
            </div>
            {hasError(summary.sources) ? (
              <div className="bar-error">Unavailable: {summary.sources.error}</div>
            ) : (
              <div className="source-grid">
                {summary.sources.map((s) => (
                  <SourceCard key={s.source} data={s} />
                ))}
              </div>
            )}
          </section>

          <CandidateList digest={summary.digest} />
        </>
      )}
    </div>
  );
}
