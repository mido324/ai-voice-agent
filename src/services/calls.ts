import { supabase } from '../supabase.js';
import { logger } from '../lib/logger.js';

export type CallStatus = 'in_progress' | 'completed' | 'failed';

export interface TranscriptEntry {
  role: 'user' | 'assistant' | 'system' | 'tool';
  text: string;
  ts: string;
}

export interface UpsertCallInput {
  vapi_call_id?: string;
  twilio_call_sid?: string;
  phone_from: string;
  status?: CallStatus;
}

export async function upsertCallByVapiId(input: UpsertCallInput): Promise<{ id: string }> {
  if (!input.vapi_call_id && !input.twilio_call_sid) {
    throw new Error('upsertCallByVapiId requires vapi_call_id or twilio_call_sid');
  }

  const conflict = input.vapi_call_id ? 'vapi_call_id' : 'twilio_call_sid';

  const { data, error } = await supabase
    .from('calls')
    .upsert(
      {
        vapi_call_id: input.vapi_call_id ?? null,
        twilio_call_sid: input.twilio_call_sid ?? null,
        phone_from: input.phone_from,
        status: input.status ?? 'in_progress',
      },
      { onConflict: conflict, ignoreDuplicates: false },
    )
    .select('id')
    .single();

  if (error) {
    logger.error({ err: error }, 'Failed to upsert call');
    throw error;
  }

  return { id: data.id };
}

export async function appendTranscript(
  vapi_call_id: string,
  entry: TranscriptEntry,
): Promise<void> {
  const { data: existing, error: fetchErr } = await supabase
    .from('calls')
    .select('id, transcript')
    .eq('vapi_call_id', vapi_call_id)
    .maybeSingle();

  if (fetchErr) {
    logger.error({ err: fetchErr }, 'Failed to fetch call for transcript append');
    throw fetchErr;
  }

  if (!existing) {
    logger.warn({ vapi_call_id }, 'Transcript event for unknown call; skipping');
    return;
  }

  const current = Array.isArray(existing.transcript) ? (existing.transcript as TranscriptEntry[]) : [];
  const next = [...current, entry];

  const { error: updateErr } = await supabase
    .from('calls')
    .update({ transcript: next })
    .eq('id', existing.id);

  if (updateErr) {
    logger.error({ err: updateErr }, 'Failed to append transcript');
    throw updateErr;
  }
}

export async function finalizeCall(
  vapi_call_id: string,
  durationSeconds: number,
  finalTranscript?: TranscriptEntry[],
): Promise<void> {
  const update: Record<string, unknown> = {
    status: 'completed',
    duration_seconds: Math.round(durationSeconds),
    ended_at: new Date().toISOString(),
  };
  if (finalTranscript) update.transcript = finalTranscript;

  const { error } = await supabase
    .from('calls')
    .update(update)
    .eq('vapi_call_id', vapi_call_id);

  if (error) {
    logger.error({ err: error, vapi_call_id }, 'Failed to finalize call');
    throw error;
  }
}
