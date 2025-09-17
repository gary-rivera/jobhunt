import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { healthRouter, jobRouter, userRouter, scoreRouter } from './routes';

const app = express();

app.use(express.json());

app.use(helmet());
app.use(cors());

app.use('/health', healthRouter);
app.use('/user', userRouter);
app.use('/job', jobRouter);
app.use('/score', scoreRouter);

export default app;
