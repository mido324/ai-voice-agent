import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { cn } from '../lib/cn';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function ChatBubble() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hi! How can I help you today?' },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      });
    }
  }, [messages, open]);

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    setError(null);
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setSending(true);

    try {
      const response = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, message: trimmed }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? `Request failed: ${response.status}`);
      }

      const data = (await response.json()) as { session_id: string; reply: string };
      setSessionId(data.session_id);
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send';
      setError(message);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={open ? 'Close chat' : 'Open chat'}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'fixed bottom-6 right-6 z-40 grid h-14 w-14 place-items-center rounded-full shadow-lg transition',
          'bg-[color:var(--color-brand)] text-white hover:bg-[color:var(--color-brand-dark)]',
        )}
      >
        {open ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {open && (
        <section
          role="dialog"
          aria-label="Chat"
          className={cn(
            'fixed bottom-24 right-6 z-40 flex h-[32rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-white shadow-2xl',
          )}
        >
          <header className="flex items-center justify-between border-b border-[color:var(--color-border)] bg-[color:var(--color-brand)] px-4 py-3 text-white">
            <div>
              <div className="text-sm font-semibold">Chat with us</div>
              <div className="text-xs opacity-80">Usually replies within a minute</div>
            </div>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-[color:var(--color-surface)] px-3 py-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
                  m.role === 'user'
                    ? 'ml-auto bg-[color:var(--color-brand)] text-white'
                    : 'mr-auto bg-white text-[color:var(--color-ink)] shadow-sm ring-1 ring-[color:var(--color-border)]',
                )}
              >
                {m.content}
              </div>
            ))}
            {sending && (
              <div className="mr-auto max-w-[85%] rounded-2xl bg-white px-3 py-2 text-sm text-[color:var(--color-muted)] shadow-sm ring-1 ring-[color:var(--color-border)]">
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--color-muted)]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--color-muted)] [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--color-muted)] [animation-delay:300ms]" />
                </span>
              </div>
            )}
            {error && (
              <div className="mx-auto max-w-[90%] rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
                {error}
              </div>
            )}
          </div>

          <form
            className="flex gap-2 border-t border-[color:var(--color-border)] bg-white p-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2 text-sm outline-none focus:border-[color:var(--color-brand)]"
              disabled={sending}
            />
            <button
              type="submit"
              aria-label="Send message"
              disabled={sending || !input.trim()}
              className={cn(
                'grid h-10 w-10 place-items-center rounded-full bg-[color:var(--color-brand)] text-white transition',
                'hover:bg-[color:var(--color-brand-dark)] disabled:cursor-not-allowed disabled:opacity-40',
              )}
            >
              <Send size={18} />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
