import './types';
import 'dotenv/config';
import app from './app';
import prisma from './lib/prisma';

const PORT = process.env.PORT || 3000;

console.log('Starting Server...');

const server = app.listen(PORT, async () => {
	console.log(`Server running on: http://localhost:${PORT}`);
	await testDatabaseConnection();
});

async function testDatabaseConnection() {
	try {
		await prisma.$connect();
		console.log('Database connected successfully');
	} catch (err) {
		console.error('Failed to connect to database on startup', err);
	}
}

// NOTE: only here because my local pg connection pools were intitially persisting after closing.
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown(signal: string) {
	console.log(`Starting graceful shutdown on received signal: ${signal}`);

	server.close(async () => {
		console.log('HTTP server closed');
		await prisma.$disconnect();
		process.exit(0);
	});
}
