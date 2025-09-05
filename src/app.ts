import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { healthRouter } from './routes';
import { sendNotFoundError } from './utils/error';

const app = express();

app.use(express.json());

app.use(helmet());
app.use(cors());

app.use('/health', healthRouter);

app.use('/api', (req, res) => {
	if (req.path === '/') {
		return res.json({ message: 'API base path - use specific endpoints' });
	}
	return sendNotFoundError(res, 'API endpoint');
});

export default app;
