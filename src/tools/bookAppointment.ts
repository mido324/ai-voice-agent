import type { Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../lib/logger.js';
import { bookAppointment } from '../services/appointments.js';

const argsSchema = z.object({
  customer_name: z.string().trim().min(1),
  phone: z.string().trim().min(6),
  service: z.string().trim().min(1).optional(),
  scheduled_for: z.string().min(10, 'scheduled_for must be an ISO 8601 datetime'),
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

export async function bookAppointmentHandler(req: Request, res: Response): Promise<void> {
  const parsed = envelope.safeParse(req.body);
  if (!parsed.success) {
    logger.warn({ issues: parsed.error.issues }, 'book_appointment payload invalid');
    res.status(400).json({ results: [] });
    return;
  }

  const toolCalls = parsed.data.message.toolCallList ?? parsed.data.message.toolCalls ?? [];

  const results = await Promise.all(
    toolCalls.map(async (tc) => {
      if (tc.function.name !== 'book_appointment') {
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
        const appt = await bookAppointment(args.data);
        return {
          toolCallId: tc.id,
          result: `Booked for ${appt.label} (id: ${appt.id}). Confirm back to the caller and end politely.`,
        };
      } catch (err) {
        logger.error({ err }, 'book_appointment handler failed');
        return { toolCallId: tc.id, result: `Could not book: ${extractMessage(err)}` };
      }
    }),
  );

  res.json({ results });
}
