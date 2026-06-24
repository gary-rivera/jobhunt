import type { SourceCardData } from '../types';
import { timeAgo, fmtDuration } from '../utils';

export function SourceCard({ data }: { data: SourceCardData }) {
  const run = data.lastRun;

  if (!run) {
    return (
      <div className="source-card">
        <div className="source-head">
          <span className="source-name">{data.source}</span>
          <span className="chip chip-muted">never run</span>
        </div>
      </div>
    );
  }

  const statusTone = run.orphaned
    ? 'bad'
    : run.status === 'COMPLETED'
      ? 'ok'
      : run.status === 'FAILED'
        ? 'bad'
        : 'warn';
  const failed = run.totalFailed ?? 0;

  return (
    <div className={`source-card ${statusTone === 'bad' ? 'source-card-bad' : ''}`}>
      <div className="source-head">
        <span className="source-name">{data.source}</span>
        <span className={`chip chip-${statusTone}`}>
          {run.orphaned ? 'ORPHANED' : run.status}
        </span>
      </div>

      <div className="source-meta">
        <span>started {timeAgo(run.startedAt)}</span>
        <span>·</span>
        <span>{run.status === 'RUNNING' ? 'in progress' : fmtDuration(run.durationMs)}</span>
      </div>

      <div className="funnel">
        <Stat label="fetched" value={run.totalFetched} />
        <span className="arrow">→</span>
        <Stat label="extracted" value={run.totalExtracted} />
        <span className="arrow">→</span>
        <Stat label="saved" value={run.totalSaved} />
        <Stat label="skipped" value={run.totalSkipped} muted />
        <Stat label="failed" value={run.totalFailed} bad={failed > 0} />
      </div>

      {run.orphaned && (
        <div className="source-warn">⚠ stuck RUNNING past the orphan timeout — likely a crash</div>
      )}
      {run.errorMessage && <div className="source-warn">{run.errorMessage}</div>}
    </div>
  );
}

function Stat({
  label,
  value,
  bad,
  muted,
}: {
  label: string;
  value: number | null;
  bad?: boolean;
  muted?: boolean;
}) {
  return (
    <span className={`stat ${bad ? 'stat-bad' : ''} ${muted ? 'stat-muted' : ''}`}>
      <span className="stat-value">{value ?? '—'}</span>
      <span className="stat-label">{label}</span>
    </span>
  );
}
