import { z } from 'zod';
import { supabase } from '../supabase.js';
import { logger } from '../lib/logger.js';
import { env } from '../env.js';
import { getOpenAI, hasOpenAI } from '../lib/openai.js';
import type { TranscriptEntry } from './calls.js';

const summarySchema = z.object({
  summary: z.string(),
  key_points: z.array(z.string()).max(10),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'mixed']),
  next_steps: z.array(z.string()).max(5).optional(),
});

export type CallSummary = z.infer<typeof summarySchema>;

const SYSTEM = `You summarize customer service phone call transcripts.
Return strict JSON with: summary (2-4 sentences), key_points (array of short bullets),
sentiment ("positive"|"neutral"|"negative"|"mixed"), next_steps (short actions for the business, array).
Be concise. If the caller gave contact info, do not repeat phone numbers verbatim in the summary.`;

function formatTranscript(transcript: TranscriptEntry[]): string {
  return transcript.map((e) => `${e.role}: ${e.text}`).join('\n');
}

export async function summarizeCall(vapiCallId: string): Promise<CallSummary | null> {
  if (!hasOpenAI()) {
    logger.debug('OPENAI_API_KEY not set, skipping summarization');
    return null;
  }

  const { data: call, error } = await supabase
    .from('calls')
    .select('id, transcript')
    .eq('vapi_call_id', vapiCallId)
    .maybeSingle();

  if (error) {
    logger.error({ err: error, vapiCallId }, 'Failed to load call for summarization');
    return null;
  }
  if (!call) {
    logger.warn({ vapiCallId }, 'No call found to summarize');
    return null;
  }

  const transcript = Array.isArray(call.transcript) ? (call.transcript as TranscriptEntry[]) : [];
  if (transcript.length === 0) {
    logger.info({ vapiCallId }, 'Empty transcript, skipping summary');
    return null;
  }

  const client = getOpenAI();
  const response = await client.chat.completions.create({
    model: env.OPENAI_SUMMARY_MODEL,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: formatTranscript(transcript) },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    logger.warn({ vapiCallId }, 'OpenAI returned empty summary content');
    return null;
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content);
  } catch (err) {
    logger.error({ err, content }, 'Summary content was not valid JSON');
    return null;
  }

  const parsed = summarySchema.safeParse(parsedJson);
  if (!parsed.success) {
    logger.error({ issues: parsed.error.issues, parsedJson }, 'Summary failed schema validation');
    return null;
  }

  const { error: upsertErr } = await supabase.from('call_summaries').upsert(
    {
      call_id: call.id,
      summary: parsed.data.summary,
      key_points: parsed.data.key_points,
      sentiment: parsed.data.sentiment,
    },
    { onConflict: 'call_id' },
  );

  if (upsertErr) {
    logger.error({ err: upsertErr, vapiCallId }, 'Failed to persist call summary');
    return null;
  }

  logger.info({ vapiCallId, sentiment: parsed.data.sentiment }, 'Call summarized');
  return parsed.data;
}
