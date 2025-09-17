import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { healthRouter, scoreRouter, userRouter } from './routes';

import { sendNotFoundError } from './utils/error';
import { healthRouter, jobRouter, userRouter, scoreRouter } from './routes';

const app = express();

app.use(express.json());

app.use(helmet());
app.use(cors());

app.use('/health', healthRouter);
app.use('/user', userRouter);
// app.use('/profile', userProfileRouter);
app.use('/job', jobRouter);

export default app;
