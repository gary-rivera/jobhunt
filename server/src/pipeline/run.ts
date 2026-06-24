import prisma from '../lib/prisma';
import { getAdapter } from '../sources/registry';
import { SearchParams, SourceId, toJobSourceEnum } from '../sources/types';
import { generateEmbedding } from '../services/ollama';
import { getUserByAlias } from '../services/userService';
import { cosineSimilarity } from '../utils/scoring';
import { computeDedupeKey } from './dedupe';
import { getLocationAllowlist, matchesLocation } from './locationFilter';
import { completeRun, failRun, RunTotals } from '../services/jobScrapeRunService';
import { summarizeSince } from '../services/ollamaMetrics';

export async function runSource(
  runId: number,
  sourceId: SourceId,
  params: SearchParams,
): Promise<void> {
  const adapter = getAdapter(sourceId);
  const enumSource = toJobSourceEnum(sourceId);
  const user = await getUserByAlias(process.env.DEFAULT_USER_ALIAS || 'dingle');
  const locationAllowlist = getLocationAllowlist();
  log.info('[pipeline] location allowlist', { runId, sourceId, allowlist: locationAllowlist });

  const totals: RunTotals = {
    totalFetched: 0,
    totalExtracted: 0,
    totalSaved: 0,
    totalSkipped: 0,
    totalFailed: 0,
  };
  const startedAt = Date.now();

  try {
    const rawListings = await adapter.fetch(params);
    totals.totalFetched = rawListings.length;
    log.info('[pipeline] fetched listings', { runId, sourceId, count: totals.totalFetched });

    for (const raw of rawListings) {
      try {
        const existing = await prisma.jobListing.findUnique({
          where: { source_sourceJobId: { source: enumSource, sourceJobId: raw.sourceJobId } },
        });
        if (existing) {
          totals.totalSkipped++;
          continue;
        }

        const ext = await adapter.extract(raw);
        totals.totalExtracted++;

        if (!matchesLocation(ext.location, locationAllowlist)) {
          totals.totalSkipped++;
          log.info('[pipeline] skipped by location filter', {
            runId,
            sourceId,
            sourceJobId: ext.sourceJobId,
            location: ext.location,
          });
          continue;
        }

        const embedding = await generateEmbedding(ext.descriptionCleaned);
        const score = cosineSimilarity(user.bioEmbedding, embedding);
        const dedupeKey = computeDedupeKey(ext.title, ext.company, ext.location);

        await prisma.jobListing.create({
          data: {
            source: enumSource,
            sourceJobId: ext.sourceJobId,
            dedupeKey,
            title: ext.title,
            company: ext.company,
            location: ext.location,
            listingUrl: ext.sourceUrl,
            applyToUrl: ext.applyUrl,
            salaryMidpointUsd: ext.salaryMidpointUsd,
            totalApplicants: ext.totalApplicants,
            descriptionRaw: ext.descriptionRaw,
            descriptionCleaned: ext.descriptionCleaned,
            descriptionEmbedding: embedding,
            score,
            postedAt: ext.postedAt,
            scrapedAt: new Date(),
            jobScrapeRunId: runId,
          },
        });
        totals.totalSaved++;
      } catch (err) {
        totals.totalFailed++;
        log.error('[pipeline] per-listing failure', {
          runId,
          sourceId,
          rawId: raw.sourceJobId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await completeRun(runId, totals);
    const ollamaStats = summarizeSince(startedAt);
    if (ollamaStats.reloads > 0) {
      log.warn('[pipeline] ollama reloaded model mid-run — possible memory pressure', {
        runId,
        sourceId,
        reloads: ollamaStats.reloads,
        loadMsMax: ollamaStats.loadMsMax,
      });
    }
    log.success('[pipeline] run completed', {
      runId,
      sourceId,
      totals,
      durationMs: Date.now() - startedAt,
      ollama: ollamaStats,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failRun(runId, totals, message);
    log.error('[pipeline] run failed', { runId, sourceId, totals, error: message });
    throw err;
  }
}
