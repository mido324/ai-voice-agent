import { Router } from 'express';
import { z } from 'zod';
import { timingSafeEqual } from 'node:crypto';
import { supabase } from '../supabase.js';
import { env } from '../env.js';
import { logger } from '../lib/logger.js';

export const adminRouter = Router();

adminRouter.use((req, res, next) => {
  if (!env.ADMIN_TOKEN) {
    res.status(503).json({ error: 'Admin API disabled. Set ADMIN_TOKEN in .env.' });
    return;
  }
  const auth = req.header('authorization') ?? '';
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const a = Buffer.from(provided);
  const b = Buffer.from(env.ADMIN_TOKEN);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
});

const listQuery = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

adminRouter.get('/calls', async (req, res) => {
  const q = listQuery.safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: 'Invalid query' });
    return;
  }

  const { data, error } = await supabase
    .from('calls')
    .select('id, vapi_call_id, phone_from, duration_seconds, status, transcript, created_at, ended_at')
    .order('created_at', { ascending: false })
    .range(q.data.offset, q.data.offset + q.data.limit - 1);

  if (error) {
    logger.error({ err: error }, 'Admin: list calls failed');
    res.status(500).json({ error: 'Query failed' });
    return;
  }

  res.json({ data });
});

adminRouter.get('/calls/:id', async (req, res) => {
  const id = req.params.id;
  const [callResult, summaryResult] = await Promise.all([
    supabase.from('calls').select('*').eq('id', id).maybeSingle(),
    supabase.from('call_summaries').select('*').eq('call_id', id).maybeSingle(),
  ]);

  if (callResult.error) {
    logger.error({ err: callResult.error }, 'Admin: load call failed');
    res.status(500).json({ error: 'Query failed' });
    return;
  }
  if (!callResult.data) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  res.json({ call: callResult.data, summary: summaryResult.data ?? null });
});

adminRouter.get('/leads', async (req, res) => {
  const q = listQuery.safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: 'Invalid query' });
    return;
  }

  const { data, error } = await supabase
    .from('leads')
    .select('id, name, phone, email, intent, service_interest, source, call_id, captured_at')
    .order('captured_at', { ascending: false })
    .range(q.data.offset, q.data.offset + q.data.limit - 1);

  if (error) {
    logger.error({ err: error }, 'Admin: list leads failed');
    res.status(500).json({ error: 'Query failed' });
    return;
  }

  res.json({ data });
});

adminRouter.get('/appointments', async (req, res) => {
  const q = listQuery.safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: 'Invalid query' });
    return;
  }

  const { data, error } = await supabase
    .from('appointments')
    .select('id, customer_name, phone, service, scheduled_for, status, agent_assigned, created_at')
    .order('scheduled_for', { ascending: true })
    .range(q.data.offset, q.data.offset + q.data.limit - 1);

  if (error) {
    logger.error({ err: error }, 'Admin: list appointments failed');
    res.status(500).json({ error: 'Query failed' });
    return;
  }

  res.json({ data });
});

adminRouter.get('/stats', async (_req, res) => {
  const [calls, leads, appts] = await Promise.all([
    supabase.from('calls').select('id', { count: 'exact', head: true }),
    supabase.from('leads').select('id', { count: 'exact', head: true }),
    supabase.from('appointments').select('id', { count: 'exact', head: true }),
  ]);

  if (calls.error || leads.error || appts.error) {
    logger.error(
      {
        callsError: calls.error,
        leadsError: leads.error,
        appointmentsError: appts.error,
      },
      'Admin: stats query failed',
    );
    res.status(500).json({ error: 'Query failed' });
    return;
  }

  res.json({
    calls: calls.count ?? 0,
    leads: leads.count ?? 0,
    appointments: appts.count ?? 0,
  });
});
