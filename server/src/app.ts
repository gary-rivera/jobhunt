import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import {
  healthRouter,
  jobRouter,
  userRouter,
  scoreRouter,
  sourcesRouter,
  runsRouter,
  digestRouter,
  metricsRouter,
  dashboardRouter,
} from './routes';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// helmet's defaults break the LAN-served dashboard over plain HTTP:
//  - CSP `upgrade-insecure-requests` forces http:// subresource requests to https://,
//    which fails (no TLS on the box). Setting it to `null` removes it from the
//    merged defaults — deleting the key isn't enough, since useDefaults re-adds it.
//  - `style-src 'self'` blocks the inline styles React emits → allow 'unsafe-inline'.
//  - HSTS tells the browser to force https for this origin; wrong with no TLS, and it
//    can stick in the browser's HSTS cache. Disable it.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'upgrade-insecure-requests': null,
        'style-src': ["'self'", "'unsafe-inline'"],
      },
    },
    hsts: false,
  }),
);
app.use(cors());

app.use('/health', healthRouter);
app.use('/user', userRouter);
app.use('/job', jobRouter);
app.use('/score', scoreRouter);
app.use('/sources', sourcesRouter);
app.use('/runs', runsRouter);
app.use('/digest', digestRouter);
app.use('/metrics', metricsRouter);
app.use('/dashboard', dashboardRouter);

// Static dashboard SPA (built by the Vite app into ./public). Single page, so
// express.static serving index.html at '/' is all that's needed — no router fallback.
app.use(express.static(path.join(process.cwd(), 'public')));

app.use(errorHandler);

export default app;
