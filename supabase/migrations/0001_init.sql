create extension if not exists "pgcrypto";

create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  vapi_call_id text unique,
  twilio_call_sid text unique,
  phone_from text not null,
  duration_seconds int,
  status text not null default 'in_progress',
  transcript jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists calls_created_at_idx on public.calls (created_at desc);
create index if not exists calls_status_idx on public.calls (status);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text not null,
  email text,
  intent text,
  service_interest text,
  source text not null default 'voice',
  call_id uuid references public.calls(id) on delete set null,
  captured_at timestamptz not null default now(),
  unique (phone, source)
);

create index if not exists leads_captured_at_idx on public.leads (captured_at desc);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  service text,
  scheduled_for timestamptz not null,
  status text not null default 'pending',
  agent_assigned text,
  created_at timestamptz not null default now()
);

create index if not exists appointments_scheduled_for_idx on public.appointments (scheduled_for);

create table if not exists public.call_summaries (
  call_id uuid primary key references public.calls(id) on delete cascade,
  summary text,
  key_points jsonb,
  sentiment text,
  created_at timestamptz not null default now()
);

alter table public.calls enable row level security;
alter table public.leads enable row level security;
alter table public.appointments enable row level security;
alter table public.call_summaries enable row level security;
