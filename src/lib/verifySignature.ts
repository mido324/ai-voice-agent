import type { RequestHandler } from 'express';
import { timingSafeEqual } from 'node:crypto';
import twilio from 'twilio';
import { env } from '../env.js';
import { logger } from './logger.js';

/**
 * Twilio sends an X-Twilio-Signature header computed from the full webhook URL
 * and the raw form-encoded body. Requires the body to be parsed as urlencoded
 * before reaching this middleware.
 */
export const verifyTwilioSignature: RequestHandler = (req, res, next) => {
  const authToken = env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    logger.warn('Twilio webhook hit but TWILIO_AUTH_TOKEN not configured');
    res.status(503).send('Twilio integration not configured');
    return;
  }

  const signature = req.header('X-Twilio-Signature');
  const url = env.PUBLIC_BASE_URL.replace(/\/$/, '') + req.originalUrl;
  const params = (req.body ?? {}) as Record<string, string>;

  if (!signature) {
    logger.warn({ url }, 'Twilio webhook missing signature');
    res.status(403).send('Forbidden');
    return;
  }

  const valid = twilio.validateRequest(authToken, signature, url, params);
  if (!valid) {
    logger.warn({ url }, 'Twilio signature verification failed');
    res.status(403).send('Forbidden');
    return;
  }

  next();
};

/**
 * Vapi sends a shared secret in a request header (configured in the Vapi
 * dashboard when setting up the server URL). Compare with constant-time.
 */
export const verifyVapiSecret: RequestHandler = (req, res, next) => {
  const provided = req.header('x-vapi-secret') ?? req.header('X-Vapi-Secret') ?? '';
  const expected = env.VAPI_WEBHOOK_SECRET;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    logger.warn({ path: req.path }, 'Vapi secret verification failed');
    res.status(403).send('Forbidden');
    return;
  }

  next();
};
