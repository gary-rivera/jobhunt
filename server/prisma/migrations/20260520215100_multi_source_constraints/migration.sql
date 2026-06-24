-- AlterTable
ALTER TABLE "public"."job_listings" ALTER COLUMN "source" SET NOT NULL,
ALTER COLUMN "source_job_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "job_listings_dedupe_key_idx" ON "public"."job_listings"("dedupe_key");

-- CreateIndex
CREATE INDEX "job_listings_created_at_score_idx" ON "public"."job_listings"("created_at", "score");

-- CreateIndex
CREATE INDEX "job_listings_source_created_at_idx" ON "public"."job_listings"("source", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "job_listings_source_source_job_id_key" ON "public"."job_listings"("source", "source_job_id");
