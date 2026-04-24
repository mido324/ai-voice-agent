import { Router, json } from 'express';
import { z } from 'zod';
import { verifyVapiSecret } from '../lib/verifySignature.js';
import { logger } from '../lib/logger.js';
import {
  appendTranscript,
  finalizeCall,
  upsertCallByVapiId,
  type TranscriptEntry,
} from '../services/calls.js';
import { summarizeCall } from '../services/summaries.js';

export const vapiRouter = Router();

const callShape = z
  .object({
    id: z.string(),
    customer: z
      .object({
        number: z.string().optional(),
      })
      .optional(),
    phoneNumber: z
      .object({
        number: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

const reportMessage = z
  .object({
    role: z.string(),
    message: z.string().optional(),
    content: z.string().optional(),
    time: z.number().optional(),
  })
  .passthrough();

const envelope = z.object({
  message: z
    .object({
      type: z.string(),
      call: callShape.optional(),
      role: z.enum(['user', 'assistant', 'system', 'tool']).optional(),
      transcriptType: z.enum(['partial', 'final']).optional(),
      transcript: z.string().optional(),
      durationSeconds: z.number().optional(),
      status: z.string().optional(),
      messages: z.array(reportMessage).optional(),
    })
    .passthrough(),
});

function normalizeReportMessages(
  raw: z.infer<typeof reportMessage>[] | undefined,
): TranscriptEntry[] {
  if (!raw) return [];
  const out: TranscriptEntry[] = [];
  for (const m of raw) {
    const text = m.message ?? m.content ?? '';
    if (!text) continue;
    let role: TranscriptEntry['role'];
    switch (m.role) {
      case 'user':
        role = 'user';
        break;
      case 'bot':
      case 'assistant':
        role = 'assistant';
        break;
      case 'tool_calls':
      case 'tool_call_result':
      case 'tool':
        role = 'tool';
        break;
      default:
        continue; // drop system and unknown
    }
    const ts = typeof m.time === 'number' ? new Date(m.time).toISOString() : new Date().toISOString();
    out.push({ role, text, ts });
  }
  return out;
}

function phoneFromCall(call: z.infer<typeof callShape> | undefined): string {
  return call?.customer?.number ?? call?.phoneNumber?.number ?? 'unknown';
}

vapiRouter.post('/events', json({ limit: '2mb' }), verifyVapiSecret, async (req, res) => {
  const parsed = envelope.safeParse(req.body);
  if (!parsed.success) {
    logger.warn({ issues: parsed.error.issues }, 'Vapi payload did not match envelope');
    res.status(400).json({ ok: false });
    return;
  }

  const { message } = parsed.data;
  const call = message.call;

  try {
    switch (message.type) {
      case 'status-update':
      case 'call-started': {
        if (call) {
          await upsertCallByVapiId({
            vapi_call_id: call.id,
            phone_from: phoneFromCall(call),
            status: 'in_progress',
          });
          logger.info({ vapiCallId: call.id, status: message.status }, 'Call status update');
        }
        break;
      }

      case 'transcript': {
        if (call && message.transcriptType === 'final' && message.transcript && message.role) {
          const entry: TranscriptEntry = {
            role: message.role,
            text: message.transcript,
            ts: new Date().toISOString(),
          };
          await appendTranscript(call.id, entry);
        }
        break;
      }

      case 'end-of-call-report': {
        if (call) {
          const finalTranscript = normalizeReportMessages(message.messages);
          await finalizeCall(
            call.id,
            message.durationSeconds ?? 0,
            finalTranscript.length > 0 ? finalTranscript : undefined,
          );
          logger.info(
            { vapiCallId: call.id, transcriptEntries: finalTranscript.length },
            'Call finalized',
          );
          void summarizeCall(call.id).catch((err: unknown) => {
            logger.error({ err, vapiCallId: call.id }, 'Summary generation failed');
          });
        }
        break;
      }

      default: {
        logger.debug({ type: message.type }, 'Vapi event ignored');
      }
    }

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err, type: message.type }, 'Vapi event handler threw');
    res.status(500).json({ ok: false });
  }
});
