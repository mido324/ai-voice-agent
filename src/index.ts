import express from 'express';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { env } from './env.js';
import { logger } from './lib/logger.js';
import { twilioRouter } from './webhooks/twilio.js';
import { vapiRouter } from './webhooks/vapi.js';
import { toolsRouter } from './tools/router.js';
import { chatRouter } from './api/chat.js';
import { adminRouter } from './api/admin.js';

const app = express();

app.use(cors());
app.use(pinoHttp({ logger }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'ai-voice-agent' });
});

app.use('/webhooks/twilio', twilioRouter);
app.use('/webhooks/vapi', vapiRouter);
app.use('/tools', toolsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/admin', adminRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ ok: false });
});

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Server listening');
});

function shutdown(signal: string): void {
  logger.info({ signal }, 'Shutting down');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
