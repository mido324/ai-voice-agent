import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Phone, Users, Calendar, LogOut } from 'lucide-react';
import {
  adminApi,
  clearAdminToken,
  getAdminToken,
  setAdminToken,
  type AppointmentRow,
  type CallRow,
  type LeadRow,
  type Stats,
} from '../lib/adminApi';
import { cn } from '../lib/cn';

type Tab = 'calls' | 'leads' | 'appointments';

export function Dashboard() {
  const [token, setTokenState] = useState<string | null>(() => getAdminToken());
  const [tab, setTab] = useState<Tab>('calls');

  if (!token) {
    return <Login onAuth={(t) => setTokenState(t)} />;
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Staff dashboard</h1>
          <p className="text-sm text-[color:var(--color-muted)]">Calls, leads, and appointments at a glance.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            clearAdminToken();
            setTokenState(null);
          }}
          className="inline-flex items-center gap-2 rounded-md border border-[color:var(--color-border)] bg-white px-3 py-1.5 text-sm hover:bg-[color:var(--color-surface)]"
        >
          <LogOut size={14} /> Sign out
        </button>
      </header>

      <StatsBar />

      <nav className="mt-6 flex gap-1 border-b border-[color:var(--color-border)]">
        <TabButton active={tab === 'calls'} onClick={() => setTab('calls')}>
          Calls
        </TabButton>
        <TabButton active={tab === 'leads'} onClick={() => setTab('leads')}>
          Leads
        </TabButton>
        <TabButton active={tab === 'appointments'} onClick={() => setTab('appointments')}>
          Appointments
        </TabButton>
      </nav>

      <div className="mt-6">
        {tab === 'calls' && <CallsList />}
        {tab === 'leads' && <LeadsList />}
        {tab === 'appointments' && <AppointmentsList />}
      </div>
    </div>
  );
}

function Login({ onAuth }: { onAuth: (token: string) => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setAdminToken(value);
    try {
      await adminApi.stats();
      onAuth(value);
    } catch (err) {
      clearAdminToken();
      setError(err instanceof Error ? err.message : 'Invalid token');
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-24">
      <h1 className="text-2xl font-bold">Staff sign-in</h1>
      <p className="mt-1 text-sm text-[color:var(--color-muted)]">
        Enter the <code>ADMIN_TOKEN</code> from your server <code>.env</code>.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Admin token"
          className="w-full rounded-md border border-[color:var(--color-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--color-brand)]"
          autoFocus
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          className="w-full rounded-md bg-[color:var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--color-brand-dark)]"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}

function StatsBar() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    adminApi.stats().then(setStats).catch(() => setStats(null));
  }, []);

  const items = [
    { label: 'Calls', value: stats?.calls ?? '—', icon: <Phone size={16} /> },
    { label: 'Leads', value: stats?.leads ?? '—', icon: <Users size={16} /> },
    { label: 'Appointments', value: stats?.appointments ?? '—', icon: <Calendar size={16} /> },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {items.map((s) => (
        <div key={s.label} className="flex items-center gap-3 rounded-xl border border-[color:var(--color-border)] bg-white p-4">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-[color:var(--color-brand)]/10 text-[color:var(--color-brand)]">
            {s.icon}
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-[color:var(--color-muted)]">{s.label}</div>
            <div className="text-2xl font-semibold tabular-nums">{s.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        '-mb-px rounded-t-md border-b-2 px-4 py-2 text-sm font-medium transition',
        active
          ? 'border-[color:var(--color-brand)] text-[color:var(--color-ink)]'
          : 'border-transparent text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)]',
      )}
    >
      {children}
    </button>
  );
}

function useRemoteList<T>(
  loader: () => Promise<{ data: T[] }>,
): { rows: T[]; loading: boolean; error: string | null } {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loader()
      .then((r) => {
        if (!cancelled) setRows(r.data ?? []);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loader]);

  return { rows, loading, error };
}

function CallsList() {
  const { rows, loading, error } = useRemoteList<CallRow>(useMemo(() => () => adminApi.calls(), []));
  if (loading) return <Loading />;
  if (error) return <ErrorNote msg={error} />;
  if (rows.length === 0) return <Empty label="No calls yet" />;

  return (
    <Table
      columns={['From', 'Duration', 'Status', 'Started', '']}
      rows={rows.map((c) => [
        c.phone_from,
        c.duration_seconds ? `${c.duration_seconds}s` : '—',
        <StatusPill key="s" value={c.status} />,
        new Date(c.created_at).toLocaleString(),
        <Link key="l" to={`/dashboard/calls/${c.id}`} className="text-[color:var(--color-brand)] hover:underline">
          View →
        </Link>,
      ])}
    />
  );
}

function LeadsList() {
  const { rows, loading, error } = useRemoteList<LeadRow>(useMemo(() => () => adminApi.leads(), []));
  if (loading) return <Loading />;
  if (error) return <ErrorNote msg={error} />;
  if (rows.length === 0) return <Empty label="No leads yet" />;

  return (
    <Table
      columns={['Name', 'Phone', 'Intent', 'Source', 'Captured']}
      rows={rows.map((l) => [
        l.name ?? '—',
        l.phone,
        l.intent ?? '—',
        <SourcePill key="s" value={l.source} />,
        new Date(l.captured_at).toLocaleString(),
      ])}
    />
  );
}

function AppointmentsList() {
  const { rows, loading, error } = useRemoteList<AppointmentRow>(
    useMemo(() => () => adminApi.appointments(), []),
  );
  if (loading) return <Loading />;
  if (error) return <ErrorNote msg={error} />;
  if (rows.length === 0) return <Empty label="No appointments yet" />;

  return (
    <Table
      columns={['Customer', 'Phone', 'Service', 'Scheduled for', 'Status']}
      rows={rows.map((a) => [
        a.customer_name,
        a.phone,
        a.service ?? '—',
        new Date(a.scheduled_for).toLocaleString(),
        <StatusPill key="s" value={a.status} />,
      ])}
    />
  );
}

function Table({ columns, rows }: { columns: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-white">
      <table className="w-full text-sm">
        <thead className="bg-[color:var(--color-surface)] text-left text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-4 py-3 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-[color:var(--color-border)]">
              {r.map((cell, j) => (
                <td key={j} className="px-4 py-3 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ value }: { value: string }) {
  const color =
    value === 'completed' || value === 'confirmed'
      ? 'bg-emerald-100 text-emerald-800'
      : value === 'failed' || value === 'cancelled'
        ? 'bg-red-100 text-red-800'
        : 'bg-amber-100 text-amber-800';
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize', color)}>
      {value.replace(/_/g, ' ')}
    </span>
  );
}

function SourcePill({ value }: { value: string }) {
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-800">
      {value}
    </span>
  );
}

function Loading() {
  return <div className="rounded-xl border border-[color:var(--color-border)] bg-white p-8 text-sm text-[color:var(--color-muted)]">Loading…</div>;
}
function Empty({ label }: { label: string }) {
  return <div className="rounded-xl border border-[color:var(--color-border)] bg-white p-8 text-sm text-[color:var(--color-muted)]">{label}</div>;
}
function ErrorNote({ msg }: { msg: string }) {
  return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{msg}</div>;
}
