import type { Summary } from './types';

// In production the SPA is served by Express itself, so requests are same-origin.
// In `vite dev` they cross to the API on the LAN box.
export const API_BASE = import.meta.env.DEV ? 'http://10.0.0.23:3000' : '';

export async function fetchSummary(signal?: AbortSignal): Promise<Summary> {
  const res = await fetch(`${API_BASE}/dashboard/summary`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<Summary>;
}
