-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "public"."JobScrapeRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "public"."job_listings" (
    "id" TEXT NOT NULL,
    "job_scrape_run_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "source" TEXT,
    "location" TEXT,
    "salary_range" TEXT,
    "listing_url" TEXT NOT NULL,
    "apply_to_url" TEXT,
    "description_raw" TEXT NOT NULL,
    "description_cleaned" TEXT NOT NULL,
    "description_embedding" vector(768),
    "skills_found" TEXT[],
    "seniority" TEXT,
    "overall_score" DOUBLE PRECISION,
    "technical_match" DOUBLE PRECISION,
    "experience_match" DOUBLE PRECISION,
    "industry_match" DOUBLE PRECISION,
    "scraped_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."job_scrape_runs" (
    "id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "total_scraped" INTEGER,
    "after_filtering" INTEGER,
    "status" "public"."JobScrapeRunStatus" NOT NULL DEFAULT 'RUNNING',
    "error_message" TEXT,

    CONSTRAINT "job_scrape_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_profiles" (
    "id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "bio" TEXT,
    "bio_embedding" vector(768),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_listings_source_key" ON "public"."job_listings"("source");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_alias_key" ON "public"."user_profiles"("alias");

-- AddForeignKey
ALTER TABLE "public"."job_listings" ADD CONSTRAINT "job_listings_job_scrape_run_id_fkey" FOREIGN KEY ("job_scrape_run_id") REFERENCES "public"."job_scrape_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
