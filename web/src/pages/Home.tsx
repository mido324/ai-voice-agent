import { Link } from 'react-router-dom';
import { Phone, Calendar, MessageCircle } from 'lucide-react';
import { ChatBubble } from '../components/ChatBubble';

export function Home() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--color-muted)]">
          Demo site
        </p>
        <h1 className="mt-1 text-5xl font-bold tracking-tight">Talk to our AI agent.</h1>
        <p className="mt-3 max-w-prose text-lg text-[color:var(--color-muted)]">
          Call us, or tap the chat bubble. Real-time voice and text — same brain, same answers.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card icon={<Phone size={20} />} title="Voice">
          Inbound phone calls answered instantly. The assistant captures your details and books appointments hands-free.
        </Card>
        <Card icon={<MessageCircle size={20} />} title="Chat">
          The bubble bottom-right works on any page. Type a question, get an answer. Same agent as on the phone.
        </Card>
        <Card icon={<Calendar size={20} />} title="Appointments">
          Tell the agent your preferred day and it offers real time slots, then books you in.
        </Card>
      </div>

      <div className="mt-12 rounded-2xl border border-[color:var(--color-border)] bg-white p-6">
        <h2 className="text-lg font-semibold">Try the chat</h2>
        <p className="mt-1 text-sm text-[color:var(--color-muted)]">
          Click the bubble. Try: <em>"Do you offer demos? I'd like to book one for tomorrow."</em>
        </p>
      </div>

      <footer className="mt-12 text-sm text-[color:var(--color-muted)]">
        <Link to="/dashboard" className="underline hover:text-[color:var(--color-ink)]">
          Staff dashboard →
        </Link>
      </footer>

      <ChatBubble />
    </div>
  );
}

interface CardProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

function Card({ icon, title, children }: CardProps) {
  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-white p-5">
      <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-[color:var(--color-brand)]/10 text-[color:var(--color-brand)]">
        {icon}
      </div>
      <div className="font-semibold">{title}</div>
      <p className="mt-1 text-sm text-[color:var(--color-muted)]">{children}</p>
    </div>
  );
}
