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
import { createRateLimiter } from './middleware/rateLimit.js';

function parseCorsAllowlist(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function createCorsOptions(): cors.CorsOptions {
  const allowlist = parseCorsAllowlist(env.CORS_ALLOWED_ORIGINS);
  if (allowlist.length === 0) {
    return {};
  }

  const allowed = new Set(allowlist);
  return {
    origin(origin, callback) {
      if (!origin || allowed.has(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
  };
}

export function createApp(): express.Express {
  const app = express();

  app.use(cors(createCorsOptions()));
  app.use(pinoHttp({ logger }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'ai-voice-agent' });
  });

  app.use(
    '/webhooks',
    createRateLimiter({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      maxRequests: env.RATE_LIMIT_WEBHOOK_MAX_REQUESTS,
      keyPrefix: 'webhooks',
    }),
  );
  app.use(
    '/tools',
    createRateLimiter({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      maxRequests: env.RATE_LIMIT_WEBHOOK_MAX_REQUESTS,
      keyPrefix: 'tools',
    }),
  );
  app.use(
    '/api/chat',
    createRateLimiter({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      maxRequests: env.RATE_LIMIT_CHAT_MAX_REQUESTS,
      keyPrefix: 'chat',
    }),
  );
  app.use(
    '/api/admin',
    createRateLimiter({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      maxRequests: env.RATE_LIMIT_ADMIN_MAX_REQUESTS,
      keyPrefix: 'admin',
    }),
  );
  app.use(
    createRateLimiter({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
      keyPrefix: 'global',
    }),
  );

  app.use('/webhooks/twilio', twilioRouter);
  app.use('/webhooks/vapi', vapiRouter);
  app.use('/tools', toolsRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/admin', adminRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({ err }, 'Unhandled error');
    res.status(500).json({ ok: false });
  });

  return app;
}
