import express from 'express';
import prisma from '../lib/prisma';

const healthRouter = express.Router();

healthRouter.get('/', async (req, res) => {
	console.log('📝 Health Check');
	try {
		await prisma.$queryRaw`SELECT 1`;

		res.json({
			status: 'ok',
			timestamp: new Date().toISOString(),
			database: 'connected',
			port: process.env.PORT || 3000,
		});
	} catch (err) {
		res.status(503).json({
			status: 'error',
			database: 'disconnected',
			error: (err as Error).message || 'Database connection failed',
		});
	}
});

export { healthRouter };
