> ⚠️ **Under Development**

<p align="center">
  <img src="./public/logo.svg" alt="Hestia logo" width="180">
</p>

<p align="center">
  <a href="https://nextjs.org/docs">
    <img src="https://img.shields.io/badge/Next.js-15.5-black?logo=next.js" alt="Next.js 15.5">
  </a>
  <a href="https://supabase.com/docs/guides/realtime">
    <img src="https://img.shields.io/badge/Supabase-Realtime-3FCF8E?logo=supabase&logoColor=white" alt="Supabase Realtime">
  </a>
  <a href="https://ai.google.dev/">
    <img src="https://img.shields.io/badge/Gemini-Embeddings-8E75B2?logo=google-cloud&logoColor=white" alt="Google Gemini embeddings">
  </a>
  <a href="https://docs.stripe.com/identity">
    <img src="https://img.shields.io/badge/Stripe-Identity-635BFF?logo=stripe&logoColor=white" alt="Stripe Identity">
  </a>
  <a href="https://webrtc.org/">
    <img src="https://img.shields.io/badge/WebRTC-Voice%20%26%20Chat-FF4B6E?logo=webrtc&logoColor=white" alt="WebRTC">
  </a>
</p>

<p align="center">
  <img src="./docs/hestia.gif" alt="Walkthrough of the Hestia web app" width="760">
</p>

## What it is

A free, anonymous space where verified members talk to a peer about what is on
their mind, over voice or text. Matching is by topic, using embeddings rather
than keywords, so "I can't sleep before exams" and "stressed about finals"
find each other.

**[hestiacare.us](https://hestiacare.us)**

## How it works

- **Age bands that never cross.** Members are 16+, verified from a photo ID via
  Stripe Identity. 16-17 year olds are only matched with other 16-17 year olds,
  adults only with adults. The rule is enforced inside the matching functions in
  Postgres, so no client can route around it.
- **Topic matching.** A short description of what you want to talk about is
  embedded with Gemini (`gemini-embedding-001`, 768 dimensions) and compared by
  cosine distance against everyone else waiting.
- **Live sessions.** WebRTC carries voice and text directly between the two
  peers, with presence, typing indicators and a live waveform.
- **Moderation.** In-session reporting, blocking, and moderator tooling with
  bans that are checked server-side before any match is made.
- **Resources.** A searchable directory of crisis lines and mental health
  support, reachable without signing in.

## Built with

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/ui ·
Supabase (Auth, Postgres, pgvector, Realtime) · Stripe Identity · WebRTC ·
Google Gemini · Vitest

## Layout

| Path | What lives there |
| --- | --- |
| `app/api/` | Route handlers: matching, identity, moderation, embeddings |
| `lib/webrtc/` | `useRTCSession` — matchmaking, peer connection, data channels, media |
| `lib/verification/` | Stripe Identity flow and the server-side age gate |
| `supabase/migrations/` | Schema, RLS policies, and the matching functions |
| `components/` | UI primitives plus chat, waveform and session components |
| `tests/` | Unit tests and a live security-posture suite |
