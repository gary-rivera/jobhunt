import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { healthRouter, scoreRouter, userRouter } from './routes';

import { sendNotFoundError } from './utils/error';

const app = express();

app.use(express.json());

app.use(helmet());
app.use(cors());

app.use('/health', healthRouter);
app.use('/user', userRouter);
app.use('/jobs', scoreRouter);
// app.use('/profile', userProfileRouter);

export default app;
