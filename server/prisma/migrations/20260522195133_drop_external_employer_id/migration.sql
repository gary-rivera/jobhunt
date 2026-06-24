-- Drop legacy external_employer_id column. The canonical identity is now
-- (source, source_job_id), unique-constrained as of multi_source_constraints.
ALTER TABLE "job_listings" DROP COLUMN "external_employer_id";
