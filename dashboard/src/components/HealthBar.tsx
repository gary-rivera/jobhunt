import type { ReactNode } from 'react';
import type { Summary } from '../types';
import { hasError } from '../types';

function Dot({ ok }: { ok: boolean }) {
  return <span className={`dot ${ok ? 'dot-ok' : 'dot-bad'}`} />;
}

function Chip({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'muted'; children: ReactNode }) {
  return <span className={`chip chip-${tone}`}>{children}</span>;
}

export function HealthBar({ health }: { health: Summary['health'] }) {
  if (hasError(health)) {
    return <div className="bar bar-error">Health unavailable: {health.error}</div>;
  }

  const { database, ollama, runtime, metrics } = health;
  const pressure = !hasError(runtime) && runtime.memoryPressure;
  const reloads = metrics.overall.reloads;
  const chatErrors = metrics.byKind.chat.errors;
  const embedErrors = metrics.byKind.embed.errors;
  const latestError = metrics.recentErrors[0];

  return (
    <div className="bar">
      <div className="bar-chips">
        <span className="status">
          <Dot ok={database.ok} /> Postgres
        </span>
        <span className="status">
          <Dot ok={ollama.ok} /> Ollama
        </span>

        {!hasError(runtime) ? (
          <Chip tone={pressure ? 'warn' : 'ok'}>
            mem {runtime.totalResident} / {runtime.memoryBudget}
            {pressure ? ' ⚠ pressure' : ''}
          </Chip>
        ) : (
          <Chip tone="muted">runtime: {runtime.error}</Chip>
        )}

        <Chip tone={reloads > 0 ? 'warn' : 'ok'}>reloads {reloads}</Chip>
        <Chip tone={chatErrors > 0 ? 'bad' : 'muted'}>chat err {chatErrors}</Chip>
        <Chip tone={embedErrors > 0 ? 'bad' : 'muted'}>embed err {embedErrors}</Chip>
      </div>

      {!hasError(runtime) && runtime.loadedModels.length > 0 && (
        <div className="bar-models">
          loaded: {runtime.loadedModels.map((m) => `${m.name} (${m.size})`).join(', ')}
        </div>
      )}
      {ollama.missingRequired && ollama.missingRequired.length > 0 && (
        <div className="bar-models bad-text">missing models: {ollama.missingRequired.join(', ')}</div>
      )}
      {latestError && (
        <div className="bar-models bad-text">
          last ollama error ×{latestError.count}: {latestError.error}
        </div>
      )}
    </div>
  );
}
