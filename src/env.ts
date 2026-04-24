import { config } from 'dotenv';
import { z } from 'zod';

config();

const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SUPABASE_ANON_KEY: z.string().min(20),

  TWILIO_ACCOUNT_SID: z.string().startsWith('AC').optional().or(z.literal('')),
  TWILIO_AUTH_TOKEN: z.string().min(20).optional().or(z.literal('')),
  TWILIO_PHONE_NUMBER: z.string().min(8).optional().or(z.literal('')),

  VAPI_API_KEY: z.string().min(10),
  VAPI_WEBHOOK_SECRET: z.string().min(16),
  VAPI_ASSISTANT_ID: z.string().min(8),
  VAPI_PHONE_SIP: z.string().startsWith('sip:').optional().or(z.literal('')),

  OPENAI_API_KEY: z.string().startsWith('sk-').optional().or(z.literal('')),
  OPENAI_SUMMARY_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_CHAT_MODEL: z.string().default('gpt-4o-mini'),

  ADMIN_TOKEN: z.string().min(16).optional().or(z.literal('')),

  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  PUBLIC_BASE_URL: z.string().url(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  console.error(`Invalid environment variables:\n${issues}\n\nCopy env.example to .env and fill in the missing values.`);
  process.exit(1);
}

export const env = parsed.data;
