# ai-voice-agent

Phase 1 MVP: a Node/Express backend that receives inbound phone calls via Twilio, forwards them to a Vapi AI assistant, and captures leads into Supabase.

```
Caller ─▶ Twilio ─▶ Vapi (AI) ─▶ this server ─▶ Supabase
```

## Prerequisites

- Node 22 (`nvm use`)
- A Supabase project
- A Twilio account + phone number
- A Vapi account + assistant
- [ngrok](https://ngrok.com/) for exposing your local server over HTTPS

## Setup

### 1. Install

```bash
npm install   # or pnpm install
cp env.example .env
```

Fill `.env` as you complete the steps below.

### 2. Supabase

1. Create a new Supabase project.
2. In the SQL editor, run `supabase/migrations/0001_init.sql`.
3. Copy into `.env`:
   - `SUPABASE_URL` — Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` — `service_role` key (server only, keep secret)
   - `SUPABASE_ANON_KEY` — `anon` key (used later by the frontend)

### 3. Run the server + ngrok

```bash
npm run dev
# in another terminal:
ngrok http 3000
```

Copy the HTTPS URL (e.g. `https://abc123.ngrok-free.app`) into `.env` as `PUBLIC_BASE_URL`. Restart `npm run dev` so the env change takes effect.

### 4. Vapi

1. Create an assistant in the Vapi dashboard.
2. System prompt (paste, then tweak for your business):

   ```
   You are a helpful customer service representative.
   Respond in the same language the caller uses (Arabic or English). If
   they switch, switch with them. Speak naturally for each language —
   do not transliterate.
   Your goals, in order:
   1. Answer questions about our services and pricing.
   2. Capture the caller's name, phone, and reason for calling, then call
      the capture_lead tool.
   3. If they want a human, say "Let me connect you with one of our team
      members" and end the call (Phase 2 will route to a live agent).
   Ask one question at a time. Keep replies short.
   ```

3. Transcriber: Deepgram Nova-2 or Whisper with language auto-detect.
4. Voice: ElevenLabs multilingual v2 or OpenAI (alloy / nova).
5. Add a Custom Function tool:
   - Name: `capture_lead`
   - Description: "Save a captured lead once you have their name, phone, and intent."
   - Parameters: `name` (string), `phone` (string, required), `email` (string, optional), `intent` (string), `service_interest` (string)
   - Server URL: `{PUBLIC_BASE_URL}/tools/capture-lead`
   - Custom header: `x-vapi-secret: {VAPI_WEBHOOK_SECRET}` (invent a strong value and put the same in `.env`)
6. Server URL for call events: `{PUBLIC_BASE_URL}/webhooks/vapi/events` with the same `x-vapi-secret` header.
7. Copy into `.env`:
   - `VAPI_API_KEY` — from Vapi settings
   - `VAPI_ASSISTANT_ID` — the assistant ID
   - `VAPI_WEBHOOK_SECRET` — the value you chose in step 5
   - `VAPI_PHONE_SIP` — the SIP URI Vapi assigns to this assistant (e.g. `sip:xxxx@sip.vapi.ai`)

### 5. Twilio

1. Buy or use a phone number.
2. Under **Voice Configuration → A Call Comes In**:
   - Webhook: `{PUBLIC_BASE_URL}/webhooks/twilio/call`
   - Method: `POST`
3. Copy into `.env`:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER` (E.164, e.g. `+15551234567`)

## Test call

1. `npm run dev` + `ngrok http 3000` are both running.
2. Call your Twilio number from any phone.
3. Expected:
   - AI greets within a couple seconds.
   - Tell it your name, phone, and "I'm interested in X".
   - AI invokes `capture_lead` mid-call — check server logs for `Lead upserted`.
   - Hang up.
4. In Supabase, confirm:
   - A row in `leads` with your name/phone/intent.
   - A row in `calls` with a non-empty `transcript` JSONB array and `status = 'completed'`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the server with tsx watch |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:types` | Generate Supabase typed clients (requires `supabase` CLI + `supabase link`) |

## Layout

```
src/
├── env.ts                  # zod-validated env (fail-fast at boot)
├── supabase.ts             # service-role client
├── lib/
│   ├── logger.ts           # pino + redaction
│   └── verifySignature.ts  # Twilio + Vapi signature middleware
├── webhooks/
│   ├── twilio.ts           # POST /webhooks/twilio/call  → TwiML forwarder
│   └── vapi.ts             # POST /webhooks/vapi/events  → call + transcript persistence
├── tools/
│   ├── captureLead.ts      # POST /tools/capture-lead    → upsert lead
│   └── router.ts
├── services/
│   ├── calls.ts
│   └── leads.ts
└── index.ts                # Express bootstrap
```

## Troubleshooting

- **403 on webhooks:** signature/secret headers not matching `.env`. Check `PUBLIC_BASE_URL` matches your ngrok URL exactly, and that you restarted the server after changing it.
- **Call connects but no AI voice:** `VAPI_PHONE_SIP` is wrong, or the Twilio→Vapi SIP route isn't configured in the Vapi dashboard.
- **Lead not saved:** tool server URL wrong, or `x-vapi-secret` header not set on the tool. Watch server logs for `capture_lead payload invalid` or `Vapi secret verification failed`.
- **Transcript empty:** Vapi "server URL for call events" not set, or secret mismatch.

## Phase 2+ (not implemented yet)

See the plan at `~/.claude/plans/claude-code-prompt-eager-frog.md`:
- React chat widget (Vite + Tailwind v4 + shadcn, bilingual i18next)
- Dashboard (calls, leads, analytics)
- Appointment booking (+ availability-check tool for Vapi)
- Human handoff
- Post-call summaries (LLM wrapper — reuse retry pattern from `linguistbridge/src/services/gemini.ts`)
