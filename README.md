> ⚠️ **In Development:** Active work in progress; finalizing responsiveness and matching logic.

<p align="center">
  <img src="./public/logo.svg" alt="Hestia logo" width="180">
</p>
<p align="center">
  <a href="https://nextjs.org/docs">
    <img src="https://img.shields.io/badge/Next.js-15.3.2-black?logo=next.js" alt="Next.js 15.3.2">
  </a>
  <a href="https://supabase.com/docs/guides/realtime">
    <img src="https://img.shields.io/badge/Supabase-Realtime%20Chat-3FCF8E?logo=supabase&logoColor=white" alt="Supabase Realtime">
  </a>
  <a href="https://docs.stripe.com/identity">
    <img src="https://img.shields.io/badge/Stripe-Identity-635BFF?logo=stripe&logoColor=white" alt="Stripe Identity">
  </a>
  <a href="https://webrtc.org/">
    <img src="https://img.shields.io/badge/WebRTC-Live%20Sessions-FF4B6E?logo=webrtc&logoColor=white" alt="WebRTC Live Sessions">
  </a>
</p>

## Overview

Hestia offers a safe, anonymous space where community members are matched by age group and topic preference. Verified users can start real-time conversations over voice or chat, browse curated mental health resources, and reach out to the team via contact and support flows. The project is built on the Next.js App Router with TypeScript.

## Key Features

- Age verification powered by Stripe Identity with Supabase profile storage for gated access.
- WebRTC-based voice and text sessions with live waveform feedback, presence, and peer typing indicators.
- Resource directory with responsive desktop and mobile layouts plus full-text search.
- Accessible marketing pages (home, about, contact) with shadcn UI components and theme-aware styling.
- Friendly, theme-aware 404 fallback experience featuring animation via dotLottie assets.

## Tech Stack

- **Framework**: Next.js 15 (App Router) with React 19 and TypeScript.
- **Styling**: Tailwind CSS v4, custom fonts, shadcn/ui primitives, lucide-react icons.
- **Realtime & Data**: Supabase (Auth, Database, Realtime), custom hooks for matching and chat.
- **Identity**: Stripe Identity for secure document verification and webhook-driven status updates.
- **Tooling**: ESLint 9, WebRTC adapter, DetectRTC, Netlify deploy configuration.

## Architecture Highlights

- `app/`: Route segments including authenticated gates, resources, about, contact, and verification flows.
- `lib/webrtc`: `useRTCSession` hook orchestrates matching, peer connection, chat data channels, and media streams.
- `lib/verification` and `app/api/identity/*`: Server-side logic for Stripe webhook handling and verification management.
- `lib/env`: Strict runtime validation for server and public environment variables.
- `components/`: shadcn-based UI primitives plus custom chat, audio waveform, and layout building blocks.
- `supabase/migrations`: SQL migrations for profiles, verification metadata, and future schema evolutions.

## Getting Started

### Prerequisites

- Node.js 18 or newer
- [pnpm](https://pnpm.io/) 8+

### Installation

```bash
pnpm install
pnpm dev
```

Visit `http://localhost:3000` to load the application. Auth-gated routes require a verified Supabase session.

## Environment Variables

Configure the following in `.env.local` (client-side keys must be prefixed with `NEXT_PUBLIC_`):

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
STRIPE_SECRET_KEY=sk_live_or_test_key
STRIPE_IDENTITY_RESTRICTED_KEY=rk_live_or_test_key
STRIPE_IDENTITY_RETURN_URL=https://your-domain.com/verify
STRIPE_IDENTITY_FLOW_ID=flow_xxx
STRIPE_WEBHOOK_SECRET_IDENTITY=whsec_xxx
SUPABASE_SERVICE_ROLE_KEY=service_role_key
```

> Keep server-side secrets (`STRIPE_*`, `SUPABASE_SERVICE_ROLE_KEY`) out of the client bundle and configure them in your hosting provider.

## Database & Supabase

- Supabase schema migrations live in `supabase/migrations`. Apply them to your project via the Supabase SQL editor or CLI.
- Profiles are automatically created during Supabase Auth user provisioning and persist identity verification status and DOB.
- Realtime channels power voice/chat matchmaking and live verification updates subscribed to in the client.

## Development Tasks

- `pnpm lint` — run ESLint for static analysis.
- `pnpm build` — generate a production build.
- Playwright end-to-end coverage is planned; add scripts under `package.json` when the suite lands.

## Deployment

- `netlify.toml` ships required headers for WebRTC and Supabase websockets, making Netlify a first-class deployment option.
- Ensure Stripe webhook endpoints and Supabase environment variables are configured in the hosting environment.

## Project Roadmap

See `DEVELOPMENT_ROADMAP.md` for a chronological record of shipped features, integrations, and planned improvements.
