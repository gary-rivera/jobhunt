import { SourceAdapter, SourceId } from './types';

const adapters = new Map<SourceId, SourceAdapter>();

export function registerAdapter(adapter: SourceAdapter): void {
  if (adapters.has(adapter.id)) {
    throw new Error(`Adapter already registered for source: ${adapter.id}`);
  }
  adapters.set(adapter.id, adapter);
}

export function getAdapter(id: SourceId): SourceAdapter {
  const adapter = adapters.get(id);
  if (!adapter) {
    throw new Error(`No adapter registered for source: ${id}`);
  }
  return adapter;
}

export function hasAdapter(id: string): id is SourceId {
  return adapters.has(id as SourceId);
}

export function listAdapters(): SourceId[] {
  return Array.from(adapters.keys());
}

// Test-only: replace a registered adapter without throwing on conflict.
export function __replaceAdapterForTest(adapter: SourceAdapter): void {
  adapters.set(adapter.id, adapter);
}
