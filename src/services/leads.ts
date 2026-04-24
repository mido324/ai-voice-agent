import { supabase } from '../supabase.js';
import { logger } from '../lib/logger.js';

export type LeadSource = 'voice' | 'chat' | 'web';

export interface LeadInput {
  name?: string | undefined;
  phone: string;
  email?: string | undefined;
  intent?: string | undefined;
  service_interest?: string | undefined;
  source?: LeadSource | undefined;
  call_id?: string | undefined;
}

export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('+')) return '+' + trimmed.slice(1).replace(/\D/g, '');
  return trimmed.replace(/\D/g, '');
}

export async function upsertLead(input: LeadInput): Promise<{ id: string }> {
  const phone = normalizePhone(input.phone);
  if (phone.length < 8) {
    throw new Error(`Invalid phone number: too short after normalization`);
  }

  const source: LeadSource = input.source ?? 'voice';

  const { data, error } = await supabase
    .from('leads')
    .upsert(
      {
        name: input.name ?? null,
        phone,
        email: input.email ?? null,
        intent: input.intent ?? null,
        service_interest: input.service_interest ?? null,
        source,
        call_id: input.call_id ?? null,
      },
      { onConflict: 'phone,source' },
    )
    .select('id')
    .single();

  if (error) {
    logger.error({ err: error }, 'Failed to upsert lead');
    throw error;
  }

  logger.info({ leadId: data.id, source, call_id: input.call_id }, 'Lead upserted');
  return { id: data.id };
}
