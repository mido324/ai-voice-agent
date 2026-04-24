import { Router, json } from 'express';
import { z } from 'zod';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { supabase } from '../supabase.js';
import { logger } from '../lib/logger.js';
import { env } from '../env.js';
import { getOpenAI, hasOpenAI } from '../lib/openai.js';

export const chatRouter = Router();

const SYSTEM_PROMPT = `You are a helpful customer service representative for our business.

Respond in English only. Keep replies short (1-3 sentences). Be friendly and specific.

You can:
1. Answer questions about services, pricing, and hours.
2. Help the user book an appointment (collect name, phone, preferred day).
3. Capture a lead (name, phone, reason for interest) when someone shows intent.

If you do not know something, say so briefly and offer to pass it to a human team member. Never invent prices or policies you are not confident about.`;

const messageSchema = z.object({
  session_id: z.string().uuid().nullish(),
  message: z.string().trim().min(1).max(2000),
});

interface ChatRow {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
}

async function loadHistory(sessionId: string): Promise<ChatRow[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(40);

  if (error) {
    logger.error({ err: error, sessionId }, 'Failed to load chat history');
    return [];
  }
  return (data ?? []) as ChatRow[];
}

async function createSession(): Promise<string> {
  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({})
    .select('id')
    .single();

  if (error) {
    logger.error({ err: error }, 'Failed to create chat session');
    throw new Error('Could not start chat session');
  }
  return data.id as string;
}

async function persistMessage(sessionId: string, role: ChatRow['role'], content: string): Promise<void> {
  const { error } = await supabase.from('chat_messages').insert({
    session_id: sessionId,
    role,
    content,
  });
  if (error) {
    logger.error({ err: error, sessionId, role }, 'Failed to persist chat message');
  }

  const { error: touchErr } = await supabase
    .from('chat_sessions')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', sessionId);
  if (touchErr) {
    logger.warn({ err: touchErr, sessionId }, 'Failed to bump chat session activity');
  }
}

chatRouter.post('/message', json({ limit: '256kb' }), async (req, res) => {
  if (!hasOpenAI()) {
    res.status(503).json({ error: 'Chat is not configured. Set OPENAI_API_KEY.' });
    return;
  }

  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' });
    return;
  }

  const { session_id, message } = parsed.data;
  const providedSession = session_id ?? null;

  let sessionId: string;
  try {
    sessionId = providedSession ?? (await createSession());
  } catch (err) {
    logger.error({ err }, 'Chat session init failed');
    res.status(500).json({ error: 'Could not start session' });
    return;
  }

  const history = providedSession ? await loadHistory(sessionId) : [];

  await persistMessage(sessionId, 'user', message);

  let reply: string;
  try {
    const client = getOpenAI();
    const historyMessages: ChatCompletionMessageParam[] = history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const completion = await client.chat.completions.create({
      model: env.OPENAI_CHAT_MODEL,
      temperature: 0.6,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...historyMessages,
        { role: 'user', content: message },
      ],
    });
    reply = completion.choices[0]?.message?.content?.trim() ?? '';
    if (!reply) reply = 'Sorry, I could not generate a response. Please try again.';
  } catch (err) {
    logger.error({ err, sessionId }, 'OpenAI chat completion failed');
    res.status(502).json({ error: 'Upstream model error' });
    return;
  }

  await persistMessage(sessionId, 'assistant', reply);

  res.json({ session_id: sessionId, reply });
});
