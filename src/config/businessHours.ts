export interface DayHours {
  open: string;
  close: string;
}

export interface BusinessHours {
  timezone: string;
  slotMinutes: number;
  minLeadMinutes: number;
  maxDaysAhead: number;
  days: Record<number, DayHours | null>;
  services: readonly string[];
}

export const businessHours: BusinessHours = {
  timezone: 'Asia/Baghdad',
  slotMinutes: 60,
  minLeadMinutes: 60,
  maxDaysAhead: 30,
  days: {
    0: { open: '09:00', close: '18:00' },
    1: { open: '09:00', close: '18:00' },
    2: { open: '09:00', close: '18:00' },
    3: { open: '09:00', close: '18:00' },
    4: { open: '09:00', close: '18:00' },
    5: null,
    6: null,
  },
  services: ['consultation', 'demo', 'support'],
} as const;
