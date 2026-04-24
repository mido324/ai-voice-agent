const TOKEN_KEY = 'ai-voice-agent.adminToken';

export function getAdminToken(): string | null {
  return typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_KEY) : null;
}

export function setAdminToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

interface FetchOptions {
  signal?: AbortSignal;
}

async function adminFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const token = getAdminToken();
  if (!token) throw new Error('Admin token not set');

  const response = await fetch(`/api/admin${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: options.signal,
  });

  if (response.status === 401) throw new Error('Unauthorized — check your admin token');
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export interface CallRow {
  id: string;
  vapi_call_id: string | null;
  phone_from: string;
  duration_seconds: number | null;
  status: string;
  transcript: Array<{ role: string; text: string; ts: string }>;
  created_at: string;
  ended_at: string | null;
}

export interface LeadRow {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  intent: string | null;
  service_interest: string | null;
  source: string;
  call_id: string | null;
  captured_at: string;
}

export interface AppointmentRow {
  id: string;
  customer_name: string;
  phone: string;
  service: string | null;
  scheduled_for: string;
  status: string;
  agent_assigned: string | null;
  created_at: string;
}

export interface CallSummaryRow {
  call_id: string;
  summary: string | null;
  key_points: string[] | null;
  sentiment: string | null;
  created_at: string;
}

export interface Stats {
  calls: number;
  leads: number;
  appointments: number;
}

export const adminApi = {
  stats: (opts?: FetchOptions) => adminFetch<Stats>('/stats', opts),
  calls: (opts?: FetchOptions) => adminFetch<{ data: CallRow[] }>('/calls?limit=100', opts),
  call: (id: string, opts?: FetchOptions) =>
    adminFetch<{ call: CallRow; summary: CallSummaryRow | null }>(`/calls/${id}`, opts),
  leads: (opts?: FetchOptions) => adminFetch<{ data: LeadRow[] }>('/leads?limit=100', opts),
  appointments: (opts?: FetchOptions) =>
    adminFetch<{ data: AppointmentRow[] }>('/appointments?limit=100', opts),
};
