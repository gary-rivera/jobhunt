import { Ollama, ChatResponse, ListResponse } from 'ollama';
import { OllamaConnectionError, OllamaModelError } from '../lib/errors/ollama';

const OLLAMA_LOCAL_URL = `http://localhost:${process.env.OLLAMA_PORT}`;
const ollama = new Ollama({ host: OLLAMA_LOCAL_URL });
interface OllamaModelConfig {
  name: string;
  required: boolean;
}
const ollamaLocalConfig: {
  models: Record<'embedding' | 'chat', OllamaModelConfig>;
  readonly requiredModels: string[];
} = {
  models: {
    embedding: {
      name: 'nomic-embed-text',
      required: true,
    },
    chat: {
      name: 'llama3.1:8b',
      required: false,
    },
  },
  get requiredModels(): string[] {
    return Object.values(this.models)
      .filter((model) => model.required)
      .map((model) => model.name);
  },
};
export async function checkOllamaConnection(): Promise<boolean> {
  log.info('[ollama] Checking Ollama connection health');

  const resp: ListResponse = await ollama.ps();
  const modelsCurrentlyRunning: string[] = resp.models.map((model) => model.name);

  return ollamaLocalConfig.requiredModels.every(requiredModel => modelsCurrentlyRunning.includes(requiredModel))
}

export async function generateEmbedding(text: string): Promise<number[]> {
  log.info('[ollama] Attempting to generate embedding');
  try {
    const response = await ollama.embed({
      model: 'nomic-embed-text',
      input: text,
    });

    if (!response) throw new OllamaConnectionError();

    const embedding = response.embeddings[0];

    if (!embedding) throw new OllamaModelError('No embedding returned from Ollama API');

    log.success('[ollama] Generated embedding of length:', embedding.length);
    return embedding;
  } catch (error) {
    log.error('[ollama] Error generating embedding:', error);
    throw error;
  }
}

export async function generateUserBioSummary(resume_md: string, category?: string): Promise<ChatResponse | null> {
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
    log.error('Error generating user profile summary:', error);
    return null;
  }
}

function generatePrompt(resume_md: string, category: string) {
  const categoryMap = {
    technical: {
      focusOn: 'representing the most important technical skills and tools I have',
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
	${categoryMap[category as keyof typeof categoryMap].additionalRequirements.join('\n')}
	- No additional commentary, only the summary itself

	Resume as Markdown:
	${resume_md}

	Output a single paragraph summary that maximizes semantic similarity with job postings in my field with no additional commentary, only the summary itself.
	`;
}
