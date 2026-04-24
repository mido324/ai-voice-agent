import type { Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../lib/logger.js';
import { getAvailableSlots } from '../services/appointments.js';

const argsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
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

function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return 'unknown error';
}

export async function checkAvailabilityHandler(req: Request, res: Response): Promise<void> {
  const parsed = envelope.safeParse(req.body);
  if (!parsed.success) {
    logger.warn({ issues: parsed.error.issues }, 'check_availability payload invalid');
    res.status(400).json({ results: [] });
    return;
  }

  const toolCalls = parsed.data.message.toolCallList ?? parsed.data.message.toolCalls ?? [];

  const results = await Promise.all(
    toolCalls.map(async (tc) => {
      if (tc.function.name !== 'check_availability') {
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
        const slots = await getAvailableSlots(args.data.date);
        if (slots.length === 0) {
          return {
            toolCallId: tc.id,
            result: `No availability on ${args.data.date}. Offer another day.`,
          };
        }
        const offered = slots.slice(0, 4);
        return {
          toolCallId: tc.id,
          result: JSON.stringify({
            date: args.data.date,
            slots: offered.map((s) => ({ startIso: s.startIso, label: s.label })),
            note: 'Offer 2-3 of these to the caller verbally. Use startIso exactly when booking.',
          }),
        };
      } catch (err) {
        logger.error({ err }, 'check_availability handler failed');
        return { toolCallId: tc.id, result: `Error: ${extractMessage(err)}` };
      }
    }),
  );

  res.json({ results });
}
