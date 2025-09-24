import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { healthRouter, jobRouter, userRouter, scoreRouter } from './routes';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(helmet());
app.use(cors());

app.use('/health', healthRouter);
app.use('/user', userRouter);
app.use('/job', jobRouter);
app.use('/score', scoreRouter);

app.use(errorHandler);

export default app;
