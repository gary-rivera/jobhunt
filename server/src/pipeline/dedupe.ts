import { createHash } from 'crypto';

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function computeDedupeKey(title: string, company: string, location: string): string {
  const joined = [title, company, location].map(normalize).join('|');
  return createHash('sha256').update(joined).digest('hex');
}
