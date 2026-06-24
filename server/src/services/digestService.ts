import prisma from '../lib/prisma';
import { JobSource } from '@prisma/client';
import { ValidationError } from '../lib/errors';

export interface DigestOpts {
  minScore: number;
  limit: number;
  source?: JobSource;
}

export function parseDate(raw: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new ValidationError('Date must be YYYY-MM-DD');
  }
  const [y, m, d] = raw.split('-').map(Number);
  const date = new Date(y, m - 1, d, 0, 0, 0, 0);
  if (isNaN(date.getTime())) throw new ValidationError('Invalid date');
  return date;
}

function dayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export interface RawListingRow {
  id: number;
  source: string;
  sourceJobId: string;
  dedupeKey: string | null;
  title: string;
  company: string;
  location: string;
  listingUrl: string;
  applyToUrl: string | null;
  salaryMidpointUsd: number | null;
  score: number | null;
  postedAt: Date | null;
}

export interface CollapsedListing extends RawListingRow {
  alsoSeenOn?: string[];
}

function collapseByDedupeKey(rows: RawListingRow[]): CollapsedListing[] {
  const groups = new Map<string, RawListingRow[]>();
  const ungrouped: RawListingRow[] = [];

  for (const row of rows) {
    if (!row.dedupeKey) {
      ungrouped.push(row);
      continue;
    }
    const bucket = groups.get(row.dedupeKey);
    if (bucket) bucket.push(row);
    else groups.set(row.dedupeKey, [row]);
  }

  const collapsed: CollapsedListing[] = [];

  for (const bucket of groups.values()) {
    bucket.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const primary = bucket[0];
    const otherSources = Array.from(
      new Set(bucket.slice(1).map((r) => r.source).filter((s) => s !== primary.source)),
    );
    collapsed.push(otherSources.length > 0 ? { ...primary, alsoSeenOn: otherSources } : primary);
  }

  for (const row of ungrouped) collapsed.push(row);

  collapsed.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return collapsed;
}

export async function buildDigest(date: Date, opts: DigestOpts) {
  const { start, end } = dayBounds(date);

  const rawListings = await prisma.jobListing.findMany({
    where: {
      createdAt: { gte: start, lt: end },
      score: { gte: opts.minScore },
      ...(opts.source ? { source: opts.source } : {}),
    },
    select: {
      id: true,
      source: true,
      sourceJobId: true,
      dedupeKey: true,
      title: true,
      company: true,
      location: true,
      listingUrl: true,
      applyToUrl: true,
      salaryMidpointUsd: true,
      score: true,
      postedAt: true,
    },
    orderBy: { score: 'desc' },
  });

  const collapsed = collapseByDedupeKey(rawListings);
  const limited = collapsed.slice(0, opts.limit);

  const bySource: Record<string, number> = {};
  for (const l of limited) bySource[l.source] = (bySource[l.source] || 0) + 1;

  const runs = await prisma.jobScrapeRun.findMany({
    where: {
      startedAt: { gte: start, lt: end },
      ...(opts.source ? { source: opts.source } : {}),
    },
    orderBy: { startedAt: 'desc' },
  });

  return {
    date: start.toISOString().slice(0, 10),
    generatedAt: new Date().toISOString(),
    filters: { minScore: opts.minScore, limit: opts.limit, source: opts.source || null },
    totals: {
      candidates: limited.length,
      beforeCollapse: rawListings.length,
      bySource,
    },
    runs,
    listings: limited,
  };
}
