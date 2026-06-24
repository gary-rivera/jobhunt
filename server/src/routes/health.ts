import express from 'express';
import prisma from '../lib/prisma';
import { checkOllamaConnection, OllamaHealth } from '../services/ollama';
import { HealthCheckError } from '../lib/errors';

const healthRouter = express.Router();

healthRouter.get('/', async (req, res) => {
  log.info('📝 Health Check');
  let ollama: OllamaHealth | { ok: false; error: string } | undefined;
  try {
    log.info('Checking database connection');
    const databaseOk = ((await prisma.$queryRaw`SELECT 1`) as unknown[]).length > 0;

    log.info('Checking llm connection');
    try {
      ollama = await checkOllamaConnection();
    } catch (err) {
      ollama = { ok: false, error: (err as Error).message || 'ollama unreachable' };
    }

    if (!databaseOk || !ollama.ok) {
      log.error('Required connection is failing: ', { databaseOk, ollama });
      throw new HealthCheckError('Health check found connection errors', !databaseOk, !ollama.ok);
    }

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
      ollama,
      port: process.env.PORT || 3000,
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      error: (err as Error).message || 'Unknown error',
      ollama,
      ...(err instanceof HealthCheckError && {
        databaseFailed: err.databaseFailed,
        llmFailed: err.llmFailed,
      }),
    });
  }
});

export { healthRouter };
