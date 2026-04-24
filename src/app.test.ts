import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_12345678901234567890';
process.env.SUPABASE_ANON_KEY = 'sb_publishable_12345678901234567890';
process.env.VAPI_API_KEY = 'vapi_key_1234567890';
process.env.VAPI_WEBHOOK_SECRET = 'vapi_secret_1234567890';
process.env.VAPI_ASSISTANT_ID = 'assistant_12345678';
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';
process.env.ADMIN_TOKEN = 'admin_token_12345678901234567890';
process.env.RATE_LIMIT_WINDOW_MS = '60000';
process.env.RATE_LIMIT_CHAT_MAX_REQUESTS = '1';
process.env.RATE_LIMIT_ADMIN_MAX_REQUESTS = '60';
process.env.RATE_LIMIT_WEBHOOK_MAX_REQUESTS = '120';
process.env.RATE_LIMIT_MAX_REQUESTS = '1000';

const supabaseMockState = {
  callsError: null as { message: string } | null,
  leadsError: null as { message: string } | null,
  apptsError: null as { message: string } | null,
};

vi.mock('./supabase.js', () => {
  function resolveCount(table: string): { count: number; error: { message: string } | null } {
    if (table === 'calls') return { count: 12, error: supabaseMockState.callsError };
    if (table === 'leads') return { count: 7, error: supabaseMockState.leadsError };
    if (table === 'appointments') return { count: 3, error: supabaseMockState.apptsError };
    return { count: 0, error: null };
  }

  const supabase = {
    from: (table: string) => ({
      select: (_columns: string, _options?: unknown) => Promise.resolve(resolveCount(table)),
    }),
  };

  return {
    supabase,
  };
});

const adminToken = 'admin_token_12345678901234567890';

describe('app hardening', () => {
  beforeEach(() => {
    supabaseMockState.callsError = null;
    supabaseMockState.leadsError = null;
    supabaseMockState.apptsError = null;
  });

  it('rejects admin access without bearer token', async () => {
    const { createApp } = await import('./app.js');
    const app = createApp();
    const response = await request(app).get('/api/admin/stats');
    expect(response.status).toBe(401);
  });

  it('returns stats when authorized and db healthy', async () => {
    const { createApp } = await import('./app.js');
    const app = createApp();
    const response = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      calls: 12,
      leads: 7,
      appointments: 3,
    });
  });

  it('returns 500 when any stats query fails', async () => {
    supabaseMockState.callsError = { message: 'db unavailable' };
    const { createApp } = await import('./app.js');
    const app = createApp();
    const response = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Query failed' });
  });

  it('enforces chat rate limit with 429', async () => {
    const { createApp } = await import('./app.js');
    const app = createApp();
    const first = await request(app).post('/api/chat/message').send({ message: 'hello' });
    const second = await request(app).post('/api/chat/message').send({ message: 'hello again' });

    expect(first.status).not.toBe(429);
    expect(second.status).toBe(429);
    expect(second.body).toEqual({ error: 'Too many requests' });
    expect(second.headers['retry-after']).toBeDefined();
  });
});
