import { pino, type LoggerOptions } from 'pino';
import { env } from '../env.js';

const isDev = env.NODE_ENV !== 'production';

const baseOptions: LoggerOptions = {
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'phone',
      'phone_from',
      'From',
      'To',
      'customer.number',
      '*.phone',
      '*.phone_from',
      'req.headers.authorization',
      'req.headers["x-twilio-signature"]',
      'req.headers["x-vapi-secret"]',
    ],
    censor: '[redacted]',
  },
};

export const logger = pino(
  isDev
    ? {
        ...baseOptions,
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
        },
      }
    : baseOptions,
);
