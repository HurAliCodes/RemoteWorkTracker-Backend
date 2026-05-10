import dotenv from 'dotenv';
import logger from './config/logger';
import { setupAiReportConsumer } from './modules/ai/ai.consumer';

dotenv.config();

function validateWorkerEnv() {
	const required = ['RABBITMQ_URL', 'AI_SERVER_BASE_URL', 'AI_SERVICE_CLIENT_ID', 'AI_SERVICE_CLIENT_SECRET'];
	const missing = required.filter((key) => !process.env[key]);
	if (missing.length > 0) {
		throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
	}
}

async function startWorker() {
	try {
		validateWorkerEnv();
		await setupAiReportConsumer();
		logger.info('AI worker started');
	} catch (error) {
		logger.error('Failed to start AI worker:', error);
		process.exit(1);
	}
}

process.on('unhandledRejection', (err) => {
	logger.error('Unhandled Promise Rejection in AI worker:', err);
	process.exit(1);
});

process.on('uncaughtException', (err) => {
	logger.error('Uncaught Exception in AI worker:', err);
	process.exit(1);
});

startWorker();
