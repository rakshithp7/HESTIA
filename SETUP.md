# Setup

Everything needed to run Hestia locally and ship it.

## Requirements

- Node 22 (built and deployed on 22.x)
- pnpm — `pnpm-lock.yaml` is the lockfile that is kept current

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Auth-gated routes need a verified Supabase session, so `/connect`, `/profile`
and `/admin` redirect to `/verify` until an account has been through Stripe
Identity.

## Environment

Create `.env` in the project root. Values live in the Supabase, Stripe, Metered
and Resend dashboards — none of them belong in this repo.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser (anon) key — ships in the bundle |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. Bypasses RLS; never expose it |
| `GEMINI_API_KEY` | Topic embeddings |
| `STRIPE_SECRET_KEY` | Creating identity verification sessions |
| `STRIPE_IDENTITY_RESTRICTED_KEY` | Reading verified outputs, including date of birth |
| `STRIPE_IDENTITY_FLOW_ID` | Verification flow to run |
| `STRIPE_IDENTITY_RETURN_URL` | Where Stripe returns the user |
| `STRIPE_WEBHOOK_SECRET_IDENTITY` | Verifies webhook signatures |
| `METERED_API_KEY`, `METERED_DOMAIN` | TURN relay, needed for calls behind strict NATs |
| `RESEND_API_KEY`, `EMAIL_FROM` | Outbound email. Unset means email is logged, not sent |
| `MODERATION_ALERT_TO`, `CONTACT_INBOX_TO` | Where reports and contact messages go |
| `NEXT_PUBLIC_SITE_URL` | Absolute links in emails and redirects |

`lib/env` validates these at runtime and fails loudly rather than silently
degrading.

## Database

Migrations in `supabase/migrations/` are the source of truth for schema, RLS
policies, and the matching functions.

Two things that have caused real bugs here, both worth knowing before touching
this:

- **A migration reporting success does not mean it changed anything.** Always
  verify afterwards by probing the live API, not by trusting the result.
- **Locking down a function needs both a `PUBLIC` revoke and a per-role
  revoke.** Postgres grants `EXECUTE` to `PUBLIC` by default, and Supabase
  separately grants it to `anon` and `authenticated`. Revoking one leaves the
  other open.

`tests/security-posture.test.ts` probes the deployed PostgREST surface with the
browser key and asserts that privileged functions stay unreachable. Run it after
any change to grants or policies.

## Checks

```bash
pnpm test          # vitest - unit plus the live security-posture suite
npx tsc --noEmit   # types
pnpm lint
pnpm build
```

The security suite talks to the real project, so it needs `.env` present.

## Deploy

The Netlify site has **no git build hook** — pushing to `main` does not deploy
anything. Every release is a CLI deploy:

```bash
npx netlify status          # confirm the account and that the project is hestia-care
npx netlify deploy --build --prod
```

Migrations are applied separately and should go out **before** the client that
depends on them.

## Dashboard settings

A few things cannot be set from code and live in the Supabase dashboard: OTP
expiry, leaked-password protection, and Postgres version upgrades. Check
Advisors there after schema changes.
