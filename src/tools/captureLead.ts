import type { Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../supabase.js';
import { logger } from '../lib/logger.js';
import { upsertLead } from '../services/leads.js';

const argsSchema = z.object({
  name: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(6),
  email: z.string().trim().email().optional(),
  intent: z.string().trim().min(1).optional(),
  service_interest: z.string().trim().min(1).optional(),
});

const toolCallSchema = z.object({
  id: z.string(),
  function: z.object({
    name: z.string(),
    arguments: z.union([z.string(), z.record(z.unknown())]),
  }),
});

const envelope = z.object({
  message: z
    .object({
      type: z.string(),
      toolCallList: z.array(toolCallSchema).optional(),
      toolCalls: z.array(toolCallSchema).optional(),
      call: z.object({ id: z.string() }).passthrough().optional(),
    })
    .passthrough(),
});

function parseArgs(raw: string | Record<string, unknown>): Record<string, unknown> {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return raw;
}

async function resolveCallId(vapiCallId: string | undefined): Promise<string | undefined> {
  if (!vapiCallId) return undefined;
  const { data } = await supabase
    .from('calls')
    .select('id')
    .eq('vapi_call_id', vapiCallId)
    .maybeSingle();
  return data?.id;
}

export async function captureLeadHandler(req: Request, res: Response): Promise<void> {
  const parsed = envelope.safeParse(req.body);
  if (!parsed.success) {
    logger.warn({ issues: parsed.error.issues }, 'capture_lead payload invalid');
    res.status(400).json({ results: [] });
    return;
  }

  const { message } = parsed.data;
  const toolCalls = message.toolCallList ?? message.toolCalls ?? [];
  const callId = await resolveCallId(message.call?.id);

  const results = await Promise.all(
    toolCalls.map(async (tc) => {
      if (tc.function.name !== 'capture_lead') {
        return { toolCallId: tc.id, result: `Unknown tool: ${tc.function.name}` };
      }

      const args = argsSchema.safeParse(parseArgs(tc.function.arguments));
      if (!args.success) {
        return {
          toolCallId: tc.id,
          result: `Invalid arguments: ${args.error.issues.map((i) => i.message).join('; ')}`,
        };
      }

      try {
        const lead = await upsertLead({
          ...args.data,
          source: 'voice',
          call_id: callId,
        });
        return {
          toolCallId: tc.id,
          result: `Lead saved (id: ${lead.id}). Continue the conversation naturally.`,
        };
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : typeof err === 'object' && err !== null && 'message' in err
              ? String((err as { message: unknown }).message)
              : 'unknown error';
        logger.error({ err }, 'capture_lead handler failed');
        return { toolCallId: tc.id, result: `Failed to save lead: ${message}` };
      }
    }),
  );

  res.json({ results });
}
