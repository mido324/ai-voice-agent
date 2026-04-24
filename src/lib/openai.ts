import OpenAI from 'openai';
import { env } from '../env.js';

let _client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  if (_client) return _client;
  _client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return _client;
}

export function hasOpenAI(): boolean {
  return Boolean(env.OPENAI_API_KEY);
}
