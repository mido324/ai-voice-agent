import { addMinutes, isBefore, isAfter, parseISO } from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import { supabase } from '../supabase.js';
import { logger } from '../lib/logger.js';
import { businessHours } from '../config/businessHours.js';
import { normalizePhone } from './leads.js';

export interface Slot {
  startIso: string;
  endIso: string;
  label: string;
}

export interface BookingInput {
  customer_name: string;
  phone: string;
  service?: string | undefined;
  scheduled_for: string;
}

function parseDateOnly(dateStr: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) throw new Error(`Invalid date. Expected YYYY-MM-DD, got: ${dateStr}`);
  const [, y, m, d] = match;
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
}

function combineDateAndTime(dateUtcMidnight: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const local = new Date(dateUtcMidnight);
  local.setUTCHours(h ?? 0, m ?? 0, 0, 0);
  const zoned = toZonedTime(local, 'UTC');
  return fromZonedTime(zoned, businessHours.timezone);
}

export async function getAvailableSlots(dateStr: string): Promise<Slot[]> {
  const date = parseDateOnly(dateStr);
  const weekday = toZonedTime(date, businessHours.timezone).getUTCDay();
  const hours = businessHours.days[weekday];
  if (!hours) return [];

  const openLocal = combineDateAndTime(date, hours.open);
  const closeLocal = combineDateAndTime(date, hours.close);

  const now = new Date();
  const earliestAllowed = addMinutes(now, businessHours.minLeadMinutes);
  const maxAllowed = addMinutes(now, businessHours.maxDaysAhead * 24 * 60);

  if (isAfter(openLocal, maxAllowed)) return [];

  const candidates: Date[] = [];
  let cursor = openLocal;
  while (isBefore(cursor, closeLocal)) {
    if (isAfter(cursor, earliestAllowed)) candidates.push(cursor);
    cursor = addMinutes(cursor, businessHours.slotMinutes);
  }

  if (candidates.length === 0) return [];

  const dayStart = combineDateAndTime(date, '00:00');
  const dayEnd = addMinutes(dayStart, 24 * 60);

  const { data: existing, error } = await supabase
    .from('appointments')
    .select('scheduled_for, status')
    .gte('scheduled_for', dayStart.toISOString())
    .lt('scheduled_for', dayEnd.toISOString())
    .in('status', ['pending', 'confirmed']);

  if (error) {
    logger.error({ err: error }, 'Failed to load existing appointments');
    throw error;
  }

  const taken = new Set(
    (existing ?? []).map((a) => new Date(a.scheduled_for as string).toISOString()),
  );

  return candidates
    .filter((c) => !taken.has(c.toISOString()))
    .map((c) => ({
      startIso: c.toISOString(),
      endIso: addMinutes(c, businessHours.slotMinutes).toISOString(),
      label: formatInTimeZone(c, businessHours.timezone, "EEE d MMM, HH:mm"),
    }));
}

export async function bookAppointment(
  input: BookingInput,
): Promise<{ id: string; scheduled_for: string; label: string }> {
  const phone = normalizePhone(input.phone);
  if (phone.length < 8) throw new Error('Invalid phone number');

  const scheduled = parseISO(input.scheduled_for);
  if (isNaN(scheduled.getTime())) throw new Error('Invalid scheduled_for (need ISO 8601)');

  const dateStr = formatInTimeZone(scheduled, businessHours.timezone, 'yyyy-MM-dd');
  const available = await getAvailableSlots(dateStr);
  const slotMatch = available.find((s) => s.startIso === scheduled.toISOString());
  if (!slotMatch) {
    throw new Error(
      `Time slot not available. Offer one of: ${available
        .slice(0, 4)
        .map((s) => s.label)
        .join(', ')}`,
    );
  }

  const { data, error } = await supabase
    .from('appointments')
    .insert({
      customer_name: input.customer_name,
      phone,
      service: input.service ?? null,
      scheduled_for: scheduled.toISOString(),
      status: 'pending',
    })
    .select('id, scheduled_for')
    .single();

  if (error) {
    logger.error({ err: error }, 'Failed to book appointment');
    throw error;
  }

  logger.info({ apptId: data.id, scheduled: data.scheduled_for }, 'Appointment booked');

  return {
    id: data.id,
    scheduled_for: data.scheduled_for as string,
    label: slotMatch.label,
  };
}
