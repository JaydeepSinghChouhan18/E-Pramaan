import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env.js';
import apiRouter from './routes/index.js';
import healthRouter from './routes/health.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';

const app = express();

app.use(helmet());
app.use(cors({
  origin: [config.clientOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173'],
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
