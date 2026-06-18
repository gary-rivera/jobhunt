-- CreateEnum
CREATE TYPE "public"."job_source" AS ENUM ('WTTJ', 'LINKEDIN_APIFY', 'BUILT_IN', 'INDEED', 'LINKEDIN');

-- CreateEnum
CREATE TYPE "public"."job_scrape_run_status" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "public"."job_listings" ADD COLUMN     "dedupe_key" TEXT,
ADD COLUMN     "job_scrape_run_id" INTEGER,
ADD COLUMN     "source" "public"."job_source",
ADD COLUMN     "source_job_id" TEXT,
ALTER COLUMN "apply_to_url" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public"."job_scrape_runs" (
    "id" SERIAL NOT NULL,
    "source" "public"."job_source" NOT NULL,
    "status" "public"."job_scrape_run_status" NOT NULL DEFAULT 'RUNNING',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "total_fetched" INTEGER,
    "total_extracted" INTEGER,
    "total_saved" INTEGER,
    "total_skipped" INTEGER,
    "total_failed" INTEGER,
    "error_message" TEXT,

    CONSTRAINT "job_scrape_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_scrape_runs_source_started_at_idx" ON "public"."job_scrape_runs"("source", "started_at");

-- AddForeignKey
ALTER TABLE "public"."job_listings" ADD CONSTRAINT "job_listings_job_scrape_run_id_fkey" FOREIGN KEY ("job_scrape_run_id") REFERENCES "public"."job_scrape_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- BACKFILL: existing rows are all legacy LinkedIn/Apify
UPDATE "public"."job_listings"
SET
  "source" = 'LINKEDIN_APIFY'::"public"."job_source",
  "source_job_id" = REPLACE("external_employer_id", 'n8n/linkedin-', '')
WHERE "source" IS NULL;
