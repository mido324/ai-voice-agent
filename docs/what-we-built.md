# What we built today — in plain English

## The short version

We built an AI assistant that can answer the phone, chat on a website, book appointments, and keep a tidy record of everything it does. One day. No staff needed to pick up the phone.

Imagine a receptionist who never sleeps, speaks politely every time, never forgets to write things down, and costs a couple of dollars a month instead of a salary. That's what this is.

## The three places people can reach it

**1. Phone line.** We have a real US phone number. Anyone can dial it and the AI picks up. It greets them, answers basic questions, asks for their name and phone number, and — if they want — books them an appointment. It can switch between topics naturally. When the call ends, everything the AI heard is saved.

**2. Website chat bubble.** A small floating button at the bottom-right corner of a website. Visitors click it, type a question, and get an answer a second later. Same "brain" as the phone agent — so whatever the phone AI knows, the chat AI knows too. If someone gives their name and what they want, it gets saved as a lead.

**3. Staff dashboard.** A password-protected web page for you. It shows every call that came in, every lead captured, and every appointment booked. You can click any call and see:
- The entire back-and-forth, line by line (like a text conversation)
- A short AI-written summary
- The main points the AI thinks you should know
- Whether the caller sounded happy or frustrated

## Why this is not a toy

The AI doesn't just talk — it actually *does things*. During a call, if someone says "I want an appointment tomorrow," the AI:
1. Checks a calendar to see what times are free
2. Offers the caller 2 or 3 real options verbally
3. Takes their choice and writes the appointment into the database
4. Confirms the booked time back to them

All of this happens while the caller is still on the line, in a normal-sounding voice, without anyone on our end doing anything.

## What happens behind the scenes (one paragraph, minimal jargon)

When the phone rings, the call goes to a service that turns speech into text, runs it through a large language model (same family as ChatGPT), then turns the model's reply back into speech — all fast enough that it feels like a real conversation. Our code listens for important moments (like "they gave their name" or "they want to book") and saves the information. When the call ends, another AI reads the full conversation and writes a short summary. The website chat uses the same language model but skips the voice part.

## What it costs to run

Roughly, at small volume:
- Phone number: ~$2/month
- Per-minute voice AI: a few cents per minute of conversation
- Language model (chat replies + summaries): pennies per conversation
- Database: free tier covers a lot
- Web hosting: free during development, ~$5–20/month when fully deployed

A small business could realistically run this for less than one takeaway meal per week.

## What makes today impressive

We went from an empty folder to a working voice agent + website chat + admin dashboard in a single session. The normal way to build something like this takes a small team several weeks. Most of that time is glue code between services; that's exactly the part AI tools dramatically speed up.

The code lives in a public GitHub repository so it can be shared, reviewed, or cloned by anyone. It includes screenshots and step-by-step setup instructions so someone else could recreate the same thing.

## What could come next (not done yet)

- **Deploy it.** Right now it runs on the laptop. One-time setup to move it to a proper server so it keeps running 24/7 without the laptop being on.
- **Human handoff.** When the AI gets stuck, transfer the call to a real person instead of ending it.
- **More languages.** The voice part can already speak Arabic and English — the chat bubble currently speaks English only. Adding the other languages is straightforward.
- **Better information.** Feed the AI the actual list of services, prices, and policies for a specific business so its answers are always correct.

## Bottom line

A small business can now have a fluent, always-on, appointment-booking receptionist — on the phone, on the website, and with perfect records — for the cost of a dinner out. The technology underneath is complicated. The result, from the customer's side, is just a nice conversation that ends with something useful happening.
