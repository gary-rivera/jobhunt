import express from 'express';
import prisma from '../lib/prisma';
import lodash from 'lodash';
import { generateEmbedding } from '../services/ollama';
import { formatOllamaMetrics } from '../utils/time';
import { normalizeSalaryRange } from '../utils/jobs';

const scoreRouter = express.Router();

interface LinkedInJob {
	job_id: string;
	company_name: string;
	job_url: string;
	apply_url: string;
	company_url: string;
	job_title: string;
	job_location: string;
	time_posted: string;
	num_applicants: string; // lazy parse to number later
	job_description: string;
	seniority_level:
		| 'Not Applicable'
		| 'Internship'
		| 'Entry level'
		| 'Associate'
		| 'Mid-Senior level'
		| 'Director'
		| 'Executive';
	job_function: string;
	industries: string;
	employment_type: string;
	salary_range?: string;
}

interface JobScoringCriteria
	extends Pick<
		LinkedInJob,
		| 'job_title'
		| 'job_location'
		| 'time_posted'
		| 'seniority_level'
		| 'industries'
		| 'employment_type'
	> {
	job_description_cleaned: string;
	salary: number | null; // average midpoint of min and max salary
	applicants: number | null;
}

scoreRouter.post('/generate-embedding', async (req, res) => {
	// parse job listing and run details from body
	const { job }: { job: LinkedInJob } = req.body;

	if (!job || !job.job_description || !job.num_applicants)
		return res.status(400).json({ error: 'Invalid job listing' });

	// cleanup and normalize fields
	let applicantsCount: number | null = parseInt(
		job.num_applicants.replace(/\D/g, ''),
		10
	);
	applicantsCount = isNaN(applicantsCount) ? null : applicantsCount;

	const normalizedSalary = normalizeSalaryRange(job.salary_range);
	const salaryMidrange = normalizedSalary?.midpoint || null;

	// TODO: further cleaning -> salary range, disclaimer texts,
	const cleanedDescription = job.job_description
		.replace(/\s*Show more\s*Show less\s*$/i, '')
		.trim();

	// pick fields relevant for scoring
	const scoringCriteria = lodash.pick(job, [
		'job_title',
		'job_location',
		'time_posted',
		'seniority_level',
		'industries', // 'Financial Services' is my industry matchup
	]) as JobScoringCriteria;

	scoringCriteria.applicants = applicantsCount;
	scoringCriteria.salary = salaryMidrange;
	scoringCriteria.job_description_cleaned = cleanedDescription;

	console.log('scoringCriteria', scoringCriteria);

	// generate embedding for the job description
	const embedding = await generateEmbedding(cleanedDescription);

	// TODO: better embedding failure handling
	if (embedding) {
		console.log('Ollama embedding metrics:', formatOllamaMetrics(embedding));
		// console.log('embedding', embedding);
	}

	// fetch user profile from db
	const userProfile = await prisma.userProfile.findFirst({
		where: { alias: 'dingle' },
	});

	// calculate a score based on matching criteria and vector similarity
	// return the score along with breakdown of matching criteria
	// run similarity search via pgvector cosine distance between user profile vector and job listing vectors
	// store joblistings in the db with the embedded vectors

	return res.json({ scoringCriteria, embedding });
});

// the big cowabunga - where it all comes together
scoreRouter.post('/run/batch', async (req, res) => {});

export { scoreRouter };
