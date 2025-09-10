import { add } from 'lodash';
import { Ollama, EmbedResponse, ChatResponse } from 'ollama';
const ollama = new Ollama({ host: 'http://localhost:11434' });

export async function generateEmbedding(
	text: string
): Promise<EmbedResponse | null> {
	try {
		const response = await ollama.embed({
			model: 'nomic-embed-text',
			input: text,
		});
		if (response) {
			return response;
		}
		return null;
	} catch (error) {
		console.error('Error generating embedding:', error);
		return null;
	}
}

export async function generateUserProfileSummary(
	resume_md: string,
	category?: string
): Promise<ChatResponse | null> {
	const prompt = generatePrompt(resume_md, category || 'technical');
	try {
		const response = await ollama.chat({
			model: 'llama3.1:8b',
			messages: [
				{
					role: 'user',
					content: prompt,
				},
			],
		});
		if (response) {
			return response;
		}
		return null;
	} catch (error) {
		console.error('Error generating user profile summary:', error);
		return null;
	}
}

function generatePrompt(resume_md: string, category: string) {
	const categoryMap = {
		technical: {
			focusOn:
				'representing the most important technical skills and tools I have',
			additionalRequirements: [],
		},
		industry: {
			focusOn: 'capturing what industries I have experience in',
			additionalRequirements: [
				'- Include that I have experience in early-stage startups with high growth',
				'- Mention experience in both B2B and B2C environments',
				'- Highlight working FinTech and SaaS sectors specifically, namely credit building, mortgages, banking, and developer tools',
			],
		},
		tenure: {
			focusOn: 'duration and progression of roles',
			additionalRequirements: [],
		},
	};

	return `Transform this resume markdown into a paragraph summary optimized for job matching.

	Requirements:
	- Use language commonly found in job descriptions (not resume language)
	- Include specific technologies, years of experience, and quantifiable details
	- Write in descriptive paragraphs, not bullet points
	- Focus on ${categoryMap[category as keyof typeof categoryMap].focusOn}
	${categoryMap[category as keyof typeof categoryMap].additionalRequirements.join(
		'\n'
	)}
	- No additional commentary, only the summary itself

	Resume as Markdown:
	${resume_md}

	Output a single paragraph summary that maximizes semantic similarity with job postings in my field with no additional commentary, only the summary itself.
	`;
}
