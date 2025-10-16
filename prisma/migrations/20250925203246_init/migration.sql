-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "public"."job_listings" (
    "id" SERIAL NOT NULL,
    "external_employer_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "listing_url" TEXT NOT NULL,
    "apply_to_url" TEXT NOT NULL,
    "salary_midpoint_usd" INTEGER,
    "total_applicants" INTEGER,
    "description_raw" TEXT NOT NULL,
    "description_cleaned" TEXT NOT NULL,
    "description_embedding" DOUBLE PRECISION[],
    "score" DOUBLE PRECISION,
    "posted_at" TIMESTAMP(3),
    "scraped_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" SERIAL NOT NULL,
    "alias" TEXT NOT NULL,
    "bio" TEXT,
    "bio_embedding" DOUBLE PRECISION[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_alias_key" ON "public"."users"("alias");
