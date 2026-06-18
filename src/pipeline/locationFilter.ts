export const DEFAULT_LOCATION_ALLOWLIST = ['san francisco', 'remote'];

export function getLocationAllowlist(): string[] {
  const raw = process.env.LOCATION_ALLOWLIST;
  if (!raw) return DEFAULT_LOCATION_ALLOWLIST;
  const parsed = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
  return parsed.length > 0 ? parsed : DEFAULT_LOCATION_ALLOWLIST;
}

export function matchesLocation(location: string | null | undefined, allowlist: string[]): boolean {
  if (!location) return false;
  const haystack = location.toLowerCase();
  return allowlist.some((needle) => haystack.includes(needle));
}
