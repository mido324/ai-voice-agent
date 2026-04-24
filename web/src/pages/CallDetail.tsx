import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { adminApi, type CallRow, type CallSummaryRow } from '../lib/adminApi';
import { cn } from '../lib/cn';

export function CallDetail() {
  const { id } = useParams<{ id: string }>();
  const [call, setCall] = useState<CallRow | null>(null);
  const [summary, setSummary] = useState<CallSummaryRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    adminApi
      .call(id)
      .then((r) => {
        setCall(r.call);
        setSummary(r.summary);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Load failed'));
  }, [id]);

  if (error) return <div className="p-8 text-red-700">{error}</div>;
  if (!call) return <div className="p-8 text-[color:var(--color-muted)]">Loading…</div>;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-[color:var(--color-muted)] hover:text-[color:var(--color-ink)]">
        <ArrowLeft size={14} /> Back to dashboard
      </Link>

      <header className="mt-3 mb-6">
        <div className="text-xs uppercase tracking-wide text-[color:var(--color-muted)]">Call</div>
        <h1 className="mt-1 text-2xl font-bold tabular-nums">{call.phone_from}</h1>
        <p className="mt-1 text-sm text-[color:var(--color-muted)]">
          {new Date(call.created_at).toLocaleString()}
          {call.duration_seconds ? ` · ${call.duration_seconds}s` : ''}
          {' · '}
          {call.status}
        </p>
      </header>

      {summary ? (
        <section className="mb-6 rounded-xl border border-[color:var(--color-border)] bg-white p-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
            Summary
          </h2>
          <p className="text-sm leading-relaxed">{summary.summary}</p>
          {summary.key_points && summary.key_points.length > 0 && (
            <>
              <h3 className="mt-4 mb-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                Key points
              </h3>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {summary.key_points.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </>
          )}
          {summary.sentiment && (
            <div className="mt-4 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-800">
              Sentiment: {summary.sentiment}
            </div>
          )}
        </section>
      ) : (
        <section className="mb-6 rounded-xl border border-dashed border-[color:var(--color-border)] bg-white p-5 text-sm text-[color:var(--color-muted)]">
          No summary available. Either OpenAI is not configured or the summary is still generating.
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
          Transcript
        </h2>
        <div className="space-y-2 rounded-xl border border-[color:var(--color-border)] bg-white p-4">
          {call.transcript && call.transcript.length > 0 ? (
            call.transcript.map((t, i) => (
              <div
                key={i}
                className={cn(
                  'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                  t.role === 'user'
                    ? 'ml-auto bg-[color:var(--color-brand)]/10'
                    : 'mr-auto bg-[color:var(--color-surface)] ring-1 ring-[color:var(--color-border)]',
                )}
              >
                <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                  {t.role}
                </div>
                {t.text}
              </div>
            ))
          ) : (
            <div className="text-sm text-[color:var(--color-muted)]">Transcript not available.</div>
          )}
        </div>
      </section>
    </div>
  );
}
