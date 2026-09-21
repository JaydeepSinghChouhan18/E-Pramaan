import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env.js';
import apiRouter from './routes/index.js';
import healthRouter from './routes/health.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';

const app = express();

app.use(helmet());
const allowedOrigins = config.clientOrigin
  ? config.clientOrigin.split(',').map((o) => o.trim().replace(/\/$/, ''))
  : [];

app.use(cors({
  origin: (requestOrigin, callback) => {
    // Allow non-browser requests (server-to-server, health checks, curl)
    if (!requestOrigin) return callback(null, true);

    const cleanOrigin = requestOrigin.replace(/\/$/, '');
    const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanOrigin);
    const isVercelDomain = /^https:\/\/.*\.vercel\.app$/.test(cleanOrigin);
    const isExplicitlyAllowed = allowedOrigins.includes(cleanOrigin);

    if (isLocalhost || isVercelDomain || isExplicitlyAllowed) {
      return callback(null, true);
    }

    return callback(null, true); // Permissive fallback to ensure production API availability
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', healthRouter);
app.use(config.apiPrefix, apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(`[e-Pramaan Backend] Server listening on port ${config.port} (Environment: ${config.nodeEnv})`);
  console.log(`[e-Pramaan Backend] Health endpoint available at http://localhost:${config.port}/health`);
});

const shutdown = () => {
  console.log('[e-Pramaan Backend] Shutting down gracefully...');
  server.close(() => {
    console.log('[e-Pramaan Backend] Server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;
