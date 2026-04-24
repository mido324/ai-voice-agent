#!/usr/bin/env bash
# Configures the Vapi assistant via their API, bypassing the buggy dashboard UI.
# Reads VAPI_API_KEY, VAPI_ASSISTANT_ID, VAPI_WEBHOOK_SECRET, and PUBLIC_BASE_URL from .env.
# Run from the project root:  bash scripts/configure-vapi.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "ERROR: .env not found. Copy env.example to .env first." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

: "${VAPI_API_KEY:?VAPI_API_KEY missing in .env}"
: "${VAPI_ASSISTANT_ID:?VAPI_ASSISTANT_ID missing in .env}"
: "${VAPI_WEBHOOK_SECRET:?VAPI_WEBHOOK_SECRET missing in .env}"
: "${PUBLIC_BASE_URL:?PUBLIC_BASE_URL missing in .env}"

if ! command -v jq >/dev/null; then
  echo "ERROR: jq is required. Install with: brew install jq" >&2
  exit 1
fi

SYSTEM_PROMPT='You are a helpful customer service representative.

Respond in English only.

You can do three things for callers:
1. Answer questions about services and pricing briefly.
2. Capture leads (name, phone, reason) using the capture_lead tool.
3. Book appointments using the check_availability and book_appointment tools.

Booking flow:
- When a caller wants to schedule something, first ask which day they prefer (today, tomorrow, a weekday).
- Convert their day to a YYYY-MM-DD date in your head before calling check_availability.
- Offer them 2 or 3 of the available slots verbally using the human-friendly labels you get back.
- Once they pick a time, call book_appointment with their name, phone, service, and the exact scheduled_for ISO value that came back from check_availability.
- Confirm the booking time back to them and politely end.

Timezone: business hours are in Asia/Baghdad. Dates and times you speak should feel local. Always call check_availability before book_appointment - never invent a slot.

Ask one question at a time. Keep replies to 1-2 sentences. Do not over-explain.'

jq -n \
  --arg prompt         "$SYSTEM_PROMPT" \
  --arg leadUrl        "${PUBLIC_BASE_URL%/}/tools/capture-lead" \
  --arg availUrl       "${PUBLIC_BASE_URL%/}/tools/check-availability" \
  --arg bookUrl        "${PUBLIC_BASE_URL%/}/tools/book-appointment" \
  --arg serverUrl      "${PUBLIC_BASE_URL%/}/webhooks/vapi/events" \
  --arg secret         "$VAPI_WEBHOOK_SECRET" \
  '{
    name: "Customer Service Agent",
    firstMessage: "Hello! How can I help you today?",
    firstMessageMode: "assistant-speaks-first",
    model: {
      provider: "openai",
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [ { role: "system", content: $prompt } ],
      tools: [
        {
          type: "function",
          async: false,
          function: {
            name: "capture_lead",
            description: "Save the caller as a lead. Call once you have their phone and at least a name or intent.",
            parameters: {
              type: "object",
              properties: {
                name:             { type: "string", description: "Caller full name" },
                phone:            { type: "string", description: "Caller phone number in any format" },
                email:            { type: "string", description: "Caller email (optional)" },
                intent:           { type: "string", description: "Short description of why they are calling" },
                service_interest: { type: "string", description: "Specific product or service they asked about" }
              },
              required: [ "phone" ]
            }
          },
          server: { url: $leadUrl, secret: $secret }
        },
        {
          type: "function",
          async: false,
          function: {
            name: "check_availability",
            description: "List available appointment slots for a date. Returns up to 4 slots with a startIso (use verbatim when booking) and a human label.",
            parameters: {
              type: "object",
              properties: {
                date: { type: "string", description: "Target date in YYYY-MM-DD format (business timezone)" }
              },
              required: [ "date" ]
            }
          },
          server: { url: $availUrl, secret: $secret }
        },
        {
          type: "function",
          async: false,
          function: {
            name: "book_appointment",
            description: "Book an appointment. Only use a scheduled_for value returned by check_availability.",
            parameters: {
              type: "object",
              properties: {
                customer_name: { type: "string", description: "Caller full name" },
                phone:         { type: "string", description: "Caller phone number" },
                service:       { type: "string", description: "Service type (e.g. consultation, demo, support)" },
                scheduled_for: { type: "string", description: "ISO 8601 datetime returned by check_availability (startIso field)" }
              },
              required: [ "customer_name", "phone", "scheduled_for" ]
            }
          },
          server: { url: $bookUrl, secret: $secret }
        }
      ]
    },
    voice:       { provider: "vapi",     voiceId: "Elliot" },
    transcriber: { provider: "deepgram", model: "nova-2", language: "en" },
    server:      { url: $serverUrl, secret: $secret }
  }' > /tmp/vapi-payload.json

echo "Configuring assistant $VAPI_ASSISTANT_ID ..."

HTTP_STATUS=$(curl -sS -o /tmp/vapi-response.json -w "%{http_code}" \
  -X PATCH "https://api.vapi.ai/assistant/${VAPI_ASSISTANT_ID}" \
  -H "Authorization: Bearer ${VAPI_API_KEY}" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/vapi-payload.json)

echo "HTTP $HTTP_STATUS"
echo "--- Response ---"
jq . /tmp/vapi-response.json 2>/dev/null || cat /tmp/vapi-response.json

if [[ "$HTTP_STATUS" != "200" ]]; then
  echo ""
  echo "Assistant update failed. Payload: /tmp/vapi-payload.json" >&2
  exit 1
fi

echo ""
echo "Assistant configured successfully."
